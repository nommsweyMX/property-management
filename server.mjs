/** Local/static prototype host. No Airtable or authenticated endpoints are exposed. */
import http from 'node:http';
import {readFile, realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const ROOT=await realpath(fileURLToPath(new URL('./public/',import.meta.url)));
const TYPES={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
export function createServer(){return http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});res.end('Method not allowed');return;}
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname.startsWith('/api/')){res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:'LIVE_INTEGRATION_NOT_ENABLED',message:'This build is a local-only prototype.'}));return;}
    let name=decodeURIComponent(url.pathname);if(name==='/'||name==='')name='/index.html';
    if(name.split('/').some(part=>part.startsWith('.'))||name.includes('\\')||name.includes('\0'))throw new Error('Invalid path');
    const requested=await realpath(path.join(ROOT,name));
    if(!requested.startsWith(ROOT+path.sep)||!TYPES[path.extname(requested)])throw new Error('Outside static root');
    const content=await readFile(requested);res.writeHead(200,{'Content-Type':TYPES[path.extname(requested)],'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:content);
  }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found');}
});}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT??3000),host=process.env.HOST??'127.0.0.1';
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid PORT');
  createServer().listen(port,host,()=>console.log(`Casa HQ local prototype: http://${host}:${port}`));
}
