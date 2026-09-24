/** Opaque, short-lived cookies; per-request authorization is resolved separately. */
import {randomBytes, timingSafeEqual} from 'node:crypto';
export class HttpError extends Error {constructor(status, code){super(code);this.status=status;this.code=code;}}
export function same(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length>4096||b.length>4096)return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export function cookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').map(s=>s.trim().split(/=(.*)/s).slice(0,2)).filter(p=>p.length===2));}
export async function verifyGoogle(credential, audience){
  // Official client verifies signature, audience, issuer, and expiration. No tokeninfo shortcut.
  const {OAuth2Client}=await import('google-auth-library');
  const client=new OAuth2Client();
  try {return (await client.verifyIdToken({idToken:credential,audience})).getPayload();}
  catch {throw new HttpError(401,'GOOGLE_TOKEN_INVALID');}
}
export function createAuth({origin, clientId, secure=true, verify=verifyGoogle, now=Date.now}){
  const sessions=new Map(), challenges=new Map();
  const cookieName=secure?'__Host-casa-session':'casa-session';
  const challengeName=secure?'__Host-casa-login':'casa-login';
  const token=()=>randomBytes(32).toString('base64url');
  function sweep(){for(const store of [sessions,challenges])for(const [key,value] of store)if(value.exp<=now())store.delete(key);}
  const header=(name,value,age)=>`${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure?'; Secure':''}`;
  function challenge(res){sweep();if(challenges.size>=1000)throw new HttpError(429,'TRY_LATER');const id=token(),nonce=token();challenges.set(id,{nonce,exp:now()+600000});res.setHeader('Set-Cookie',header(challengeName,id,600));return {nonce};}
  function checkOrigin(req){if(req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site')throw new HttpError(403,'ORIGIN_DENIED');}
  async function login(req,res,input){
    checkOrigin(req);sweep();const id=cookies(req)[challengeName], entry=challenges.get(id);
    if(!entry||!same(entry.nonce,input.nonce)||typeof input.credential!=='string'||input.credential.length>16000)throw new HttpError(401,'LOGIN_EXPIRED');
    challenges.delete(id);
    const claim=await verify(input.credential,clientId);
    if(!claim||!same(claim.nonce,entry.nonce)||!claim.sub||claim.email_verified!==true||typeof claim.email!=='string')throw new HttpError(401,'GOOGLE_IDENTITY_INVALID');
    return {sub:String(claim.sub),email:claim.email.toLowerCase(),name:claim.name||claim.email,
      authoritative:claim.email.toLowerCase().endsWith('@gmail.com')||!!claim.hd};
  }
  function establish(req,res,identity){sweep();if(sessions.size>=1000)throw new HttpError(429,'TRY_LATER');const old=cookies(req)[cookieName];if(old)sessions.delete(old);const id=token(),csrf=token();sessions.set(id,{identity,csrf,exp:now()+8*3600000});res.setHeader('Set-Cookie',[header(cookieName,id,8*3600),header(challengeName,'',0)]);return {csrf};}
  function get(req){sweep();const entry=sessions.get(cookies(req)[cookieName]);if(!entry)throw new HttpError(401,'SIGN_IN_REQUIRED');return entry;}
  function write(req){checkOrigin(req);const entry=get(req);if(!same(req.headers['x-casa-csrf'],entry.csrf))throw new HttpError(403,'CSRF_INVALID');return entry;}
  function logout(req,res){write(req);sessions.delete(cookies(req)[cookieName]);res.setHeader('Set-Cookie',header(cookieName,'',0));}
  return {challenge,login,establish,get,write,logout};
}
