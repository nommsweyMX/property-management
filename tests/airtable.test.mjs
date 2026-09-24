import test from 'node:test';
import assert from 'node:assert/strict';
import {createAirtableClient} from '../server/airtable.mjs';
const baseId='appABCDEFGHIJKLMN', propertyId='recABCDEFGHIJKLMN';
const ok=data=>({ok:true,json:async()=>data});
const config=fetchImpl=>({token:'test-only-placeholder',baseId,delay:0,fetchImpl});
const input={propertyId,title:'Repair faucet',description:'Dripping',priority:'normal'};
test('missing configuration fails closed',()=>assert.throws(()=>createAirtableClient(),/configuration/));
test('list follows all pagination cursors',async()=>{
  let n=0;const client=createAirtableClient(config(async url=>{
    n++;if(n===1)return ok({records:[{id:'one'}],offset:'next'});assert.equal(url.searchParams.get('offset'),'next');return ok({records:[{id:'two'}]});
  }));assert.deepEqual(await client.list('Properties'),[{id:'one'},{id:'two'}]);assert.equal(n,2);
});
test('repeating cursors are rejected',async()=>{
  const client=createAirtableClient(config(async()=>ok({records:[],offset:'repeat'})));
  await assert.rejects(client.list('Properties'),/Repeated/);
});
test('unknown table rejected before HTTP',async()=>{
  const client=createAirtableClient(config(async()=>{throw new Error('must not call')}));
  await assert.rejects(client.list('Secrets'),/Unsupported/);
});
test('property authorization required before any external request',async()=>{
  let calls=0;const client=createAirtableClient(config(async()=>{calls++;return ok({});}));
  await assert.rejects(client.createTicket(input,{}),/denied/);assert.equal(calls,0);
});
test('cross-property area rejected',async()=>{
  const client=createAirtableClient(config(async url=>url.pathname.includes('/Properties/')?ok({fields:{}}):ok({fields:{Property:['recOTHER1234567890']}})));
  await assert.rejects(client.createTicket({...input,areaId:'recNOPQRSTUVWXYZ1'},{allowedPropertyIds:new Set([propertyId])}),/another property/);
});
test('ticket write maps fields, keeps status controlled, and ignores arbitrary fields',async()=>{
  const calls=[];const client=createAirtableClient(config(async(url,options)=>{
    calls.push({url:String(url),options});return options.method==='POST'?ok({records:[{id:propertyId}]}):ok({fields:{'Default Currency':'MXN','Time Zone':'America/Mexico_City'}});
  }));await client.createTicket({...input,Cost:999,Photos:['bad'],status:'closed'},{allowedPropertyIds:new Set([propertyId])});
  const payload=JSON.parse(calls[1].options.body),fields=payload.records[0].fields;
  assert.equal(fields.Status,'New / Nuevo');assert.equal(fields.Currency,'MXN');assert.equal(fields.Cost,undefined);assert.equal(fields.Photos,undefined);assert.equal(payload.typecast,false);
});
test('403 not retried and token not disclosed in error',async()=>{
  let calls=0;const client=createAirtableClient(config(async()=>{calls++;return {ok:false,status:403};}));
  await assert.rejects(client.list('Properties'),error=>{assert.match(error.message,/403/);assert.doesNotMatch(error.message,/test-only-placeholder/);return true;});assert.equal(calls,1);
});
test('ambiguous write failure is not retried',async()=>{
  let writes=0;const client=createAirtableClient(config(async(url,options)=>{if(options.method==='POST'){writes++;throw new Error('network');}return ok({fields:{}});}));
  await assert.rejects(client.createTicket(input,{allowedPropertyIds:new Set([propertyId])}),/write outcome is unknown/);assert.equal(writes,1);
});
