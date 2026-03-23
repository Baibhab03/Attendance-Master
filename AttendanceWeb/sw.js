// const CACHE_NAME = 'attendance-master-v1.3.0.7';

// // List of files to save for offline use
// const ASSETS_TO_CACHE = [
//     './',
//     './attendance.html',
//     './login.html',
//     './signup.html',
//     './account.html',
//     './history.html',
//     './timetable.html',
//     './notification.html',
//     './settings.html',
//     './attendance.css',
//     './account.css',
//     './stylesignup.css',
//     './timetable.css',
//     './attendance.js',
//     './manifest.json',
//     './Icons/icon-512.png',
//     './Icons/icon-192.png',
// ];

// // 1. Install Event: When the app is installed, cache the files
// self.addEventListener('install', event => {
//     event.waitUntil(
//         caches.open(CACHE_NAME).then(cache => {
//             console.log('Installing new service worker...');
//             // Using map + Promise.allSettled ensures installation continues even if a file is missing
//             return Promise.allSettled(
//                 ASSETS_TO_CACHE.map(url => {
//                     return cache.add(url).catch(err => console.warn('Skipping missing file:', url));
//                 })
//             );
//         })
//     );
//     self.skipWaiting();
// });

// // 2. Activate Event: Clean up old versions
// self.addEventListener('activate', event => {
//     event.waitUntil(
//         caches.keys().then(cacheNames => {
//             return Promise.all(
//                 cacheNames.map(cache => {
//                     if (cache !== CACHE_NAME) {
//                         console.log('Removing old cache:', cache);
//                         return caches.delete(cache);
//                     }
//                 })
//             );
//         })
//     );
//     return self.clients.claim();
// });

// // 3. Fetch Event: Intercept requests
// self.addEventListener('fetch', event => {
//     if (event.request.method !== 'GET') return;

//     event.respondWith(
//         caches.match(event.request).then(cachedResponse => {
//             // Return cached version OR fetch from network
//             return cachedResponse || fetch(event.request).catch(() => {
//                 // If both fail (offline and not cached), you could return an offline page here
//             });
//         })
//     );
// });