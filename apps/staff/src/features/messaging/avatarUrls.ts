import { supabase } from "../../lib/supabase";

// Profile photos live in private buckets (parents in parent-photos, every
// staff role in staff-photos) and are shown through short-lived signed URLs.
// URLs are cached per path so a busy chat doesn't re-sign the same photo for
// every message.
const SIGNED_TTL_SECONDS = 3600;
const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const cache = new Map<string, { url: string | null; expires: number }>();
const inflight = new Map<string, Promise<string | null>>();

function bucketFor(role: string): string {
  return role === "parent" ? "parent-photos" : "staff-photos";
}

export function getAvatarUrl(role: string, path: string): Promise<string | null> {
  const key = `${role === "parent" ? "p" : "s"}:${path}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.url);
  const pending = inflight.get(key);
  if (pending) return pending;

  const request = supabase.storage
    .from(bucketFor(role))
    .createSignedUrl(path, SIGNED_TTL_SECONDS)
    .then(({ data, error }) => {
      const url = error ? null : data.signedUrl;
      // A failed lookup is remembered briefly so we don't hammer the API.
      const ttl = url ? SIGNED_TTL_SECONDS * 1000 - REFRESH_MARGIN_MS : 60_000;
      cache.set(key, { url, expires: Date.now() + ttl });
      return url;
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, request);
  return request;
}
