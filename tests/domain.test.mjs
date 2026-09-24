import test from 'node:test';
import assert from 'node:assert/strict';
import {STATUS,PRIORITY,AIRTABLE_STATUS,AIRTABLE_PRIORITY,esc,normalize,isOpen,fullAddress,validateTicket,communication,dateOnly,label} from '../public/domain.mjs';
import {messages} from '../public/locales.mjs';
import {seed} from '../public/store.mjs';
test('EN/ES locale keys match exactly',()=>assert.deepEqual(Object.keys(messages.en).sort(),Object.keys(messages.es).sort()));
test('all status and priority values have translations and Airtable mappings',()=>{
  for(const key of STATUS){assert.ok(messages.en[key]);assert.ok(messages.es[key]);assert.ok(AIRTABLE_STATUS[key]);}
  for(const key of PRIORITY){assert.ok(messages.en[key]);assert.ok(messages.es[key]);assert.ok(AIRTABLE_PRIORITY[key]);}
});
test('escape markup, quotes and ampersands',()=>assert.equal(esc('<script a="x">&\'</script>'),'&lt;script a=&quot;x&quot;&gt;&amp;&#39;&lt;/script&gt;'));
test('accent-insensitive search',()=>assert.equal(normalize('RECÁMARA'), 'recamara'));
test('closed states excluded from outstanding count',()=>{
  for(const status of ['complete','verified','closed'])assert.equal(isOpen({status}),false);
  for(const status of ['new','triage','scheduled','in_progress','waiting'])assert.equal(isOpen({status}),true);
});
test('metadata builds full address without empty separators',()=>assert.equal(fullAddress({street:'Example 1',neighborhood:'Centro',postalCode:'12345',city:'City',state:'State',country:'Country'}),'Example 1, Centro, 12345 City, State, Country'));
test('optional area permitted',()=>{
  const data=seed();assert.deepEqual(validateTicket({propertyId:'demo-cp',title:'Repair',description:'',priority:'normal',areaId:''},data.properties,data.areas),[]);
});
test('area from another property rejected',()=>{
  const data=seed();data.areas.push({id:'foreign',propertyId:'other'});
  assert.ok(validateTicket({propertyId:'demo-cp',title:'Repair',priority:'normal',areaId:'foreign'},data.properties,data.areas).includes('area'));
});
test('unknown property and priority rejected',()=>assert.deepEqual(validateTicket({propertyId:'wrong',title:'',priority:'wrong'},[],[]),['property','title','priority']));
test('user wording preserved across locales',()=>assert.equal(label('La llave gotea','en'),'La llave gotea'));
test('communication includes property and address in both languages',()=>{
  for(const lang of ['en','es']){const text=communication({code:'CP-LOCAL-123',title:'Repair',description:'Details'},{name:'Example',street:'Example 1',city:'City'},lang);assert.match(text,/Example 1, City/);assert.match(text,/CP-LOCAL-123/);}
});
test('date respects Mexico City local day rather than UTC',()=>assert.equal(dateOnly(new Date('2026-09-25T03:00:00Z'),'America/Mexico_City'),'2026-09-24'));
test('seed contains no live address or unverified tickets',()=>{const data=seed();assert.equal(data.properties[0].street,'');assert.equal(data.tickets.length,0);assert.equal(data.maintenance[0].due,null);});
