/** In-memory external-service fixtures, never used by the production entrypoint. */
import {AIRTABLE_PRIORITY} from '../public/domain.mjs';
import {configuration} from '../server/config.mjs';
export const P1='recAAAAAAAAAAAAAA',P2='recBBBBBBBBBBBBBB',T1='recTTTTTTTTTTTTTT',T2='recUUUUUUUUUUUUUU';
export function fixtureConfig(origin='http://localhost') {return configuration({PUBLIC_ORIGIN:origin,AIRTABLE_TOKEN:'TEST_ONLY_NOT_A_TOKEN',AIRTABLE_BASE_ID:'appABCDEFGHIJKLMN',GOOGLE_CLIENT_ID:'test.apps.googleusercontent.com',OWNER_EMAILS:'owner@gmail.com',DATA_DIR:'/tmp/casa-test-not-used'});}
export function fixtureClient(){
  let seq=50;
  const db=Object.fromEntries(['Properties','Areas','Systems & Assets','Tickets','Projects','Maintenance','Work Log','Contractors','App Access'].map(t=>[t,[]]));
  const row=(id,fields)=>({id,createdTime:'2026-09-24T18:00:00.000Z',fields});
  db.Properties=[row(P1,{'Property Name':'Example House','Property Code':'EX','Full Address':'Example Street 1, Example City','Street Address':'Example Street 1',City:'Example City',Country:'Mexico'}),row(P2,{'Property Name':'Other House','Property Code':'OH'})];
  db.Tickets=[row(T1,{Ticket:'Faucet',Property:[P1],Status:'New / Nuevo',Priority:'Normal','Ticket ID':'ISS-000001'}),row(T2,{Ticket:'Private other home',Property:[P2],Status:'New / Nuevo',Priority:'Normal','Ticket ID':'ISS-000002'})];
  db['App Access']=['Owner','Manager','Reporter','Viewer'].map((role,i)=>row('rec'+String(i+1).padStart(14,'0'),{Email:`${role.toLowerCase()}@gmail.com`,'Google Subject':`sub-${role.toLowerCase()}`,Role:role,Active:true,Properties:[P1],'Receive Notices':true,Language:'en'}));
  const client={db,
    async list(table){return structuredClone(db[table]||[]);},
    async get(table,id){const r=db[table].find(r=>r.id===id);if(!r)throw new Error('Record not found');return structuredClone(r);},
    async create(table,fields){const r=row('rec'+String(++seq).padStart(14,'0'),structuredClone(fields));if(table==='Tickets')r.fields['Ticket ID']=`ISS-${String(seq).padStart(6,'0')}`;db[table].push(r);return structuredClone(r);},
    async update(table,id,fields){const r=db[table].find(r=>r.id===id);if(!r)throw new Error('Record not found');Object.assign(r.fields,structuredClone(fields));return structuredClone(r);},
    async createTicket(input,ctx){if(!ctx.allowedPropertyIds.has(input.propertyId))throw new Error('No access');return client.create('Tickets',{Ticket:input.title,Property:[input.propertyId],Area:input.areaId?[input.areaId]:[],Status:'New / Nuevo',Priority:AIRTABLE_PRIORITY[input.priority],'Description / Descripción':input.description});},
    async uploadPhoto(){return {};}
  };return client;
}
export const fixtureNotices=()=>({enqueue:async()=>({status:'not_configured'}),drain:async()=>{},status:async()=>({configured:false,counts:{pending:0}})});
export function fixtureVerify(credential){const input=JSON.parse(credential);return {sub:`sub-${input.account}`,email:`${input.account}@gmail.com`,email_verified:true,nonce:input.nonce,name:input.account};}
