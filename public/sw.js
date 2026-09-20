/**
 * Offline shell for Kartograf.
 *
 * Only same-origin GETs are touched: map tiles and geocoding are somebody
 * else's bandwidth and change independently, so they are left to the network
 * and the browser's own HTTP cache.
 *
 * Navigations go network-first — after a deploy the freshest index.html wins,
 * and only a genuinely offline visit falls back to the cached shell. Hashed
 * build assets are immutable, so those are served cache-first.
 */
const CACHE = 'kartograf-shell-v2';
const SHELL = '/index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function putInCache(request, response) {
  if (!response || !response.ok || response.type === 'opaque') return;
  const cache = await caches.open(CACHE);
  await cache.put(request, response);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          // waitUntil keeps the worker alive for the write: without it the
          // browser is free to shut it down the moment the response is
          // handed back, and the cache stays empty
          event.waitUntil(putInCache(request, response.clone()));
          return response;
        } catch {
          return (
            (await caches.match(request)) ?? (await caches.match(SHELL)) ?? Response.error()
          );
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const hit = await caches.match(request);
      if (hit) return hit;
      const response = await fetch(request);
      event.waitUntil(putInCache(request, response.clone()));
      return response;
    })()
  );
});
