const CACHE_NAME = 'attendance-master-v1';

// List of files to save for offline use
const ASSETS_TO_CACHE = [
    './',
    './attendance.html',
    './login.html',
    './signup.html',
    './account.html',
    './history.html',
    './timetable.html',
    './notification.html',
    './settings.html',
    './attendance.css',
    './account.css',
    './signup.css',
    './timetable.css',
    './attendance.js',
    './manifest.json',
    './Icons/icon-512.png',
    './Icons/icon-192.png',
];

// 1. Install Event: When the app is installed, cache the files
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('Caching core assets...');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// 2. Activate Event: Clears out old caches if you update your app
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('Clearing old cache...');
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// 3. Fetch Event: When the app asks for a file, check the cache first!
self.addEventListener('fetch', event => {
    // Only cache GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            // If the file is in the cache, return it instantly!
            if (cachedResponse) {
                return cachedResponse;
            }
            // Otherwise, go fetch it from the internet
            return fetch(event.request);
        })
    );
});