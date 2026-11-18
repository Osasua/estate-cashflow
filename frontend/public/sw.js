/* Ferrano Court Portal — app-shell service worker.
 *
 * Caching policy:
 *  - app shell ('/', manifest, icons): precached, network-first with cached
 *    fallback so the app OPENS with no connection and still picks up deploys;
 *  - hashed static assets (js/css/images): stale-while-revalidate;
 *  - /api/* : NEVER cached — financial data must always be live; the app's
 *    own offline write-queue handles mutations made without connectivity.
 */
const CACHE = 'fcp-shell-v1';
const SHELL = ['/', '/manifest.webmanifest', '/favicon.png', '/ferrano-logo.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                  // never intercept writes/replays
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;  // no third-party caching
  if (url.pathname.startsWith('/api/')) return;     // money data: network only

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((cached) => {
      const refresh = fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => cached);
      return cached || refresh;
    })
  );
});
