// Only static application files are cached. Never cache future authenticated API responses.
const CACHE = 'casa-hq-shell-v2';
const FILES = ['./','./index.html','./styles.css','./app.mjs','./live.mjs','./domain.mjs','./locales.mjs','./store.mjs','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
const ALLOWED = new Set(FILES.map(path => new URL(path, self.registration.scope).href));
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))));
self.addEventListener('activate', event => event.waitUntil(Promise.all([
  caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('casa-hq-shell-') && key !== CACHE).map(key => caches.delete(key)))),
  self.clients.claim()
])));
self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin || !ALLOWED.has(event.request.url)) return;
  event.respondWith(fetch(event.request).then(response => {
    if(response.ok) {const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}
    return response;
  }).catch(async () => (await caches.match(event.request)) || new Response('Offline', {status:503})));
});
