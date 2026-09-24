import {configuration,publicConfiguration} from './config.mjs';
import {createAuth,HttpError} from './auth.mjs';
import {createAccess} from './access.mjs';
import {createAirtableClient} from './airtable.mjs';
import {stateFor,ticket as mapTicket} from './records.mjs';
import {createNotices} from './notices.mjs';
import {AIRTABLE_STATUS,dateOnly} from '../public/domain.mjs';
export function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function body(req){
  if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw new HttpError(415,'JSON_REQUIRED');
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>14*1024*1024)throw new HttpError(413,'PAYLOAD_TOO_LARGE');chunks.push(chunk);}
  try{const value=JSON.parse(Buffer.concat(chunks).toString());if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value;}catch{throw new HttpError(400,'INVALID_JSON');}
}
export function createApi({config=configuration(),client,verify,notices}={}){
  const enabled=config.ready;
  if(enabled)client??=createAirtableClient({token:config.airtableToken,baseId:config.baseId});
  const auth=createAuth({origin:config.origin,clientId:config.googleClientId,secure:config.secure,verify});
  const access=enabled?createAccess(client,config.ownerEmails):null;
  if(enabled)notices??=createNotices({client,config});
  const mutations=new Map(),requestLimits=new Map();
  function limit(req){
    const now=Date.now();for(const [ip,b] of requestLimits)if(now>=b.until)requestLimits.delete(ip);
    const ip=req.socket?.remoteAddress||'unknown';let bucket=requestLimits.get(ip);
    if(!bucket){if(requestLimits.size>=2048)throw new HttpError(429,'TRY_LATER');bucket={count:0,until:now+60000};requestLimits.set(ip,bucket);}
    if(++bucket.count>120)throw new HttpError(429,'TRY_LATER');
  }
  async function perRecord(key,fn){const previous=mutations.get(key)||Promise.resolve();const next=previous.catch(()=>{}).then(fn);mutations.set(key,next);try{return await next;}finally{if(mutations.get(key)===next)mutations.delete(key);}}
  async function ownedTicket(id,ctx){if(!/^rec[A-Za-z0-9]{14}$/.test(id))throw new HttpError(404,'NOT_FOUND');const record=await client.get('Tickets',id);if(record.fields.Property?.length!==1)throw new HttpError(403,'PROPERTY_ACCESS_DENIED');access.authorize(ctx,record.fields.Property[0],true);return record;}
  async function notice(record,event){try{return await notices.enqueue(record,event);}catch{return {status:'queue_failed',message:'Ticket saved; notice was not queued.'};}}
  return {
    config,
    async drainNotices(){if(enabled&&config.mailReady)await notices.drain();},
    async handle(req,res,url){
      if(!url.pathname.startsWith('/api/'))return false;
      try{
        limit(req);
        if(req.method==='GET'&&url.pathname==='/api/config'){json(res,200,publicConfiguration(config));return true;}
        if(!enabled)throw new HttpError(503,'LIVE_CONFIGURATION_REQUIRED');
        if(req.method==='GET'&&url.pathname==='/api/auth/challenge'){json(res,200,auth.challenge(res));return true;}
        if(req.method==='POST'&&url.pathname==='/api/auth/google'){
          const identity=await auth.login(req,res,await body(req));const ctx=await access.resolve(identity,{bind:true});
          json(res,200,{...auth.establish(req,res,identity),role:ctx.role});return true;
        }
        if(req.method==='POST'&&url.pathname==='/api/auth/logout'){auth.logout(req,res);json(res,200,{ok:true});return true;}
        const writing=!['GET','HEAD'].includes(req.method);
        const session=writing?auth.write(req):auth.get(req);
        const ctx=await access.resolve(session.identity); // Revocation is checked on every request.
        if(req.method==='GET'&&url.pathname==='/api/state'){json(res,200,{state:await stateFor(client,ctx),csrf:session.csrf});return true;}
        if(req.method==='GET'&&url.pathname==='/api/members'){json(res,200,{members:await access.members(ctx)});return true;}
        if(req.method==='POST'&&url.pathname==='/api/members'){const input=await body(req);const r=await perRecord('members',()=>access.invite(ctx,input));json(res,201,{id:r.id});return true;}
        const revoke=/^\/api\/members\/(rec[A-Za-z0-9]{14})\/revoke$/.exec(url.pathname);
        if(req.method==='POST'&&revoke){await access.revoke(ctx,revoke[1]);json(res,200,{ok:true});return true;}
        if(req.method==='GET'&&url.pathname==='/api/notifications'){if(ctx.role!=='Owner')throw new HttpError(403,'OWNER_REQUIRED');json(res,200,await notices.status());return true;}
        if(req.method==='POST'&&url.pathname==='/api/tickets'){
          const input=await body(req);access.authorize(ctx,input.propertyId,true);
          if(input.photos!==undefined&&(!Array.isArray(input.photos)||input.photos.length>3))throw new HttpError(400,'INVALID_PHOTOS');
          if((input.photos||[]).some(p=>!p||typeof p.data!=='string'||p.data.length>4.2*1024*1024||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.data)))throw new HttpError(400,'INVALID_PHOTOS');
          let record=await client.createTicket(input,ctx);const warnings=[];
          for(const photo of input.photos||[])try{await client.uploadPhoto(record.id,photo);}catch{warnings.push('PHOTO_UPLOAD_NOT_CONFIRMED');}
          try{record=await client.get('Tickets',record.id);}catch{warnings.push('REFRESH_FAILED_AFTER_SAVE');}
          json(res,201,{ticket:mapTicket(record),notice:await notice(record,'New report / Reporte nuevo'),warnings});return true;
        }
        const change=/^\/api\/tickets\/(rec[A-Za-z0-9]{14})$/.exec(url.pathname);
        if(req.method==='PATCH'&&change){
          if(!['Owner','Manager'].includes(ctx.role))throw new HttpError(403,'MANAGER_REQUIRED');
          const input=await body(req);if(!Object.hasOwn(AIRTABLE_STATUS,input.status))throw new HttpError(400,'INVALID_STATUS');
          const result=await perRecord(change[1],async()=>{
            const old=await ownedTicket(change[1],ctx);
            if(input.revision!==mapTicket(old).revision)throw new HttpError(409,'RECORD_CHANGED_RELOAD');
            const updated=await client.update('Tickets',old.id,{Status:AIRTABLE_STATUS[input.status]});
            let warning;try{await client.create('Work Log',{'Work Entry / Registro':`Status: ${AIRTABLE_STATUS[input.status]}`,Property:old.fields.Property,Ticket:[old.id],Date:dateOnly(new Date(),'America/Mexico_City'),'Work Performed / Trabajo':`${session.identity.name}: ${old.fields.Status} → ${AIRTABLE_STATUS[input.status]}`});}catch{warning='STATUS_SAVED_HISTORY_NOT_CONFIRMED';}
            return {ticket:mapTicket(updated),notice:await notice(updated,'Status changed / Cambio de estado'),warning};
          });json(res,200,result);return true;
        }
        const notes=/^\/api\/tickets\/(rec[A-Za-z0-9]{14})\/notes$/.exec(url.pathname);
        if(req.method==='POST'&&notes){
          const record=await ownedTicket(notes[1],ctx),input=await body(req);
          if(typeof input.text!=='string'||!input.text.trim()||input.text.length>5000)throw new HttpError(400,'INVALID_NOTE');
          const row=await client.create('Work Log',{'Work Entry / Registro':`Note / Nota: ${record.fields.Ticket}`.slice(0,200),Property:record.fields.Property,Ticket:[record.id],Date:dateOnly(new Date(),'America/Mexico_City'),'Work Performed / Trabajo':`${session.identity.name}: ${input.text.trim()}`});
          json(res,201,{id:row.id,notice:await notice(record,'Work note added / Nueva nota de trabajo')});return true;
        }
        if(req.method==='POST'&&url.pathname==='/api/properties'){
          if(ctx.role!=='Owner')throw new HttpError(403,'OWNER_REQUIRED');const input=await body(req);
          const result=await perRecord('properties',async()=>{
            const all=await client.list('Properties');if(all.length>=4)throw new HttpError(409,'FOUR_PROPERTY_LIMIT');
            if(typeof input.name!=='string'||!input.name.trim()||input.name.length>180||!/^[A-Za-z0-9]{1,8}$/.test(input.code||'')||!/^#[0-9a-f]{6}$/i.test(input.color||''))throw new HttpError(400,'INVALID_PROPERTY');
            for(const key of ['country','state','city','neighborhood','street','postalCode'])if(input[key]!==undefined&&(typeof input[key]!=='string'||input[key].length>180))throw new HttpError(400,'INVALID_PROPERTY');
            if(all.some(r=>r.fields['Property Code']===input.code.toUpperCase()))throw new HttpError(409,'PROPERTY_CODE_EXISTS');
            const fields={'Property Name':input.name.trim(),'Property Code':input.code.toUpperCase(),Country:input.country||'','State / Province':input.state||'',City:input.city||'',Neighborhood:input.neighborhood||'','Street Address':input.street||'','Postal Code':input.postalCode||'','Primary Color':input.color,'Default Currency':'MXN','Time Zone':'America/Mexico_City','Default Language':'Bilingual / Bilingüe'};
            fields['Full Address']=[input.street,input.neighborhood,input.postalCode,input.city,input.state,input.country].filter(Boolean).join(', ');
            return client.create('Properties',fields);
          });json(res,201,{id:result.id});return true;
        }
        throw new HttpError(404,'NOT_FOUND');
      }catch(error){json(res,error.status||502,{error:error.code||'UPSTREAM_OPERATION_NOT_CONFIRMED',message:error.status?undefined:'Operation was not confirmed. Refresh before retrying a write.'});}
      return true;
    }
  };
}
