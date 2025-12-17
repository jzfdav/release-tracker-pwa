const CACHE_NAME = 'release-tracker-v1';

// Install Event
self.addEventListener('install', event => {
    console.log('Service Worker: Installed');
    // Skip waiting to activate immediately
    self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', event => {
    console.log('Service Worker: Activated');
    // Claim clients to take control immediately
    event.waitUntil(clients.claim());
});
