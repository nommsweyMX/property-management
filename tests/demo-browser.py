"""Real browser + real server in explicit demo mode: IndexedDB persistence, service worker and offline shell.
No live services are involved. Not a phone-installation or HTTPS test.
"""
from pathlib import Path
import json,os,socket,subprocess,tempfile,time,urllib.request
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
output=root/'test-results';output.mkdir(exist_ok=True)
with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
data=tempfile.mkdtemp(prefix='casa-demo-')
url=f'http://127.0.0.1:{port}'
def start():
 process=subprocess.Popen(['node','server.mjs'],cwd=root,env={**os.environ,'APP_MODE':'demo','HOST':'127.0.0.1','PORT':str(port),'DATA_DIR':data,'NODE_ENV':'test'},stdout=subprocess.DEVNULL)
 for _ in range(50):
  try:urllib.request.urlopen(url+'/healthz');break
  except Exception:time.sleep(.1)
 return process
server=start()
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
  ctx=browser.new_context(viewport={'width':390,'height':844})
  page=ctx.new_page();page.set_default_timeout(6000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(url);page.get_by_role('heading',name='Your house, at a glance.').wait_for()
  page.locator('main a[href="#report"]').first.click();page.locator('#title').fill('Demo: check the kitchen tap');page.locator('#description').fill('Browser persistence test only.')
  page.locator('#ticket-form button[type="submit"]').click();page.get_by_role('heading',name='Demo: check the kitchen tap').wait_for()
  page.goto(url+'/#tickets');page.reload();page.get_by_role('heading',name='Demo: check the kitchen tap').wait_for()
  assert page.evaluate("indexedDB.databases().then(d=>d.some(x=>x.name==='casa-hq-prototype-v1'))"),'demo IndexedDB database missing'
  page.evaluate('navigator.serviceWorker.ready.then(()=>true)')
  page.reload();page.get_by_role('heading',name='Demo: check the kitchen tap').wait_for()
  assert page.evaluate('!!navigator.serviceWorker.controller'),'service worker is not controlling the page'
  cached=page.evaluate("caches.keys().then(keys=>Promise.all(keys.map(k=>caches.open(k).then(c=>c.keys()).then(r=>r.map(x=>new URL(x.url).pathname))))).then(a=>a.flat())")
  assert '/app.mjs' in cached and '/index.html' in cached,cached
  assert not any(p.startswith('/api/') for p in cached),'API response cached by service worker'
  # Server unreachable: the cached shell loads and the app refuses to invent data instead of showing a browser error page.
  server.terminate();server.wait(timeout=5);page.reload()
  page.get_by_text('The server is unavailable. This app has not switched to offline demo data.',exact=True).wait_for()
  server=start();page.reload();page.get_by_role('heading',name='Demo: check the kitchen tap').wait_for()
  page.screenshot(path=str(output/'demo-browser-mobile-en.png'))
  assert not errors,errors
  print(json.dumps({'result':'passed','checks':['real IndexedDB save survives reload','service worker controls page','only static shell cached','server-down reload serves cached shell without inventing data','recovery after server restart'],'storage':'real IndexedDB','http_and_browser':'real','errors':errors}))
  browser.close()
finally:
 server.terminate();server.wait(timeout=5)
