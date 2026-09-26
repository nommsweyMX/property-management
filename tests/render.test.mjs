import test from 'node:test';
import assert from 'node:assert/strict';
import {configuration, runtimeAddress} from '../server/config.mjs';
import {createServer} from '../server.mjs';
import {readFile} from 'node:fs/promises';

const renderEnv={RENDER:'true', RENDER_EXTERNAL_URL:'https://test-casa.onrender.com'};
test('Render origin uses trusted platform environment, not an invented hostname',()=>{
  assert.equal(configuration(renderEnv).origin,renderEnv.RENDER_EXTERNAL_URL);
  assert.equal(configuration(renderEnv).ready,false);
});
test('custom origin overrides the Render URL',()=>{
  assert.equal(configuration({...renderEnv,PUBLIC_ORIGIN:'https://house.example.com'}).origin,'https://house.example.com');
});
test('invalid custom origin fails closed instead of falling back',()=>{
  assert.ok(configuration({...renderEnv,PUBLIC_ORIGIN:'https://house.example.com/path'}).missing.includes('PUBLIC_ORIGIN'));
});
test('Render requires HTTPS even for a loopback origin',()=>{
  assert.ok(configuration({...renderEnv,PUBLIC_ORIGIN:'http://localhost'}).missing.includes('PUBLIC_ORIGIN'));
});
test('non-Render host does not implicitly trust RENDER_EXTERNAL_URL',()=>{
  assert.equal(configuration({RENDER_EXTERNAL_URL:renderEnv.RENDER_EXTERNAL_URL}).origin,'');
});
test('Render address defaults to 0.0.0.0 and platform port',()=>{
  assert.deepEqual(runtimeAddress(renderEnv),{host:'0.0.0.0',port:10000});
  assert.deepEqual(runtimeAddress({...renderEnv,PORT:'12345'}),{host:'0.0.0.0',port:12345});
});
test('local defaults remain loopback and 3000',()=>{
  assert.deepEqual(runtimeAddress({}),{host:'127.0.0.1',port:3000});
  assert.deepEqual(runtimeAddress({HOST:'0.0.0.0',PORT:'8000'}),{host:'0.0.0.0',port:8000});
});
test('invalid ports are rejected',()=>{
  for(const PORT of ['0','65536','1.5','not-a-port',''])assert.throws(()=>runtimeAddress({PORT}),/Invalid PORT/);
});
test('explicit email disable wins over present credentials',()=>{
  const c=configuration({NOTIFICATIONS_ENABLED:'false',GOOGLE_CLIENT_ID:'123-test.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'TEST_ONLY',GMAIL_REFRESH_TOKEN:'TEST_ONLY',GMAIL_FROM:'owner@example.com'});
  assert.equal(c.mailReady,false);assert.equal(c.notificationsEnabled,false);
});
test('health endpoint is liveness, reveals no account/credential data, and cannot mutate',async()=>{
  const server=createServer({config:configuration({})});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const base=`http://127.0.0.1:${server.address().port}`;
    const res=await fetch(base+'/healthz');assert.equal(res.status,200);assert.deepEqual(await res.json(),{status:'ok'});
    assert.equal(res.headers.get('cache-control'),'no-store');
    const head=await fetch(base+'/healthz',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
    assert.equal((await fetch(base+'/healthz',{method:'POST'})).status,405);
    assert.equal((await fetch(base+'/api/state')).status,503);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
test('Render blueprint stays on free preview and does not embed credentials',async()=>{
  const text=await readFile(new URL('../render.yaml',import.meta.url),'utf8');
  assert.match(text,/plan: free/);assert.match(text,/autoDeployTrigger: "off"/);
  assert.match(text,/key: NOTIFICATIONS_ENABLED\s+value: "false"/);
  for(const key of ['AIRTABLE_TOKEN','GOOGLE_CLIENT_ID','OWNER_EMAILS'])assert.match(text,new RegExp(`key: ${key}\\s+sync: false`));
  assert.ok(!text.includes('gmail.com'));assert.ok(!text.includes('pat_'));assert.ok(!text.includes('disk:'));
});
