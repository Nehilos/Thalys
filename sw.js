const CACHE_NAME = 'thalys-shell-v0.24';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './assets/icons/thalys-app-icon-black.png',
  './css/thalys.css?v=024',
  './js/tailwind-config.js?v=015',
  './js/theme-bootstrap.js?v=015',
  './js/local-db.js?v=023',
  './js/ui-foundation.js?v=023',
  './js/google-auth.js?v=023',
  './js/drive.js?v=023',
  './js/app-core.js?v=021',
  './js/oauth-ui.js?v=015',
  './js/media-tools.js?v=020',
  './js/pwa-register.js?v=015',
  './js/app-enhancements.js?v=021',
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
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return Response.error();
      })
  );
});
