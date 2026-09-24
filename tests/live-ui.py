"""Real browser + app HTTP/session/CSRF flows with external Google/Airtable/mail mocked.
Not a production OAuth, real Airtable, or phone installability test.
"""
from pathlib import Path
import json,os,socket,subprocess,time,urllib.request
from playwright.sync_api import sync_playwright
def await_no_private_db(page):return page.evaluate('indexedDB.databases().then(d=>d.length===0)')
root=Path(__file__).resolve().parents[1]
output=root/'test-results';output.mkdir(exist_ok=True)
with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
server=subprocess.Popen(['node','tests/live-server.mjs'],cwd=root,env={**os.environ,'PORT':str(port)},stdout=subprocess.DEVNULL)
url=f'http://127.0.0.1:{port}'
try:
 for _ in range(50):
  try:urllib.request.urlopen(url+'/api/config');break
  except Exception:time.sleep(.1)
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
  def new_user(account):
   ctx=browser.new_context(viewport={'width':390,'height':844})
   # Intercept only Google's downloaded library; the actual app and API run normally.
   script='''window.google={accounts:{id:{initialize:function(o){this.options=o},renderButton:function(el){let button=document.createElement('button');button.textContent='TEST Google sign in';button.onclick=()=>this.options.callback({credential:JSON.stringify({account:ACCOUNT,nonce:this.options.nonce})});el.append(button)},disableAutoSelect:function(){}}}};'''.replace('ACCOUNT',json.dumps(account))
   ctx.route('https://accounts.google.com/gsi/client',lambda route:route.fulfill(status=200,content_type='application/javascript',body=script))
   page=ctx.new_page();page.set_default_timeout(6000);page.goto(url);page.get_by_text('TEST Google sign in',exact=True).click();page.get_by_role('heading',name='Your house, at a glance.').wait_for();return ctx,page
  owner,page=new_user('owner');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  assert page.locator('.prototype').inner_text().startswith('Airtable connected')
  page.locator('#locale').click();page.get_by_role('heading',name='Tu casa, de un vistazo.').wait_for()
  page.locator('main a[href="#report"]').first.click();page.locator('#title').fill('Prueba compartida de la cocina');page.locator('#description').fill('Solo datos de prueba, no una falla real.');page.locator('#ticket-form button[type="submit"]').click()
  page.get_by_role('heading',name='Prueba compartida de la cocina').wait_for()
  page.locator('#ticket-status').select_option('in_progress');page.get_by_text('owner: New / Nuevo → In Progress / En proceso',exact=True).wait_for()
  page.locator('#note').fill('Nota compartida de prueba');page.locator('#note-form button').click();page.get_by_text('owner: Nota compartida de prueba',exact=True).wait_for()
  page.reload();page.get_by_role('heading',name='Prueba compartida de la cocina').wait_for()
  assert await_no_private_db(page), 'live state was stored in IndexedDB'
  page.screenshot(path=str(output/'live-mobile-es.png'))
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), 'mobile overflow'
  page.locator('.bottom-nav a[href="#more"]').click();page.locator('a[href="#team"]').click();page.locator('#member-email').fill('approved@gmail.com');page.locator('input[name="propertyIds"]').first.check();page.locator('#member-form button').click();page.get_by_text('approved@gmail.com',exact=True).wait_for()
  viewer,v=new_user('viewer');v.goto(url+'/#tickets');v.get_by_role('heading',name='Tickets').wait_for();v.get_by_role('heading',name='Prueba compartida de la cocina').wait_for()
  v.get_by_role('heading',name='Prueba compartida de la cocina').click();assert v.locator('#ticket-status').is_disabled();assert v.locator('#note').is_disabled();assert v.locator('#property-switch option').count()==1
  page.locator('#logout').click();page.get_by_text('TEST Google sign in',exact=True).wait_for();assert 'Prueba compartida' not in page.locator('#app').inner_text()
  assert not errors,errors
  print(json.dumps({'result':'passed','checks':['Google callback to session (provider mocked)','Spanish live UI','shared ticket saved','status audit trail','shared work note','reload server persistence','no live IndexedDB data','mobile layout','property-scoped access grant','second-user shared data','viewer controls disabled','property isolation','logout clears private screen'],'external_services':'mocked','http_and_browser':'real','errors':errors}))
  browser.close()
finally:
 server.terminate();server.wait(timeout=5)
