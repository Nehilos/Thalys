const CACHE_NAME = 'thalys-shell-v0.51.0';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './Thalys Logo Dark.png?v=22',
  './Thalys Logo Light.png?v=22',
  './Loto.png?v=22',
  './male.svg?v=0510',
  './female.svg?v=0510',
  './assets/icons/thalys-app-icon-black.png',
  './css/thalys.css?v=0510',
  './js/tailwind-config.js?v=015',
  './js/theme-bootstrap.js?v=015',
  './js/config.js?v=0510',
  './js/capabilities.js?v=0510',
  './js/device-media.js?v=0510',
  './js/backend-bridge.js?v=0510',
  './js/server-auth.js?v=0510',
  './js/notifications.js?v=0510',
  './js/storage-manager.js?v=0510',
  './js/sync-queue.js?v=0510',
  './js/conflict-resolver.js?v=0510',
  './js/local-db.js?v=0510',
  './js/ui-foundation.js?v=0510',
  './js/language.js?v=0510',
  './js/drive.js?v=0510',
  './js/auth.js?v=0510',
  './js/app-core.js?v=0510',
  './js/body.js?v=0510',
  './js/meditation.js?v=0510',
  './js/nutrition.js?v=0510',
  './js/workout.js?v=0510',
  './js/home.js?v=0510',
  './js/analytics.js?v=0510',
  './js/oauth-ui.js?v=015',
  './js/media-tools.js?v=025',
  './js/pwa-register.js?v=015',
  './js/app-enhancements.js?v=0510',
  './js/runtime-health.js?v=0510',
  './lang/lang_it.json?v=23',
  './lang/lang_en.json?v=23',
  './lang/lang_es.json?v=23',
  './lang/lang_pt.json?v=23',
  './lang/lang_ro.json?v=23'
];

const EXTERNAL_ASSETS = [
  'https://cdn.tailwindcss.com/',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/@zxing/library@0.19.1/umd/index.min.js',
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

const CACHEABLE_EXTERNAL_ORIGINS = new Set([
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net',
  'https://cdnjs.cloudflare.com'
]);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled([...APP_SHELL, ...EXTERNAL_ASSETS].map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('thalys-shell-') && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isLocal = url.origin === self.location.origin;
  const isCacheableExternal = CACHEABLE_EXTERNAL_ORIGINS.has(url.origin);
  if ((!isLocal && !isCacheableExternal) || (isLocal && url.pathname.startsWith('/api/'))) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok || response.type === 'opaque') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        let cached = await caches.match(request);
        // v0.37.8: local visual assets may have a version query that changed while the
        // device was offline. Fall back to the cached same-path asset instead of
        // rendering a broken/empty image.
        if (!cached && isLocal) cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return Response.error();
      })
  );
});


// v0.48.2 - notification/push client foundation. Remote push delivery requires a server subscription endpoint.
self.addEventListener('push', event => {
  let payload={};
  try{payload=event.data?event.data.json():{};}catch(_){payload={body:event.data?event.data.text():''};}
  const title=payload.title||'Thalys';
  const options={body:payload.body||'',tag:payload.tag||'thalys-push',data:{url:payload.url||'./',...(payload.data||{})}};
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target=event.notification?.data?.url||'./';
  event.waitUntil((async()=>{
    const list=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of list){try{await client.focus();if('navigate' in client)await client.navigate(target);return;}catch(_){}}
    return self.clients.openWindow(target);
  })());
});
