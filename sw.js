const CACHE_NAME = 'itim-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/src/app.js',
    '/manifest.json',
    '/src/style.css',
    'icons/itim-icon-192.png',
    'icons/itim-icon-512.png'
];

// Install: Cache core layout shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
});

// Activate: Clear out old cache buckets
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.map((key) => {
                if (key !== CACHE_NAME) return caches.delete(key);
            })
        ))
    );
});

// Fetch Strategy
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Return cached asset if found
            if (cachedResponse) {
                return cachedResponse;
            }

            // Otherwise fetch from network, cache it for next time, and return it
            return fetch(event.request).then((networkResponse) => {
                // Check if it's a valid local asset we want to cache (like our own JS files)
                if (networkResponse.status === 200 && event.request.url.startsWith(self.location.origin)) {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Offline fallback logic here if needed
            });
        })
    );
});