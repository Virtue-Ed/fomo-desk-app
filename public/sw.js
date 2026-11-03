/* App shell only. Snapshot JSON and api.github.com are never cached. */
const CACHE = 'grok-desk-shell-v1';

const PRECACHE = [
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        PRECACHE.map(async (path) => {
          try {
            await cache.add(new URL(path, self.registration.scope));
          } catch {
            /* A missing icon should not block the shell. */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.hostname === 'api.github.com') return;
  if (url.pathname.endsWith('/sw.js')) return;
  if (url.pathname.endsWith('snapshot.json') || url.pathname.endsWith('sample-snapshot.json')) return;
  if (url.origin !== self.location.origin) return;

  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request, {
      ignoreSearch: request.mode === 'navigate',
    });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const index = await caches.match(new URL('index.html', self.registration.scope), {
        ignoreSearch: true,
      });
      if (index) return index;
    }
    return new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
