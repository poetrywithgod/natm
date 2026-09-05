import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { initSentry } from './lib/sentry'
import { registerServiceWorker } from './registerServiceWorker'

initSentry();
registerServiceWorker();

// See student-parent/src/main.tsx for the full explanation -- this
// recovers automatically from a stale-cached index.html referencing a JS
// chunk that no longer exists after a redeploy, which is the most likely
// cause of "blank white screen on some devices, fine on others."
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
