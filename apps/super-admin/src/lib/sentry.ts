import * as Sentry from "@sentry/react";

// No-ops entirely when VITE_SENTRY_DSN isn't set -- lets this roll out
// per-app/per-environment independently (e.g. local dev never needs a
// DSN) without erroring or silently no-op-reporting to a shared project.
// Set VITE_SENTRY_DSN in Vercel's project env vars (and .env.local for
// local dev, if desired) once the Sentry project for this app exists.
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Performance tracing only, no session replay -- this is about
    // catching real errors and slow requests, not recording sessions.
    tracesSampleRate: 0.1,
  });
}
