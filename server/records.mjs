import {AIRTABLE_STATUS,AIRTABLE_PRIORITY} from '../public/domain.mjs';
const reverse=obj=>Object.fromEntries(Object.entries(obj).map(([k,v])=>[v,k]));
const statuses=reverse(AIRTABLE_STATUS),priorities=reverse(AIRTABLE_PRIORITY);
const text=v=>typeof v==='string'?v:'';
const bilingual=value=>{const s=text(value),parts=s.split(' / ');return parts.length===2?{en:parts[0],es:parts[1]}:s;};
export function property(r){const f=r.fields;return {id:r.id,name:f['Property Name'],code:f['Property Code'],country:f.Country,state:f['State / Province'],city:f.City,neighborhood:f.Neighborhood,street:f['Street Address'],postalCode:f['Postal Code'],fullAddress:f['Full Address'],currency:f['Default Currency']||'MXN',timeZone:f['Time Zone']||'America/Mexico_City',color:/^#[0-9a-f]{6}$/i.test(f['Primary Color']||'')?f['Primary Color']:'#254b40'};}
export function ticket(r){const f=r.fields;return {id:r.id,code:f['Ticket ID']||r.id,propertyId:f.Property?.[0],areaId:f.Area?.[0]||'',assetId:f['Asset / System']?.[0]||'',title:f.Ticket,description:f['Description / Descripción']||'',status:statuses[f.Status]||'new',priority:priorities[f.Priority]||'normal',createdAt:r.createdTime,revision:JSON.stringify([f.Status,f['Description / Descripción'],f['Target Date']]),photos:(f.Photos||[]).filter(x=>typeof x.url==='string'&&x.url.startsWith('https://')).map(x=>({name:x.filename||'Photo',data:x.url}))};}
export async function stateFor(client,ctx){
  const allowed=rows=>rows.filter(r=>r.fields.Property?.length===1&&ctx.allowedPropertyIds.has(r.fields.Property[0]));
  const properties=(ctx.properties||await client.list('Properties')).filter(r=>ctx.allowedPropertyIds.has(r.id)).map(property);
  const areas=allowed(await client.list('Areas')).map(r=>({id:r.id,propertyId:r.fields.Property[0],name:bilingual(r.fields['Area Name / Área'])}));
  const assets=allowed(await client.list('Systems & Assets')).map(r=>({id:r.id,propertyId:r.fields.Property[0],name:bilingual(r.fields['Asset / System']),areaId:r.fields.Area?.[0]}));
  const rawTickets=allowed(await client.list('Tickets'));
  const tickets=rawTickets.map(ticket);
  const maintenance=allowed(await client.list('Maintenance')).map(r=>({id:r.id,propertyId:r.fields.Property[0],title:bilingual(r.fields['Task / Tarea']),due:r.fields['Next Due']||null}));
  const rawProjects=allowed(await client.list('Projects'));
  const projects=rawProjects.map(r=>({id:r.id,propertyId:r.fields.Property[0],title:bilingual(r.fields['Project / Proyecto'])}));
  const history=allowed(await client.list('Work Log')).map(r=>({id:r.id,propertyId:r.fields.Property[0],ticketId:r.fields.Ticket?.[0],text:r.fields['Work Performed / Trabajo']||r.fields['Work Entry / Registro'],date:r.fields.Date||r.createdTime}));
  // A contact is only disclosed to managers/owners and only for work in permitted properties.
  const contractors=[];
  if(['Owner','Manager'].includes(ctx.role)){
    const perProperty=new Map();
    for(const r of [...rawTickets,...rawProjects])for(const id of r.fields.Contractor||r.fields.Contractors||[]){const key=`${r.fields.Property[0]}:${id}`;perProperty.set(key,{id,propertyId:r.fields.Property[0]});}
    for(const r of await client.list('Contractors'))for(const item of perProperty.values())if(item.id===r.id)contractors.push({...item,name:r.fields['Name / Company'],phone:r.fields['Phone / WhatsApp'],email:r.fields.Email});
  }
  return {version:2,locale:'en',currentProperty:properties[0]?.id,properties,areas,assets,tickets,maintenance,projects,history,contractors,role:ctx.role,user:{email:ctx.identity.email,name:ctx.identity.name}};
}
