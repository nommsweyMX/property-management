"""Live-mode DOM smoke checks in an in-memory browser.
HTTP, Google, Airtable and browser storage are mocked. Separate Node tests exercise
real local HTTP and session/CSRF logic. This does NOT validate production OAuth.
"""
from pathlib import Path
import json,os,re,subprocess
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];public=root/'public';output=root/'test-results';output.mkdir(exist_ok=True)
fixture=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {fixtureClient,P1,P2} from './tests/fixtures.mjs';import {stateFor} from './server/records.mjs';console.log(JSON.stringify(await stateFor(fixtureClient(),{role:'Owner',identity:{email:'owner@gmail.com',name:'owner'},allowedPropertyIds:new Set([P1,P2])})))"],cwd=root))
html=(public/'index.html').read_text();html=re.sub(r'<link[^>]*>','',html);html=re.sub(r'<script[^>]*>.*?</script>','',html,flags=re.S);html=html.replace('</head>','<style>'+(public/'styles.css').read_text()+'</style></head>')
source='\n'.join((public/name).read_text() for name in ['domain.mjs','locales.mjs','store.mjs','live.mjs','app.mjs']);source=re.sub(r'^import .*?;\n','',source,flags=re.M);source=re.sub(r'^export ','',source,flags=re.M)
prelude=r'''
let fixture=FIXTURE,logged=false,seq=100;
const members=[{id:'rec00000000000001',email:'owner@gmail.com',role:'Owner',active:true}];
Object.defineProperty(crypto,'randomUUID',{value:()=>`00000000-0000-4000-8000-${String(++seq).padStart(12,'0')}`});
globalThis.fetch=async(path,options={})=>{
 const data=options.body?JSON.parse(options.body):{};let result,status=200;
 if(path==='/api/config')result={mode:'live',ready:true,googleClientId:'test.apps.googleusercontent.com',features:{notifications:false}};
 else if(path==='/api/auth/challenge')result={nonce:'test-nonce'};
 else if(path==='/api/auth/google'){logged=true;result={csrf:'test-csrf'};}
 else if(path==='/api/auth/logout'){logged=false;result={ok:true};}
 else if(!logged){status=401;result={error:'SIGN_IN_REQUIRED'};}
 else if(path==='/api/state')result={state:structuredClone(fixture),csrf:'test-csrf'};
 else if(path==='/api/tickets'&&options.method==='POST'){
  const ticket={...data,id:'rec'+String(++seq).padStart(14,'0'),code:'ISS-'+seq,status:'new',photos:[],revision:'r1'};fixture.tickets.push(ticket);result={ticket,notice:{status:'not_configured'}};
 }else if(/^\/api\/tickets\/[^/]+$/.test(path)&&options.method==='PATCH'){
  const ticket=fixture.tickets.find(t=>path.endsWith(t.id));ticket.status=data.status;ticket.revision='r2';fixture.history.push({id:'hist'+seq,propertyId:ticket.propertyId,ticketId:ticket.id,text:'Status changed',date:new Date().toISOString()});result={ticket};
 }else if(path.endsWith('/notes')){
  const ticket=fixture.tickets.find(t=>path.includes(t.id));fixture.history.push({id:'hist'+(++seq),propertyId:ticket.propertyId,ticketId:ticket.id,text:data.text,date:new Date().toISOString()});result={id:'hist'+seq};
 }else if(path==='/api/members'){
  if(options.method==='POST'){members.push({...data,id:'rec'+String(++seq).padStart(14,'0'),active:true});result={id:members.at(-1).id};}else result={members};
 }else if(path.endsWith('/revoke')){members.find(m=>path.includes(m.id)).active=false;result={ok:true};}
 else if(path==='/api/notifications')result={configured:false,counts:{pending:0}};
 else throw new Error('Unexpected mock URL '+path);
 return new Response(JSON.stringify(result),{status,headers:{'Content-Type':'application/json'}});
};
globalThis.google={accounts:{id:{initialize(options){this.options=options},renderButton(el){const b=document.createElement('button');b.textContent='TEST Google sign in';b.onclick=()=>this.options.callback({credential:'test-id-token'});el.append(b)},disableAutoSelect(){}}}};
globalThis.testViewer=()=>{fixture.role='Viewer';fixture.properties=fixture.properties.slice(0,1);fixture.tickets=fixture.tickets.filter(t=>t.propertyId===fixture.properties[0].id);};
'''.replace('FIXTURE',json.dumps(fixture))
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':390,'height':844});page.set_default_timeout(6000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html);page.add_script_tag(type='module',content=prelude+'\n'+source)
 page.get_by_text('TEST Google sign in',exact=True).click();page.get_by_role('heading',name='Your house, at a glance.').wait_for()
 page.locator('#locale').click();page.get_by_role('heading',name='Tu casa, de un vistazo.').wait_for()
 page.locator('main a[href="#report"]').first.click();page.locator('#title').fill('Prueba compartida de la cocina');page.locator('#description').fill('Datos de prueba, no una falla real.');page.locator('#ticket-form button[type="submit"]').click();page.get_by_role('heading',name='Prueba compartida de la cocina').wait_for()
 page.locator('#ticket-status').select_option('in_progress');page.get_by_text('Status changed',exact=True).wait_for()
 page.locator('#note').fill('Nota compartida de prueba');page.locator('#note-form button').click();page.get_by_text('Nota compartida de prueba',exact=True).wait_for()
 page.screenshot(path=str(output/'live-mobile-es.png'));assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),'mobile overflow'
 page.locator('.bottom-nav a[href="#more"]').click();page.locator('a[href="#team"]').click();page.locator('#member-email').fill('approved@gmail.com');page.locator('input[name="propertyIds"]').first.check();page.locator('#member-form button').click();page.get_by_text('approved@gmail.com',exact=True).wait_for()
 page.locator('.revoke-member').click();page.get_by_text('Viewer · Desactivado',exact=True).wait_for()
 page.evaluate('testViewer()');page.locator('#refresh').click();page.locator('.bottom-nav a[href="#tickets"]').click();page.get_by_role('heading',name='Prueba compartida de la cocina').click()
 assert page.locator('#ticket-status').is_disabled();assert page.locator('#note').is_disabled();assert page.locator('#property-switch option').count()==1
 page.locator('#logout').click();page.get_by_text('TEST Google sign in',exact=True).wait_for();assert 'Prueba compartida' not in page.locator('#app').inner_text()
 assert not errors,errors
 print(json.dumps({'result':'passed','checks':['mock Google callback UI','Spanish live-mode display','ticket POST wiring','revision PATCH wiring','notes POST wiring','mobile layout','access grant form','revoke action','viewer controls','property picker isolation','logout clears screen'],'services_and_storage':'mocked','browser_rendering':'real, in-memory','page_errors':errors}))
 browser.close()
