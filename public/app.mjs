import {messages} from './locales.mjs';
import {load, save, seed} from './store.mjs';
import {STATUS, PRIORITY, esc, label, isOpen, matches, fullAddress, validateTicket, communication} from './domain.mjs';
import {request,signInButton,signOut,clearSession} from './live.mjs';
let state, installEvent, busy = false, deployment, live = false;
let uiLocale;try{uiLocale=sessionStorage.getItem('casa-locale');}catch{}
uiLocale=uiLocale==='es'?'es':'en';
const lt=(en,es)=> (state?.locale||uiLocale)==='es'?es:en;
const canWrite=()=>!live||state?.role!=='Viewer';
const canManage=()=>!live||['Owner','Manager'].includes(state?.role);
const isOwner=()=>!live||state?.role==='Owner';
const root = document.querySelector('#app');
const t = key => messages[state?.locale ?? 'en'][key] ?? key;
const p = () => state.properties.find(item => item.id === state.currentProperty) ?? state.properties[0];
const forProperty = key => state[key].filter(item => item.propertyId === p().id);
const route = () => location.hash.slice(1).split('/').filter(Boolean);
const localLabel = value => label(value, state.locale);
const symbols = {home:'⌂',tickets:'▤',report:'+',house:'▦',more:'⋯',projects:'↗',maintenance:'◷',assets:'◎',history:'↺',properties:'⌂',contractors:'◇'};
let noticeTimer;
function notify(text) { const box = document.querySelector('#notice'); box.textContent = text; box.className = 'show'; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => {box.className='';box.textContent='';}, 6500); }
function navigate(value) { if (location.hash === `#${value}`) render(); else location.hash = value; }
async function persist(next, message) {
  if(!live) await save(next); // Explicit demo only. Live data is never stored in IndexedDB.
  state=next;uiLocale=next.locale;
  try{sessionStorage.setItem('casa-locale',uiLocale);sessionStorage.setItem('casa-property',state.currentProperty||'');}catch{}
  if(message)notify(message);
}
async function refreshLive(){
  const result=await request('state');let preferred=state?.currentProperty;
  try{preferred ||= sessionStorage.getItem('casa-property');}catch{}
  state={...result.state,locale:uiLocale};
  if(state.properties.some(p=>p.id===preferred))state.currentProperty=preferred;
  render();
}
function outcome(result){
  const partial=result.warnings?.length||result.warning;
  if(partial)notify(lt('Saved. Some photos or history could not be confirmed. Refresh before doing anything again.','Guardado. No se pudo confirmar parte de las fotos o del historial. Actualiza antes de repetir la operación.'));
  else if(['queue_failed','not_configured','no_subscribers'].includes(result.notice?.status))notify(lt('Saved in Airtable. No email was queued.','Guardado en Airtable. No se programó ningún correo.'));
  else notify(lt('Saved in Airtable.','Guardado en Airtable.'));
}
function authScreen(kind,error){
  state=undefined;clearSession();document.title='Casa HQ';document.documentElement.lang=uiLocale==='es'?'es-MX':'en';
  const heading=kind==='setup'?lt('Connect your home','Conecta tu casa'):lt('Your homes. One place.','Tus casas. En un solo lugar.');
  root.innerHTML=`<main class="auth-shell"><div class="wordmark">casa<span>HQ</span></div><section class="panel"><h1>${esc(heading)}</h1><p>${esc(lt('Private property maintenance for your household.','Mantenimiento privado para tus casas.'))}</p>${kind==='setup'?`<p>${esc(lt('This website still needs its server configuration. No private data is exposed and nothing is being saved to Airtable here yet.','Falta configurar el servidor de este sitio. No se muestran datos privados ni se guarda nada en Airtable desde aquí todavía.'))}</p><p class="ticket-code">${esc((deployment?.missing||[]).join(' · '))}</p>`:'<div id="google-sign-in"></div>'}<p id="auth-error" role="alert">${error?esc(errorText(error)):''}</p><div class="form-actions"><button class="secondary" id="auth-retry">${esc(lt('Refresh','Actualizar'))}</button><button class="secondary" id="auth-locale">${uiLocale==='en'?'Español':'English'}</button></div></section></main>`;
  document.querySelector('#auth-retry').onclick=()=>location.reload();
  document.querySelector('#auth-locale').onclick=()=>{uiLocale=uiLocale==='en'?'es':'en';try{sessionStorage.setItem('casa-locale',uiLocale);}catch{}authScreen(kind);};
  if(kind==='signin')signInButton(document.querySelector('#google-sign-in'),deployment.googleClientId,refreshLive,error=>{document.querySelector('#auth-error').textContent=errorText(error);},uiLocale);
}
function errorText(error){
  if(error.status===401)return lt('Please sign in again.','Vuelve a iniciar sesión.');
  if(error.status===403)return lt('This account does not have access to that action or property.','Esta cuenta no tiene acceso a esa acción o propiedad.');
  if(error.status===409)return lt('This record changed. Refresh before editing it again.','Este registro cambió. Actualiza antes de volver a editarlo.');
  if(error.code==='GOOGLE_SCRIPT_BLOCKED')return lt('Google sign-in could not load. Check the connection or content blocker.','No cargó el inicio de sesión de Google. Revisa la conexión o el bloqueador.');
  if(error.code==='CONNECTION_FAILED')return lt('Cannot reach the server. No offline changes were saved.','No se pudo conectar al servidor. No se guardaron cambios sin conexión.');
  return lt('The operation was not confirmed. Refresh to check its result before repeating it.','No se confirmó la operación. Actualiza para revisar el resultado antes de repetirla.');
}
function navLink(key, active, mobile = false) {
  return `<a class="${mobile ? '' : 'nav-item '}${active === key ? 'active ' : ''}${key === 'report' ? 'report-link' : ''}" href="#${key}" ${active === key ? 'aria-current="page"' : ''}><span class="nav-symbol" aria-hidden="true">${symbols[key]}</span><span>${esc(t(key))}</span></a>`;
}
function card(ticket) {
  const area = state.areas.find(a => a.id === ticket.areaId);
  return `<a class="ticket-card" href="#ticket/${encodeURIComponent(ticket.id)}"><div class="ticket-top"><span class="ticket-code">${esc(ticket.code)}</span><span class="badge ${esc(ticket.priority)}">${esc(t(ticket.priority))}</span></div><h3>${esc(localLabel(ticket.title))}</h3><p>${esc(area ? localLabel(area.name) : t('unknown'))}</p><span class="badge">${esc(t(ticket.status))}</span></a>`;
}
function empty(action = true) {return `<div class="panel empty"><span class="empty-mark" aria-hidden="true">+</span><h3>${esc(t('empty'))}</h3><p class="muted">${esc(t('emptyHelp'))}</p>${action ? `<a class="button secondary" href="#report">+ ${esc(t('report'))}</a>` : ''}</div>`;}
function home() {
  const tickets = forProperty('tickets').filter(isOpen);
  return `<section class="hero"><div class="eyebrow">${esc(p().city || t('property'))} · ${esc(p().country)}</div><h1>${esc(t('welcome'))}</h1><p>${esc(t('subtitle'))}</p><a class="button light" href="#report">+ ${esc(t('report'))}</a><div class="arch" aria-hidden="true"></div></section>
  <div class="metrics"><a class="metric" href="#tickets"><span>${esc(t('open'))}</span><strong>${tickets.length}</strong></a><a class="metric" href="#tickets"><span>${esc(t('urgent'))}</span><strong>${tickets.filter(t=>['urgent','emergency'].includes(t.priority)).length}</strong></a><a class="metric" href="#maintenance"><span>${esc(t('upcoming'))}</span><strong>${forProperty('maintenance').length}</strong></a></div>
  <div class="section-head"><h2>${esc(t('recent'))}</h2><a href="#tickets">${esc(t('viewAll'))} →</a></div>${tickets.length ? tickets.slice(-3).reverse().map(card).join('') : empty()}
  <div class="section-head"><h2>${esc(t('house'))}</h2></div><div class="quick-grid">${['projects','maintenance','assets','history','contractors','properties'].map(key=>`<a class="quick" href="#${key}"><span class="nav-symbol" aria-hidden="true">${symbols[key]}</span>${esc(t(key))}</a>`).join('')}</div>`;
}
function ticketsPage() {
  return `<h1 class="page-title">${esc(t('tickets'))}</h1><p class="page-sub muted">${esc(p().name)}</p><a class="button" href="#report">+ ${esc(t('report'))}</a><div class="filters"><input id="search" aria-label="${esc(t('search'))}" placeholder="${esc(t('search'))}" type="search"><select id="statusFilter" aria-label="${esc(t('filter'))}"><option value="">${esc(t('allStatus'))}</option>${STATUS.map(s=>`<option value="${s}">${esc(t(s))}</option>`).join('')}</select></div><div id="ticket-list"></div>`;
}
function updateTicketList() {
  const query = document.querySelector('#search')?.value ?? '';
  const status = document.querySelector('#statusFilter')?.value ?? '';
  const tickets = forProperty('tickets').filter(item=>!status || item.status === status).filter(item=> {
    const area = state.areas.find(a=>a.id === item.areaId);
    return matches([localLabel(item.title),localLabel(item.description),area ? localLabel(area.name) : '',item.code].join(' '),query);
  }).reverse();
  document.querySelector('#ticket-list').innerHTML = tickets.length ? tickets.map(card).join('') : empty();
}
function reportPage() {
  return `<h1 class="page-title">${esc(t('report'))}</h1><p class="page-sub muted">${esc(p().name)} · ${esc(t('original'))}</p><form id="ticket-form" class="panel form-panel"><label for="photos">${esc(t('photos'))}</label><input id="photos" name="photos" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple><small>${esc(t('photoHelp'))}</small><div id="preview" class="photo-preview"></div><label for="title">${esc(t('title'))}</label><input id="title" name="title" required maxlength="160" placeholder="${esc(t('placeholderTitle'))}"><div class="field-grid"><div><label for="area">${esc(t('area'))}</label><select id="area" name="areaId"><option value="">${esc(t('unknown'))}</option>${forProperty('areas').map(a=>`<option value="${esc(a.id)}">${esc(localLabel(a.name))}</option>`).join('')}</select></div><div><label for="priority">${esc(t('priority'))}</label><select id="priority" name="priority">${PRIORITY.map(key=>`<option value="${key}" ${key==='normal'?'selected':''}>${esc(t(key))}</option>`).join('')}</select></div></div><label for="description">${esc(t('description'))} · ${esc(t('optional'))}</label><textarea id="description" name="description" maxlength="5000" placeholder="${esc(t('placeholderDescription'))}"></textarea><div class="form-actions"><button class="primary" type="submit">${esc(t('save'))}</button><a class="button secondary" href="#home">${esc(t('cancel'))}</a></div></form>`;
}
function detail(id) {
  const ticket = forProperty('tickets').find(item=>item.id===id);
  if(!ticket) return empty();
  const history = forProperty('history').filter(item=>item.ticketId===id).reverse();
  const area = state.areas.find(a=>a.id===ticket.areaId);
  return `<a class="text-link" href="#tickets">← ${esc(t('back'))}</a><h1 class="page-title">${esc(localLabel(ticket.title))}</h1><p class="ticket-code">${esc(ticket.code)}</p><small>${esc(live?lt('Shared issue ID','Folio compartido'):t('localCode'))}</small><div class="section-head"><span class="badge ${esc(ticket.priority)}">${esc(t(ticket.priority))}</span><span class="muted">${esc(area?localLabel(area.name):t('unknown'))}</span></div><div class="panel"><p class="detail-description">${esc(localLabel(ticket.description))}</p><div class="photos">${(ticket.photos??[]).map(photo=>`<img src="${esc(photo.data)}" alt="${esc(photo.name)}" loading="lazy">`).join('')}</div><label for="ticket-status">${esc(t('status'))}</label><select id="ticket-status" data-ticket="${esc(id)}" ${canManage()?'':'disabled'}>${STATUS.map(s=>`<option value="${s}" ${s===ticket.status?'selected':''}>${esc(t(s))}</option>`).join('')}</select><div class="form-actions"><button class="secondary" id="share" data-ticket="${esc(id)}">${esc(t('share'))}</button></div><small>${esc(t('manualShare'))}</small><details><summary>${esc(t('workOrder'))}</summary><pre class="work-order">${esc(communication(ticket,p(),state.locale))}</pre></details></div><div class="section-head"><h2>${esc(t('history'))}</h2></div><div class="panel"><form id="note-form" data-ticket="${esc(id)}"><fieldset ${canWrite()?'':'disabled'}><label for="note">${esc(t('note'))}</label><textarea id="note" name="note" maxlength="5000" required></textarea><div class="form-actions"><button class="primary">${esc(t('saveNote'))}</button></div></fieldset></form>${history.length?history.map(item=>`<div class="history-item"><small>${esc(new Intl.DateTimeFormat(state.locale==='es'?'es-MX':'en-US',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.date)))}</small><p>${esc(item.kind==='status'?`${t('status')}: ${t(item.status)}`:item.text)}</p></div>`).join(''):`<p class="muted">${esc(t('noChanges'))}</p>`}</div>`;
}
function housePage() {
  return `<h1 class="page-title">${esc(t('house'))}</h1><p class="page-sub muted">${esc(p().name)}</p><div class="subnav"><a class="active" href="#house">${esc(t('area'))}</a><a href="#assets">${esc(t('assets'))}</a></div><div class="area-grid">${forProperty('areas').map(a=>`<div class="area-card"><h3>${esc(localLabel(a.name))}</h3><small>${forProperty('tickets').filter(t=>t.areaId===a.id&&isOpen(t)).length} ${esc(t('open'))}</small><p><a href="#report">+ ${esc(t('report'))}</a></p></div>`).join('')}</div>`;
}
function collectionPage(key) {
  const items = forProperty(key);
  return `<h1 class="page-title">${esc(t(key))}</h1><p class="page-sub muted">${esc(p().name)}</p>${key==='maintenance'?`<p class="muted">${esc(t('upcomingText'))}</p>`:''}${items.length?items.map(item=>`<div class="ticket-card"><h3>${esc(localLabel(item.title??item.name??item.text??(item.kind==='status'?t(item.status):'')))}</h3><small>${esc(key==='maintenance'&&!live?t('exampleTask'):t('linked'))}</small>${key==='maintenance'?`<p>${esc(item.due??t('notScheduled'))}</p>`:''}</div>`).join(''):empty(false)}`;
}
function morePage() {
  return `<h1 class="page-title">${esc(t('more'))}</h1><div class="quick-grid">${['properties','projects','maintenance','assets','history','contractors'].map(key=>`<a class="quick" href="#${key}"><span class="nav-symbol" aria-hidden="true">${symbols[key]}</span>${esc(t(key))}</a>`).join('')}</div><div class="section-head"><h2>${esc(t('settings'))}</h2></div><div class="panel">${live&&isOwner()?`<p><a class="button secondary" href="#team">${esc(lt('People & notices','Personas y avisos'))}</a></p>`:''}<button class="secondary" id="export">${esc(t('export'))}</button><p class="muted">${esc(live?lt('Download the records currently visible to your account. Keep the export private.','Descarga los registros visibles para tu cuenta. Mantén privada la exportación.'):t('exportHelp'))}</p><p class="muted">${esc(live?lt('Private data stays out of browser offline storage. Exports contain only what this account can access.','Los datos privados no se guardan sin conexión en el navegador. Las exportaciones solo contienen lo autorizado para esta cuenta.'):t('localPrivacy'))}</p><p class="muted">${esc(live?lt('Google sign-in and shared Airtable records. Access is limited to approved accounts and properties.','Inicio de sesión con Google y registros compartidos en Airtable. Acceso limitado a cuentas y propiedades autorizadas.'):t('roadmap'))}</p><p class="muted">${esc(t('themeNote'))}</p>${installEvent?`<button class="primary" id="install">${esc(t('install'))}</button>`:''}<p class="footnote">${esc(t('installHelp'))}</p></div>`;
}
function propertiesPage() {
  return `<h1 class="page-title">${esc(t('properties'))}</h1>${state.properties.map(item=>`<div class="ticket-card"><h3>${esc(item.name)}</h3><p>${esc(fullAddress(item))}</p>${item.id==='demo-cp'?`<small>${esc(t('noAddress'))}</small>`:''}<div class="form-actions"><button class="secondary select-property" data-property="${esc(item.id)}">${esc(t('viewAll'))} →</button></div></div>`).join('')}<div class="section-head"><h2>${esc(t('addProperty'))}</h2></div>${state.properties.length<4&&isOwner()?`<form id="property-form" class="panel form-panel"><div class="field-grid">${[['propertyName','name',true],['code','code',true],['country','country'],['state','state'],['city','city'],['neighborhood','neighborhood'],['address','street'],['postalCode','postalCode']].map(([key,name,required])=>`<div><label for="p-${name}">${esc(t(key))}</label><input id="p-${name}" name="${name}" maxlength="${name==='code'?8:180}" ${required?'required':''} ${name==='code'?'pattern="[A-Za-z0-9]{1,8}"':''}></div>`).join('')}</div><label for="p-color">${esc(t('theme'))}</label><input id="p-color" name="color" type="color" value="#254b40"><div class="form-actions"><button class="primary">${esc(t('save'))}</button></div></form>`:`<p>${esc(t('maxProperties'))}</p>`}`;
}
function render() {
  if(!state) return;
  if(!state.properties.length){
    root.innerHTML=`<main class="auth-shell"><h1>Casa HQ</h1><p>${esc(lt('No properties are assigned to this account.','No hay propiedades asignadas a esta cuenta.'))}</p><button id="empty-logout" class="secondary">${esc(lt('Sign out','Cerrar sesión'))}</button></main>`;
    document.querySelector('#empty-logout').onclick=async()=>{await signOut();authScreen('signin');};return;
  }
  const [section='home',id] = route();
  const active = ['ticket','tickets'].includes(section)?'tickets':section;
  document.documentElement.lang = state.locale==='es'?'es-MX':'en';
  document.documentElement.style.setProperty('--primary', /^#[0-9a-f]{6}$/i.test(p().color)?p().color:'#254b40');
  document.title = `${p().name} · Casa HQ`;
  let view;
  if(section==='home') view=home(); else if(section==='tickets') view=ticketsPage(); else if(section==='report') view=canWrite()?reportPage():`<div class="panel">${esc(lt('Read-only account.','Cuenta de solo lectura.'))}</div>`;
  else if(section==='ticket') view=detail(decodeURIComponent(id??'')); else if(section==='house') view=housePage();
  else if(section==='properties') view=propertiesPage(); else if(['maintenance','projects','assets','history','contractors'].includes(section)) view=collectionPage(section); else if(section==='team'&&live&&isOwner())view=teamPage();else view=morePage();
  root.innerHTML=`<div class="layout"><aside class="sidebar"><a class="wordmark" href="#home">casa<span>HQ</span></a><div class="brand-sub">${esc(t('brand'))}</div><nav aria-label="Navigation">${['home','tickets','house','more'].map(k=>navLink(k,active)).join('')}</nav><div class="sidebar-bottom">${esc(live?lt('Private shared workspace','Espacio privado compartido'):t('privacy'))}<br><br>EN / ES-MX · v0.2</div></aside><div class="content"><header class="topbar"><div class="property-picker"><span class="monogram" aria-hidden="true">${esc(p().code)}</span><select id="property-switch" aria-label="${esc(t('property'))}">${state.properties.map(item=>`<option value="${esc(item.id)}" ${item.id===p().id?'selected':''}>${esc(item.name)}</option>`).join('')}</select></div><div class="top-actions">${live?`<button class="locale" id="refresh" aria-label="${esc(lt('Refresh','Actualizar'))}">↻</button><button class="locale" id="logout">${esc(lt('Sign out','Salir'))}</button>`:''}<span class="pill" id="connectivity">${esc(t(navigator.onLine?'online':'offline'))}</span><button class="locale" id="locale" aria-label="Change language / Cambiar idioma">${state.locale==='en'?'ES / EN':'EN / ES'}</button></div></header><div class="prototype"><strong>${esc(live?lt('Airtable connected','Airtable conectado'):t('prototype'))}</strong>${esc(live?`${state.user.email} · ${state.role}`:t('demoNotice'))}</div><main id="main" tabindex="-1">${view}</main><p class="footnote">${esc(live?lt('Shared data. Updates require an internet connection.','Datos compartidos. Se requiere conexión para guardar cambios.'):t('demoNotice'))}</p></div><nav class="bottom-nav" aria-label="Navigation">${['home','tickets','report','house','more'].map(k=>navLink(k,active,true)).join('')}</nav></div>`;
  bind(); if(section==='tickets') updateTicketList();if(section==='team'&&isOwner())loadTeam().catch(e=>notify(errorText(e)));
}
async function safely(fn) { if(busy)return; busy=true;try {await fn();}catch(error){
  if(live&&error.status===401)authScreen('signin',error);
  else notify(live?errorText(error):t('storageError'));
}finally{busy=false;} }
function bind() {
  document.querySelector('#refresh')?.addEventListener('click',()=>safely(refreshLive));
  document.querySelector('#logout')?.addEventListener('click',()=>safely(async()=>{await signOut();authScreen('signin');}));
  document.querySelector('#member-form')?.addEventListener('submit',event=>{event.preventDefault();safely(async()=>{
    const values=new FormData(event.target);
    await request('members',{method:'POST',data:{email:String(values.get('email')).trim(),role:String(values.get('role')),properties:values.getAll('propertyIds'),notices:values.has('receiveNotices'),language:String(values.get('language'))}});
    event.target.reset();await loadTeam();notify(lt('Access added. Share the site address with this person.','Acceso agregado. Comparte la dirección del sitio con esta persona.'));
  });});
  document.querySelector('#locale').onclick=()=>safely(async()=>{const next=structuredClone(state);next.locale=state.locale==='en'?'es':'en';await persist(next);render();});
  document.querySelector('#property-switch').onchange=e=>safely(async()=>{const next=structuredClone(state);next.currentProperty=e.target.value;await persist(next);navigate('home');});
  document.querySelectorAll('.select-property').forEach(button=>button.onclick=()=>safely(async()=>{const next=structuredClone(state);next.currentProperty=button.dataset.property;await persist(next);navigate('home');}));
  document.querySelector('#search')?.addEventListener('input',updateTicketList);
  document.querySelector('#statusFilter')?.addEventListener('change',updateTicketList);
  const photoInput=document.querySelector('#photos');
  photoInput?.addEventListener('change',async()=>{try{const photos=await readPhotos(photoInput.files);document.querySelector('#preview').innerHTML=photos.map(photo=>`<img src="${esc(photo.data)}" alt="${esc(photo.name)}">`).join('');}catch{photoInput.value='';document.querySelector('#preview').replaceChildren();notify(t('photoError'));}});
  document.querySelector('#ticket-form')?.addEventListener('submit',event=>{event.preventDefault();safely(async()=>{
    const form=event.target, values=new FormData(form), ticket={id:crypto.randomUUID(),propertyId:p().id,title:String(values.get('title')).trim(),description:String(values.get('description')).trim(),areaId:String(values.get('areaId')),priority:String(values.get('priority')),status:'new',createdAt:new Date().toISOString()};
    if(validateTicket(ticket,state.properties,state.areas).length){notify(t('invalid'));return;}
    try{ticket.photos=await readPhotos(form.elements.photos.files);}catch{notify(t('photoError'));return;}
    if(live){const result=await request('tickets',{method:'POST',data:ticket});await refreshLive();navigate(`ticket/${result.ticket.id}`);outcome(result);return;}
    ticket.code=`${p().code}-LOCAL-${ticket.id.slice(0,8).toUpperCase()}`;
    const next=structuredClone(state);next.tickets.push(ticket);await persist(next,t('created'));navigate(`ticket/${ticket.id}`);
  });});
  document.querySelector('#ticket-status')?.addEventListener('change',event=>safely(async()=>{
    const next=structuredClone(state), ticket=next.tickets.find(t=>t.id===event.target.dataset.ticket&&t.propertyId===p().id);
    if(!ticket||!STATUS.includes(event.target.value))return;
    if(live){const result=await request(`tickets/${ticket.id}`,{method:'PATCH',data:{status:event.target.value,revision:ticket.revision}});await refreshLive();outcome(result);return;}
    ticket.status=event.target.value;next.history.push({id:crypto.randomUUID(),propertyId:p().id,ticketId:ticket.id,kind:'status',status:ticket.status,date:new Date().toISOString()});
    await persist(next,t('updated'));render();
  }));
  document.querySelector('#note-form')?.addEventListener('submit',event=>{event.preventDefault();safely(async()=>{
    const text=String(new FormData(event.target).get('note')).trim();if(!text){notify(t('addNoteFirst'));return;}
    if(live){const result=await request(`tickets/${event.target.dataset.ticket}/notes`,{method:'POST',data:{text}});await refreshLive();outcome(result);return;}
    const next=structuredClone(state);next.history.push({id:crypto.randomUUID(),propertyId:p().id,ticketId:event.target.dataset.ticket,text,date:new Date().toISOString()});await persist(next,t('updated'));render();
  });});
  document.querySelector('#share')?.addEventListener('click',async event=>{
    const ticket=forProperty('tickets').find(t=>t.id===event.target.dataset.ticket);if(!ticket)return;
    const text=communication(ticket,p(),state.locale);
    try {if(navigator.share)await navigator.share({title:localLabel(ticket.title),text});else{await navigator.clipboard.writeText(text);notify(t('copied'));}}catch(error){if(error.name!=='AbortError')notify(t('shareFailed'));}
  });
  document.querySelector('#property-form')?.addEventListener('submit',event=>{event.preventDefault();safely(async()=>{
    if(state.properties.length>=4){notify(t('maxProperties'));return;}
    const values=new FormData(event.target),property=Object.fromEntries([...values.entries()].map(([k,v])=>[k,String(v).trim()]));
    if(!property.name||!/^[a-z0-9]{1,8}$/i.test(property.code)||!/^#[0-9a-f]{6}$/i.test(property.color))return;
    if(live){const result=await request('properties',{method:'POST',data:property});await refreshLive();if(state.properties.some(p=>p.id===result.id))state.currentProperty=result.id;navigate('home');notify(t('addSuccess'));return;}
    property.code=property.code.toUpperCase();property.id=crypto.randomUUID();property.currency='MXN';property.timeZone='America/Mexico_City';
    const next=structuredClone(state);next.properties.push(property);next.currentProperty=property.id;await persist(next,t('addSuccess'));navigate('home');
  });});
  document.querySelector('#export')?.addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`casa-hq-private-backup-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify(t('backupReady'));
  });
  document.querySelector('#install')?.addEventListener('click',async()=>{if(installEvent){await installEvent.prompt();await installEvent.userChoice;installEvent=null;render();}});
}
function teamPage(){
  return `<h1 class="page-title">${esc(lt('People & notices','Personas y avisos'))}</h1><p>${esc(lt('Only approved Google accounts can sign in. This form grants access; it does not send an invitation email.','Solo pueden entrar las cuentas de Google autorizadas. Este formulario da acceso; no envía un correo de invitación.'))}</p><div id="member-list" class="panel">${esc(lt('Loading…','Cargando…'))}</div><form id="member-form" class="panel form-panel"><h2>${esc(lt('Grant access','Dar acceso'))}</h2><label for="member-email">Email</label><input type="email" id="member-email" name="email" required maxlength="254"><label for="member-role">${esc(lt('Role','Permiso'))}</label><select name="role" id="member-role"><option value="Viewer">${esc(lt('Viewer — read only','Consulta — solo lectura'))}</option><option value="Reporter">${esc(lt('Reporter — report and add notes','Reportes — crear reportes y notas'))}</option><option value="Manager">${esc(lt('Manager — manage work','Administración — gestionar trabajos'))}</option></select><fieldset><legend>${esc(t('properties'))}</legend>${state.properties.map(p=>`<label class="check-row"><input type="checkbox" name="propertyIds" value="${esc(p.id)}"> ${esc(p.name)}</label>`).join('')}</fieldset><label for="member-language">${esc(lt('Notice language','Idioma de los avisos'))}</label><select name="language" id="member-language"><option value="en">English</option><option value="es">Español (México)</option></select><label class="check-row"><input type="checkbox" name="receiveNotices"> ${esc(lt('Send notices for these properties','Enviar avisos de estas propiedades'))}</label><div class="form-actions"><button class="primary">${esc(lt('Grant access','Dar acceso'))}</button></div></form><section class="panel"><h2>${esc(lt('Email notices','Avisos por correo'))}</h2><p>${esc(deployment.features.notifications?lt('Sender is configured. Provider delivery still requires successful authorization.','El remitente está configurado. La entrega requiere que la autorización del proveedor funcione.'):lt('Sender is not configured. Tickets can be saved without sending email.','El remitente no está configurado. Los reportes se pueden guardar sin enviar correo.'))}</p><p id="delivery-status"></p></section>`;
}
async function loadTeam(){
  const {members}=await request('members');const box=document.querySelector('#member-list');if(!box)return;
  box.innerHTML=members.map(m=>`<div class="history-item"><strong>${esc(m.email)}</strong><p>${esc(m.role)} · ${esc(m.active?lt('Active','Activo'):lt('Disabled','Desactivado'))}</p>${m.active&&m.role!=='Owner'?`<button class="secondary revoke-member" data-id="${esc(m.id)}">${esc(lt('Revoke access','Quitar acceso'))}</button>`:''}</div>`).join('');
  box.querySelectorAll('.revoke-member').forEach(button=>button.onclick=()=>safely(async()=>{await request(`members/${button.dataset.id}/revoke`,{method:'POST',data:{}});await loadTeam();}));
  const counts=await request('notifications');const status=document.querySelector('#delivery-status');if(status)status.textContent=Object.entries(counts.counts||{}).map(([key,n])=>`${key}: ${n}`).join(' · ')||lt('No queued notices.','No hay avisos en cola.');
}
async function readPhotos(fileList) {
  const files=[...fileList];
  if(files.length>3||files.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>3*1024*1024))throw new Error('Invalid photos');
  return Promise.all(files.map(file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(reader.error);reader.onload=()=>resolve({name:file.name,data:String(reader.result)});reader.readAsDataURL(file);})));
}
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installEvent=event;});
for(const event of ['online','offline'])window.addEventListener(event,()=>{const el=document.querySelector('#connectivity');if(el)el.textContent=t(navigator.onLine?'online':'offline');});
try{
  deployment=await request('config');live=deployment.mode!=='demo';
  if(!live){state=await load();if(!state){state=seed();await save(state);}render();}
  else if(!deployment.ready)authScreen('setup');
  else try{await refreshLive();}catch(error){if(error.status===401)authScreen('signin');else authScreen('error',error);}
}catch(error){root.innerHTML=`<main class="auth-shell"><h1>Casa HQ</h1><p>${esc(lt('The server is unavailable. This app has not switched to offline demo data.','El servidor no está disponible. La app no cambió a datos de demostración.'))}</p><button id="retry" class="secondary">${esc(lt('Refresh','Actualizar'))}</button></main>`;document.querySelector('#retry').onclick=()=>location.reload();}
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{ /* Local data remains usable even when installation is unavailable. */ });
