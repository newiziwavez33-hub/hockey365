/**
 * Hockey365 Service Worker (Offline PWA & Smart Caching)
 */

const CACHE_NAME = 'hockey365-static-v2';
const STATIC_ASSETS = [
  './',
  'index.html',
  '404.html',
  'assets/css/tokens.css',
  'assets/css/base.css',
  'assets/css/components.css',
  'assets/js/core/config.js',
  'assets/js/core/dom.js',
  'assets/js/core/store.js',
  'assets/js/core/format.js',
  'assets/js/core/i18n.js',
  'assets/js/core/router.js',
  'assets/js/core/api.js',
  'assets/js/components/site-header.js',
  'assets/js/components/site-footer.js',
  'assets/js/components/match-row.js',
  'assets/js/components/standings-table.js',
  'assets/js/components/playoff-bracket.js',
  'assets/js/components/lines-board.js',
  'assets/js/components/datepicker.js',
  'assets/js/components/tabs.js',
  'assets/logos/comp/KHL.svg',
  'assets/logos/comp/NHL.svg',
  'assets/logos/teams/placeholder.svg',
  'data/competitions.json',
  'data/meta.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-first for dynamic live data (/data/matches/)
  if (url.pathname.includes('/data/matches/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      });
    })
  );
});
