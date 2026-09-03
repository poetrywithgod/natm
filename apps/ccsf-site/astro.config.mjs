import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import sentry from "@sentry/astro";
import tailwindcss from "@tailwindcss/vite";

// Same no-DSN-means-no-op approach as the other 3 apps -- SENTRY_DSN is a
// plain Node env var here (this file runs at build time, not in the
// browser), set in Vercel's project env vars once this app's Sentry
// project exists. Source map upload (for readable stack traces on
// minified prod errors) needs a SENTRY_AUTH_TOKEN too, which none of the
// 4 apps have wired up yet -- a reasonable follow-up once that exists,
// left out here to keep all 4 apps at the same setup depth for now.
const sentryDsn = process.env.SENTRY_DSN;

export default defineConfig({
  site: "https://cherrieschildren.org",
  integrations: [
    react(),
    sitemap(),
    ...(sentryDsn ? [sentry({ dsn: sentryDsn, tracesSampleRate: 0.1 })] : []),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
