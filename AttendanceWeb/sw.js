const CACHE_NAME = 'attendance-master-v3.1.0.7';

// List all the core files your app needs to run the UI
const ASSETS_TO_CACHE = [
    './',
    './login.html',
    './signup.html',
    './attendance.html',
    './timetable.html',
    './history.html',
    './account.html',
    './settings.html',
    './attendance.css',
    './account.css',
    './history.css',
    './settings.css',
    './attendance.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[Service Worker] Caching App Core Assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Clearing Old Cache');
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET' || 
        event.request.url.includes('firestore') || 
        event.request.url.includes('firebase') || 
        event.request.url.includes('googleapis')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then(networkResponse => {
                return networkResponse;
            }).catch(() => {
                console.log('[Service Worker] Fetch failed; returning offline page instead.');
            });
        })
    );
});
