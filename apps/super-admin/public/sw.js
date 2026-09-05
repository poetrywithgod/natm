// NATM Super Admin service worker.
//
// Scope: makes the app installable as a PWA and serves a basic offline
// fallback page for navigations when the network is unreachable. This
// app has no push-notification feature, so unlike apps/staff and
// apps/student-parent there are no 'push' / 'notificationclick' handlers
// here -- add them if that changes.
//
// Deliberately NOT precaching hashed build assets (the /assets/*.js and
// *.css files Vite emits) -- those filenames change on every deploy, and
// a stale service-worker cache of them is exactly the kind of "blank
// screen after redeploy" bug already fixed once in main.tsx via the
// vite:preloadError listener. This worker only ever caches the tiny,
// rarely-changing shell below and always prefers a live network response.
const CACHE_NAME = 'natm-super-admin-shell-v1';
const OFFLINE_URL = '/offline.html';
const SHELL_ASSETS = [OFFLINE_URL, '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Only intercept page navigations. Everything else (JS/CSS chunks, API
  // calls to Supabase, fonts, etc.) goes straight to the network exactly
  // as if this worker didn't exist.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((res) => res || Response.error()))
    );
  }
});
