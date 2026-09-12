const CACHE_NAME = 'mes-mots-v2';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './data-en.js',
  './data-es.js',
  './manifest.json',
  './icon.svg',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Réseau d'abord pour voir les mises à jour tout de suite,
// cache en secours pour rester utilisable hors ligne.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Les appels de sauvegarde ne passent jamais par le cache
  if (new URL(e.request.url).hostname.includes('api.github.com')) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
