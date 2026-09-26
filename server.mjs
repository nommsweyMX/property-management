/** Static PWA plus authenticated live API. One process / one replica deployment. */
import http from 'node:http';
import {createApi} from './server/api.mjs';
import {runtimeAddress} from './server/config.mjs';
import {readFile, realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const ROOT=await realpath(fileURLToPath(new URL('./public/',import.meta.url)));
const TYPES={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
export function createServer(options={}){const api=createApi(options);const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Cross-Origin-Opener-Policy','same-origin-allow-popups');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; img-src 'self' data: blob: https://*.airtableusercontent.com; frame-src https://accounts.google.com/gsi/; connect-src 'self' https://accounts.google.com/gsi/; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  try{
    const url=new URL(req.url,'http://localhost');
    // Liveness only: does not assert that Google/Airtable/mail are configured or reachable.
    if(url.pathname==='/healthz'){
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return;}
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
      res.end(req.method==='HEAD'?undefined:JSON.stringify({status:'ok'}));return;
    }
    if(await api.handle(req,res,url))return;
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});res.end('Method not allowed');return;}
    let name=decodeURIComponent(url.pathname);if(name==='/'||name==='')name='/index.html';
    if(name.split('/').some(part=>part.startsWith('.'))||name.includes('\\')||name.includes('\0'))throw new Error('Invalid path');
    const requested=await realpath(path.join(ROOT,name));
    if(!requested.startsWith(ROOT+path.sep)||!TYPES[path.extname(requested)])throw new Error('Outside static root');
    const content=await readFile(requested);res.writeHead(200,{'Content-Type':TYPES[path.extname(requested)],'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:content);
  }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found');}
});
  const worker=setInterval(()=>api.drainNotices().catch(()=>console.error('Notification worker unavailable; review private outbox.')),30000);worker.unref();server.on('close',()=>clearInterval(worker));
  server.requestTimeout=30000;server.headersTimeout=10000;return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const {port,host}=runtimeAddress();
  createServer().listen(port,host,()=>console.log(`Casa HQ: http://${host}:${port}`));
}
