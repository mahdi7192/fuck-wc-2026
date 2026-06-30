const CACHE_NAME = 'football-box-image-cache-v1';

// Domains we want to ensure are cached, though we catch all image destinations
const TARGET_DOMAINS = [
  'a.espncdn.com',
  'api.dicebear.com',
  'crests.football-data.org'
];

self.addEventListener('install', (event) => {
  // Activate service worker immediately without waiting for existing clients to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Clean up old caches and claim clients immediately
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Cache only GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Determine if this request is for an image
  const isImageDestination = request.destination === 'image';
  const isImageExtension = /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(url.pathname);
  const isTargetDomain = TARGET_DOMAINS.some(domain => url.hostname.includes(domain));

  if (isImageDestination || isImageExtension || isTargetDomain) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          // Fetch from network to get the latest version and update the cache in the background
          const fetchPromise = fetch(request)
            .then((networkResponse) => {
              // We cache successful responses (status 200) or opaque responses (status 0) from external CDNs
              if (networkResponse.status === 200 || networkResponse.type === 'opaque') {
                cache.put(request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch((err) => {
              // Fail silently for background fetches if user is offline
              console.log('Background fetch failed for image:', request.url, err);
            });

          // Return cached response instantly if available, fallback to network fetch
          return cachedResponse || fetchPromise;
        });
      })
    );
  }
});
