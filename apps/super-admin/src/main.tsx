import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

// See apps/staff and apps/student-parent's main.tsx for the full
// rationale -- recovers automatically from a stale-cached index.html
// referencing a JS chunk that no longer exists after a redeploy.
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
