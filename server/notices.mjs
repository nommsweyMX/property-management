/** Durable one-process outbox. Gmail needs its own app authorization, not ChatGPT's. */
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {emailValid} from './access.mjs';
import {communication} from '../public/domain.mjs';
import {property,ticket} from './records.mjs';
export function rawMessage({from,to,subject,text,id=randomUUID()}){
  if(!emailValid(from)||!emailValid(to)||/[\r\n]/.test(subject)||subject.length>500)throw new Error('Invalid email headers');
  const encoded=Buffer.from(text,'utf8').toString('base64').match(/.{1,76}/g)?.join('\r\n')||'';
  return Buffer.from([`From: ${from}`,`To: ${to}`,`Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    `Message-ID: <${id.replace(/[^A-Za-z0-9-]/g,'')}@${from.split('@')[1]}>`,`Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',encoded].join('\r\n')).toString('base64url');
}
export function gmailSender(config,fetchImpl=globalThis.fetch){
  let accessToken,expires=0;
  return async message=>{
    if(!config.mailReady)throw new Error('MAIL_NOT_CONFIGURED');
    if(Date.now()>=expires){
      const r=await fetchImpl('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({client_id:config.googleClientId,client_secret:config.googleClientSecret,refresh_token:config.gmailRefreshToken,grant_type:'refresh_token'}),signal:AbortSignal.timeout(15000),redirect:'error'});
      if(!r.ok)throw new Error('GMAIL_AUTH_FAILED');const result=await r.json();if(!result.access_token)throw new Error('GMAIL_AUTH_FAILED');
      accessToken=result.access_token;expires=Date.now()+Math.max(0,(result.expires_in||3600)-60)*1000;
    }
    const r=await fetchImpl('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',
      headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},
      body:JSON.stringify({raw:rawMessage({...message,from:config.gmailFrom})}),signal:AbortSignal.timeout(15000),redirect:'error'});
    if(!r.ok)throw new Error(`GMAIL_SEND_${r.status}`);const result=await r.json();if(!result.id)throw new Error('GMAIL_RESPONSE_INVALID');return result.id;
  };
}
export function createNotices({client,config,send=gmailSender(config)}){
  const dir=path.resolve(config.dataDir),file=path.join(dir,'notices.json');
  let lock=Promise.resolve();
  const serial=fn=>{const p=lock.then(fn);lock=p.catch(()=>{});return p;};
  async function load(){await mkdir(dir,{recursive:true,mode:0o700});try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return [];throw e;}}
  async function save(rows){const tmp=file+'.tmp';await writeFile(tmp,JSON.stringify(rows),{mode:0o600});await rename(tmp,file);}
  async function enqueue(record,event){
    if(!config.mailReady)return {status:'not_configured'};
    const p=property(await client.get('Properties',record.fields.Property[0]));
    const all=await client.list('App Access');
    const recipients=all.filter(r=>r.fields.Active&&['Owner','Manager','Reporter','Viewer'].includes(r.fields.Role)&&r.fields['Receive Notices']&&emailValid(r.fields.Email)&&
      (r.fields.Role==='Owner'||(r.fields.Properties||[]).includes(p.id)));
    if(!recipients.length)return {status:'no_subscribers'};
    return serial(async()=>{const rows=await load();for(const r of recipients){const locale=r.fields.Language==='es'?'es':'en';
      rows.push({id:randomUUID(),to:r.fields.Email,propertyId:p.id,subject:`Casa HQ · ${p.name} · ${locale==='es'?'Reporte actualizado':'Ticket update'}`,
        text:`${event}\n\n${communication(ticket(record),p,locale)}\n\n${config.origin}/#ticket/${record.id}`,status:'pending',createdAt:new Date().toISOString()});}
      await save(rows);return {status:'queued',count:recipients.length};});
  }
  async function drain(){if(!config.mailReady)return;return serial(async()=>{
    const rows=await load();
    // A process that stopped during delivery cannot know whether Gmail accepted it.
    let recovered=false;for(const row of rows)if(row.status==='sending'){row.status='unknown';recovered=true;}
    if(recovered)await save(rows);
    for(const row of rows.filter(r=>r.status==='pending')){
      const allowed=(await client.list('App Access')).some(r=>r.fields.Active&&['Owner','Manager','Reporter','Viewer'].includes(r.fields.Role)&&r.fields['Receive Notices']&&String(r.fields.Email||'').toLowerCase()===row.to.toLowerCase()&&(r.fields.Role==='Owner'||r.fields.Properties?.includes(row.propertyId)));
      if(!allowed){row.status='canceled';await save(rows);continue;}
      row.status='sending';await save(rows);
      try{row.providerId=await send(row);row.status='sent';row.sentAt=new Date().toISOString();}
      catch{row.status='unknown';row.error='Delivery not confirmed; check Gmail before retrying.';}
      await save(rows);
    }
  });}
  async function status(){return serial(async()=>{const rows=await load();return {configured:config.mailReady,counts:Object.fromEntries(['pending','sent','unknown','canceled','sending'].map(s=>[s,rows.filter(r=>r.status===s).length]))};});}
  return {enqueue,drain,status};
}
