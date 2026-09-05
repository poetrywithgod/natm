// Registers the PWA service worker (public/sw.js) on page load. This is
// what makes the app installable (Chrome's install-prompt criteria require
// a registered service worker with a fetch handler, in addition to the
// manifest) and gets the offline fallback active immediately, rather than
// only once a user opts into push notifications via registerPushSubscription.
//
// Production-only and guarded by feature-detection: registering an SW
// against Vite's dev server adds noise/caching behavior nobody wants while
// iterating locally.
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  });
}
