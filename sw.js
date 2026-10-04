/**
 * Hockey365 Service Worker (Offline PWA & Smart Network-First Caching v1.8.2)
 * Always loads the newest assets over network, falling back to cache if offline.
 * This guarantees the user NEVER needs to press Ctrl+F5 to see updates.
 */

const CACHE_NAME = 'hockey365-' + encodeURIComponent(self.registration.scope) + '-v1-8-2';
const STATIC_ASSETS = [
  './',
  'index.html',
  '404.html',
  'assets/css/tokens.css',
  'assets/css/base.css',
  'assets/css/components.css',
  'assets/css/event-player.css',
  'assets/icons/hockey365.svg',
  'assets/js/core/config.js',
  'assets/js/core/dom.js',
  'assets/js/core/store.js',
  'assets/js/core/format.js',
  'assets/js/core/i18n.js',
  'assets/js/core/router.js',
  'assets/js/core/api.js',
  'assets/js/core/feed-status.js',
  'assets/js/core/khl-feed.js',
  'assets/js/core/profile-links.js',
  'assets/js/components/event-player.js',
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
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && (key.startsWith('hockey365-' + encodeURIComponent(self.registration.scope)) || /^hockey365-v/.test(key))) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const scopePath = new URL(self.registration.scope).pathname;

  // Never supply cached official/live API responses after a network outage.
  // Otherwise an old score could be labelled as freshly obtained from NHL.
  if (url.origin !== self.location.origin ||
      url.pathname.startsWith(scopePath + 'api/') ||
      event.request.cache === 'no-store' || url.searchParams.has('_t')) return;

  // Network-First for HTML, Scripts, Styles and JSON data
  // Ensures fresh updates on reload without Ctrl+F5
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache if offline
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
