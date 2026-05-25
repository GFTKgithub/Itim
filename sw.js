// Satisfies PWA install criteria without intercepting or caching assets
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Pass-through: Force browser to use normal network requests
    event.respondWith(fetch(event.request));
});