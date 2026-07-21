// GlamTrack Service Worker — v2 (modular build)
const CACHE_VERSION = 'glamtrack-v3';

const STATIC_ASSETS = [
  './',
  './index.html',
  './constants.js',
  './errorMailer.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './modules/state.js',
  './modules/main.js',
  './modules/db.js',
  './modules/ui.js',
  './modules/auth.js',
  './modules/dashboard.js',
  './modules/catalog.js',
  './modules/customers.js',
  './modules/allotment.js',
  './modules/visits.js',
  './modules/refresh.js',
  './vendor/bootstrap.min.css',
  './vendor/bootstrap.bundle.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      return Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(err => {
          console.warn('[SW] Failed to cache:', url, err);
        }))
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isFirebase = url.hostname.includes('firebaseio.com')
    || url.hostname.includes('firestore.googleapis.com')
    || url.hostname.includes('identitytoolkit.googleapis.com')
    || url.hostname.includes('securetoken.googleapis.com')
    || url.hostname.includes('firebase.googleapis.com');

  if (isFirebase) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then(networkResponse => {
        if (event.request.method === 'GET' && networkResponse &&
            networkResponse.status === 200 && networkResponse.type !== 'opaque') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      }).catch(() => {
        if (event.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
