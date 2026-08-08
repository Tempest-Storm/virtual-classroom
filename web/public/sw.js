// Passthrough service worker. Its only job is to exist with a fetch handler,
// which is what makes the app installable ("Add to Home Screen"). It does not
// cache — the app needs the live backend, so offline caching would only serve
// stale data.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* let the network handle it */ });
