/** Server-only Airtable adapter. Deliberately NOT wired to public HTTP routes yet.
 * Callers must supply a server-derived property allowlist after authenticating a user.
 * Never import into browser code. Never retry writes automatically: an ambiguous
 * timeout may have succeeded and retrying could create a duplicate ticket.
 */
import {AIRTABLE_PRIORITY, dateOnly} from '../public/domain.mjs';
const recordId = value => typeof value==='string' && /^rec[A-Za-z0-9]{14}$/.test(value);
const TABLES=new Set(['Properties','Areas','Systems & Assets','Tickets','Projects','Maintenance','Contractors','Work Log']);
export function createAirtableClient({token,baseId,fetchImpl=globalThis.fetch,delay=250}={}){
  if(!token||!/^app[A-Za-z0-9]{14}$/.test(baseId??''))throw new Error('Server Airtable configuration is missing or invalid');
  let queue=Promise.resolve(),last=0;
  async function perform(table,{method='GET',body,query,record}={}){
    if(!TABLES.has(table))throw new Error('Unsupported table');
    if(record&&!recordId(record))throw new Error('Invalid record ID');
    const url=new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}${record?'/'+record:''}`);
    if(query)for(const [key,value] of Object.entries(query))if(value!==undefined)url.searchParams.set(key,String(value));
    const task=queue.then(async()=>{
      const wait=Math.max(0,last+delay-Date.now());if(wait)await new Promise(resolve=>setTimeout(resolve,wait));last=Date.now();
      let response;
      try{response=await fetchImpl(url,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000),redirect:'error'});}catch{throw new Error(`Airtable request failed; ${method==='GET'?'read may be retried':'write outcome is unknown; check before retrying'}`);}
      if(!response.ok)throw new Error(`Airtable HTTP ${response.status}; request was not retried`);
      return response.json();
    });
    queue=task.catch(()=>{});return task;
  }
  async function list(table){let offset,records=[],seen=new Set();do{
    const data=await perform(table,{query:{pageSize:100,offset}});
    if(!Array.isArray(data.records))throw new Error('Invalid Airtable response');records.push(...data.records);offset=data.offset;
    if(offset){if(seen.has(offset))throw new Error('Repeated Airtable pagination cursor');seen.add(offset);}
  }while(offset);return records;}
  async function createTicket(input,context){
    if(!(context?.allowedPropertyIds instanceof Set)||!context.allowedPropertyIds.has(input.propertyId))throw new Error('Property access denied');
    if(!recordId(input.propertyId)||typeof input.title!=='string'||!input.title.trim()||input.title.length>160||typeof input.description!=='string'||input.description.length>5000||!Object.hasOwn(AIRTABLE_PRIORITY,input.priority))throw new Error('Invalid ticket');
    const property=await perform('Properties',{record:input.propertyId});
    if(input.areaId){
      const area=await perform('Areas',{record:input.areaId});
      if(!area.fields?.Property?.includes(input.propertyId))throw new Error('Area belongs to another property');
    }
    if(input.assetId){
      const asset=await perform('Systems & Assets',{record:input.assetId});
      if(!asset.fields?.Property?.includes(input.propertyId))throw new Error('Asset belongs to another property');
    }
    const fields={'Ticket':input.title.trim(),'Property':[input.propertyId],'Status':'New / Nuevo','Priority':AIRTABLE_PRIORITY[input.priority],
      'Description / Descripción':input.description,'Reported Date':dateOnly(new Date(),property.fields?.['Time Zone']??'America/Mexico_City')};
    if(input.areaId)fields.Area=[input.areaId];if(input.assetId)fields['Asset / System']=[input.assetId];
    const currency=property.fields?.['Default Currency'];if(['MXN','USD'].includes(currency))fields.Currency=currency;
    // Client-supplied Photos, Cost, Contractor, status, or extra fields are never passed through.
    const response=await perform('Tickets',{method:'POST',body:{records:[{fields}],typecast:false}});
    return response.records[0];
  }
  return Object.freeze({list,createTicket});
}
