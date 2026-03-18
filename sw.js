// sw.js (Service Worker)

const CACHE_NAME = 'readverse-v1';
const urlsToCache = [
  './',
  './index.html',
  './css/style.css',
  './css/home.css',
  './js/components.js',
  './js/app.js'
];

// Install Service Worker and Cache files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetching from Cache when offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
  );
});
