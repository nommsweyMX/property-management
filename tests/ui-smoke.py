"""Offline UI smoke test: real view/domain code, mocked storage and UUIDs.
Does not test IndexedDB durability, service workers, or HTTPS installation.
Requires Python Playwright and a Chromium executable.
"""
from pathlib import Path
import os, re, json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
public=root/'public'
output=root/'test-results';output.mkdir(exist_ok=True)
html=(public/'index.html').read_text()
html=re.sub(r'<link[^>]*>', '', html)
html=re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.S)
html=html.replace('</head>','<style>'+(public/'styles.css').read_text()+'</style></head>')
source='\n'.join((public/name).read_text() for name in ['domain.mjs','locales.mjs','store.mjs','app.mjs'])
source=re.sub(r'^import .*?;\n','',source,flags=re.M)
source=re.sub(r'^export ','',source,flags=re.M)
source=source.replace('async function load() {','async function unusedLoad() {').replace('async function save(state) {','async function unusedSave(state) {')
source='''let mockState; async function load(){return mockState??null;} async function save(value){mockState=structuredClone(value);}
let uuidCounter=0; Object.defineProperty(crypto,'randomUUID',{value:()=>`${String(++uuidCounter).padStart(8,'0')}-0000-4000-8000-000000000000`});
'''+source
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
 page.set_default_timeout(5000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html)
 page.add_script_tag(type='module',content=source)
 page.get_by_role('heading',name='Your house, at a glance.').wait_for()
 page.screenshot(path=str(output/'casa-hq-mobile-en.png'))
 assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'mobile horizontal overflow'
 page.locator('#locale').click()
 page.get_by_role('heading',name='Tu casa, de un vistazo.').wait_for()
 page.screenshot(path=str(output/'casa-hq-mobile-es.png'))
 page.locator('main a[href="#report"]').first.click()
 page.locator('#title').fill('Revisar llave de la cocina')
 page.locator('#description').fill('Prueba local: gotea desde esta mañana.')
 page.locator('#area').select_option('kitchen')
 page.locator('#ticket-form button[type="submit"]').click()
 page.get_by_role('heading',name='Revisar llave de la cocina').wait_for()
 page.locator('#ticket-status').select_option('in_progress')
 page.get_by_text('Estado: En proceso',exact=True).wait_for()
 page.locator('#note').fill('Prueba: revisar empaque antes de comprar refacciones.')
 page.locator('#note-form button').click()
 page.get_by_text('Prueba: revisar empaque antes de comprar refacciones.',exact=True).wait_for()
 page.locator('#locale').click()
 page.get_by_role('heading',name='Revisar llave de la cocina').wait_for()
 page.locator('.bottom-nav a[href="#tickets"]').click()
 page.locator('#search').fill('COCINA')
 assert page.locator('#ticket-list .ticket-card').count()==1
 page.locator('#search').fill('NO MATCH')
 assert page.locator('#ticket-list .ticket-card').count()==0
 page.locator('.bottom-nav a[href="#more"]').click()
 page.locator('main a[href="#properties"]').click()
 page.locator('#p-name').fill('Test House')
 page.locator('#p-code').fill('TH')
 page.locator('#p-street').fill('Example Street 1')
 page.locator('#p-city').fill('Example City')
 page.locator('#property-form button').click()
 page.get_by_role('heading',name='Your house, at a glance.').wait_for()
 assert page.locator('#property-switch').input_value()!='demo-cp'
 assert page.locator('main .metric strong').first.inner_text()=='0'
 page.locator('#property-switch').select_option('demo-cp')
 assert page.locator('main .metric strong').first.inner_text()=='1'
 page.set_viewport_size({'width':1440,'height':1024})
 page.screenshot(path=str(output/'casa-hq-desktop.png'))
 assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'desktop overflow'
 assert not errors, errors
 print(json.dumps({'ui_smoke':'passed','checks':['EN/ES rendering','no mobile overflow','ticket creation','status change','work note','user text preserved','accent-insensitive filter','property creation','property isolation','desktop layout'], 'storage':'mocked','navigation':'offline in-memory rendering','page_errors':errors},ensure_ascii=False))
 browser.close()
