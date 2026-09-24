import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../server.mjs';
async function usingServer(callback){const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));try{await callback(`http://127.0.0.1:${server.address().port}`);}finally{await new Promise(resolve=>server.close(resolve));}}
test('home serves HTML with CSP',()=>usingServer(async base=>{const res=await fetch(base);assert.equal(res.status,200);assert.match(res.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.match(await res.text(),/manifest.webmanifest/);}));
test('server and configuration cannot be downloaded',()=>usingServer(async base=>{for(const name of ['/.env','/server.mjs','/server/airtable.mjs','/../package.json','/package.json'])assert.equal((await fetch(base+name)).status,404);}));
test('API fails closed rather than pretending to save to Airtable',()=>usingServer(async base=>{const res=await fetch(base+'/api/tickets');assert.equal(res.status,503);assert.equal((await res.json()).error,'LIVE_CONFIGURATION_REQUIRED');}));
test('unconfigured public write route is not exposed',()=>usingServer(async base=>assert.equal((await fetch(base+'/api/tickets',{method:'POST'})).status,503)));
test('manifest includes mobile icons',()=>usingServer(async base=>{const manifest=await(await fetch(base+'/manifest.webmanifest')).json();for(const icon of manifest.icons)assert.equal((await fetch(base+'/'+icon.src)).status,200);}));
