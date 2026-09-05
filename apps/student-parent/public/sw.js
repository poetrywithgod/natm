// NATM (Student/Parent) service worker.
//
// Scope: (1) makes the app installable as a PWA, (2) serves a basic
// offline fallback page for navigations when the network is unreachable,
// and (3) handles push notifications for student and parent accounts.
// This file previously didn't exist even though subscribe.ts already
// called navigator.serviceWorker.register('/sw.js') -- push setup was
// silently failing on registration for this app until now.
//
// Deliberately NOT precaching hashed build assets (the /assets/*.js and
// *.css files Vite emits) -- those filenames change on every deploy, and
// a stale service-worker cache of them is exactly the kind of "blank
// screen after redeploy" bug already fixed once in main.tsx via the
// vite:preloadError listener. This worker only ever caches the tiny,
// rarely-changing shell below and always prefers a live network response.
const CACHE_NAME = 'natm-student-parent-shell-v1';
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

// -- Push notifications --------------------------------------------------

self.addEventListener('push', function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'NATM', body: event.data ? event.data.text() : '' };
  }

  var title = data.title || 'NATM Notification';
  var options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf(targetUrl) !== -1 && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
