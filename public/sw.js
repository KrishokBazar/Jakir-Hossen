const CACHE_NAME = 'krishok-bazar-admin-v2';

const NETWORK_FIRST_PATHS = [
  '/',
  '/index.html',
  '/version.json',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache the critical shell paths
      return cache.addAll([
        '/',
        '/index.html',
        '/manifest.json'
      ]).catch((err) => {
        console.warn('SW: Pre-caching critical files failed or offline:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('SW: Purging old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new Date(event.request.url);
  const isLocal = url.origin === self.location.origin;

  if (!isLocal) {
    return;
  }

  const path = url.pathname;

  // Let Firestore/REST API bypass Service Worker cache entirely
  if (path.includes('/api/') || path.includes('firestore') || url.hostname.includes('firebase')) {
    return;
  }

  // Network-First Strategy for critical landing, HTML shell, and version configs
  const isNetworkFirst = NETWORK_FIRST_PATHS.some((p) => path === p || path.endsWith(p));

  if (isNetworkFirst) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
  } else {
    // Stale-While-Revalidate for other static media, assets, links, fonts
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Fetch backend update in background to update cache for next load
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, networkResponse);
                });
              }
            })
            .catch(() => {
              // Ignore background update errors
            });
          return cachedResponse;
        }

        return fetch(event.request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        });
      })
    );
  }
});
