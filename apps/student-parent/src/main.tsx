import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { initSentry } from './lib/sentry'

initSentry();

// Vite's dynamic import()s (all our lazy-loaded routes) fail if the
// browser has an old cached copy of index.html referencing a hashed JS
// chunk that no longer exists on the server after a redeploy -- this is
// almost certainly what "blank white screen on some devices" was: those
// devices had the login page cached from before a deploy, and the failed
// import crashed the whole render with nothing shown and no user-facing
// error. Vite fires this event specifically for that failure mode; one
// guarded reload fetches a fresh index.html (with correct chunk
// references) and recovers automatically. The sessionStorage guard stops
// an infinite reload loop if the failure is something else entirely.
window.addEventListener('vite:preloadError', () => {
  if (sessionStorage.getItem('reloaded-after-chunk-error')) return;
  sessionStorage.setItem('reloaded-after-chunk-error', '1');
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
