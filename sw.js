// Offline support: precache the whole app, serve from cache, refresh in the background.
// Regenerated on every build — the version changes whenever any file changes.
const VERSION = 'garage-6841abfdb4';
const ASSETS = [
  "./",
  "icon-180.png",
  "icon-512.png",
  "icon.svg",
  "index.html",
  "manifest.webmanifest",
  "bikes/honda.webp",
  "css/app.css",
  "fonts/barlow-condensed-latin-700-italic.woff2",
  "fonts/barlow-condensed-latin-700-normal.woff2",
  "fonts/barlow-condensed-latin-800-italic.woff2",
  "fonts/barlow-condensed-latin-900-italic.woff2",
  "fonts/barlow-latin-400-normal.woff2",
  "fonts/barlow-latin-500-normal.woff2",
  "fonts/barlow-latin-600-normal.woff2",
  "js/app.js",
  "js/bikeart.js",
  "js/core.js",
  "js/derive.js",
  "js/hourtrack.js",
  "js/modals.js",
  "js/schedule.js",
  "js/store.js",
  "js/util.js",
  "js/pages/garage.js",
  "js/pages/laps.js",
  "js/pages/service.js",
  "js/pages/settings.js",
  "js/pages/stats.js",
  "js/pages/timeline.js",
  "vendor/preact-htm.js"
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
