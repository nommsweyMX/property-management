// Only static application files are cached. Never cache future authenticated API responses.
const CACHE = 'casa-hq-shell-v3';
const FILES = ['./','./index.html','./styles.css','./app.mjs','./live.mjs','./domain.mjs','./locales.mjs','./store.mjs','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
const ALLOWED = new Set(FILES.map(path => new URL(path, self.registration.scope).href));
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))));
self.addEventListener('activate', event => event.waitUntil(Promise.all([
  caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('casa-hq-shell-') && key !== CACHE).map(key => caches.delete(key)))),
  self.clients.claim()
])));
self.addEventListener('fetch', event => {
  // Navigation requests keep the #route fragment in request.url; the cache and allow-list are keyed without it.
  const url = new URL(event.request.url);url.hash = '';
  if(event.request.method !== 'GET' || url.origin !== self.location.origin || !ALLOWED.has(url.href)) return;
  event.respondWith(fetch(event.request).then(response => {
    if(response.ok) {const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}
    return response;
  }).catch(async () => (await caches.match(event.request)) || new Response('Offline', {status:503})));
});
