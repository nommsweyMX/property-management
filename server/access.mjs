import {HttpError} from './auth.mjs';
const ROLES=new Set(['Owner','Manager','Reporter','Viewer']);
export const emailValid=s=>typeof s==='string'&&s.length<=254&&/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(s);
export function createAccess(client,ownerEmails){
  let lock=Promise.resolve();
  async function resolve(identity,{bind=false}={}){
    const perform=async()=>{
      const rows=await client.list('App Access');
      const subjects=rows.filter(r=>r.fields['Google Subject']===identity.sub);
      if(subjects.length>1)throw new HttpError(403,'DUPLICATE_ACCESS_RECORD');
      let row=subjects[0];
      if(!row&&bind){
        const matches=rows.filter(r=>String(r.fields.Email||'').toLowerCase()===identity.email);
        if(matches.length>1)throw new HttpError(403,'DUPLICATE_ACCESS_RECORD');
        row=matches[0];
        if(!row&&ownerEmails.includes(identity.email)&&identity.authoritative){
          row=await client.create('App Access',{Email:identity.email,'Google Subject':identity.sub,Role:'Owner',Active:true,'Receive Notices':true,Language:'en'});
        }else if(row&&row.fields.Active&&!row.fields['Google Subject']&&identity.authoritative){
          row=await client.update('App Access',row.id,{'Google Subject':identity.sub});
        }
      }
      if(!row||!row.fields.Active||row.fields['Google Subject']!==identity.sub||!ROLES.has(row.fields.Role))throw new HttpError(403,'ACCESS_NOT_GRANTED');
      const all=await client.list('Properties');
      const role=row.fields.Role;
      const allowedPropertyIds=new Set(all.filter(p=>role==='Owner'||(row.fields.Properties||[]).includes(p.id)).map(p=>p.id));
      return {identity,role,allowedPropertyIds,properties:all,accessRecordId:row.id};
    };
    if(!bind)return perform();
    const work=lock.then(perform);lock=work.catch(()=>{});return work;
  }
  const authorize=(ctx,propertyId,write=false)=>{
    if(!ctx.allowedPropertyIds.has(propertyId)||write&&ctx.role==='Viewer')throw new HttpError(403,'PROPERTY_ACCESS_DENIED');
  };
  async function members(ctx){if(ctx.role!=='Owner')throw new HttpError(403,'OWNER_REQUIRED');return (await client.list('App Access')).map(r=>({id:r.id,email:r.fields.Email,role:r.fields.Role,active:!!r.fields.Active,properties:r.fields.Properties||[],notices:!!r.fields['Receive Notices']}));}
  async function invite(ctx,input){
    if(ctx.role!=='Owner')throw new HttpError(403,'OWNER_REQUIRED');
    if(!emailValid(input.email)||!['Manager','Reporter','Viewer'].includes(input.role)||!Array.isArray(input.properties)||!input.properties.length||input.properties.some(id=>!ctx.allowedPropertyIds.has(id)))throw new HttpError(400,'INVALID_MEMBER');
    const email=input.email.toLowerCase();if((await client.list('App Access')).some(r=>String(r.fields.Email||'').toLowerCase()===email))throw new HttpError(409,'MEMBER_EXISTS');
    return client.create('App Access',{Email:email,Role:input.role,Properties:input.properties,Active:true,'Receive Notices':input.notices===true,Language:input.language==='es'?'es':'en'});
  }
  async function revoke(ctx,id){if(ctx.role!=='Owner'||ctx.accessRecordId===id)throw new HttpError(403,'CANNOT_REVOKE');const record=await client.get('App Access',id);if(record.fields.Role==='Owner')throw new HttpError(403,'CANNOT_REVOKE_OWNER');return client.update('App Access',id,{Active:false});}
  return {resolve,authorize,members,invite,revoke};
}
