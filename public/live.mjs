/** Browser boundary: sessions stay in HttpOnly cookies; no credentials in storage. */
let csrf = '';
export class ApiError extends Error {
  constructor(status, code) { super(code); this.status=status; this.code=code; }
}
export async function request(path, {method='GET',data}={}) {
  const headers = {};
  if (data !== undefined) headers['Content-Type']='application/json';
  if (!['GET','HEAD'].includes(method) && csrf) headers['X-Casa-Csrf']=csrf;
  let response;
  try {response=await fetch(`/api/${path}`,{method,headers,credentials:'same-origin',cache:'no-store',body:data===undefined?undefined:JSON.stringify(data)});}
  catch {throw new ApiError(0,method==='GET'?'CONNECTION_FAILED':'SAVE_NOT_CONFIRMED_REFRESH');}
  let result;
  try {result=await response.json();} catch {throw new ApiError(response.status,'INVALID_SERVER_RESPONSE');}
  if (!response.ok) throw new ApiError(response.status,result.error||'REQUEST_FAILED');
  if (result.csrf) csrf=result.csrf;
  return result;
}
export function clearSession(){csrf='';}
let scriptPromise;
function googleScript(){
  if(globalThis.google?.accounts?.id)return Promise.resolve();
  return scriptPromise??=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
    script.onload=resolve;script.onerror=()=>{scriptPromise=undefined;reject(new ApiError(0,'GOOGLE_SCRIPT_BLOCKED'));};document.head.append(script);
  });
}
export async function signInButton(element,clientId,onSuccess,onFailure,locale='en'){
  try {
    const [{nonce}]=await Promise.all([request('auth/challenge'),googleScript()]);
    google.accounts.id.initialize({client_id:clientId,nonce,auto_select:false,callback:async result=>{
      try{await request('auth/google',{method:'POST',data:{credential:result.credential,nonce}});await onSuccess();}
      catch(error){onFailure(error);}
    }});
    google.accounts.id.renderButton(element,{type:'standard',theme:'outline',size:'large',text:'signin_with',locale});
  }catch(error){onFailure(error);}
}
export async function signOut(){await request('auth/logout',{method:'POST',data:{}});clearSession();globalThis.google?.accounts?.id.disableAutoSelect();}
