import type { createSupabaseClient } from "./client";

type Client = ReturnType<typeof createSupabaseClient>;

export const VOICE_NOTE_BUCKET = "chat-voice-notes";
// Hard cap on one recording. The database also enforces 5 minutes; the
// UI stops earlier so a note stays a quick message, not a lecture.
export const VOICE_NOTE_MAX_MS = 180_000;
// Anything shorter is almost certainly an accidental tap on the mic.
export const VOICE_NOTE_MIN_MS = 800;
// How long the server keeps a voice note's audio before the daily purge
// deletes it. Keep in sync with the purge-voice-notes edge function.
export const VOICE_NOTE_RETENTION_DAYS = 15;
// Start warning people that a note they haven't saved is about to go.
export const VOICE_NOTE_EXPIRY_WARNING_DAYS = 3;

export interface RecorderFormat {
  /** Full MIME type handed to MediaRecorder (may include codecs). */
  mime: string;
  /** MIME type without parameters -- what storage's allow-list checks. */
  base: string;
  ext: string;
}

// Order matters: Chrome/Firefox/Android give webm+opus; Safari (iOS and
// macOS) only records mp4/AAC.
const CANDIDATES: RecorderFormat[] = [
  { mime: "audio/webm;codecs=opus", base: "audio/webm", ext: "webm" },
  { mime: "audio/webm", base: "audio/webm", ext: "webm" },
  { mime: "audio/mp4", base: "audio/mp4", ext: "m4a" },
  { mime: "audio/ogg;codecs=opus", base: "audio/ogg", ext: "ogg" },
];

export function canRecordVoiceNotes(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}

export function pickRecorderFormat(): RecorderFormat | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const candidate of CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate.mime)) return candidate;
  }
  return null;
}

/** Maps whatever MIME type a recorder actually produced to an allowed format. */
export function formatFromMime(mimeType: string): RecorderFormat {
  const base = mimeType.split(";")[0].trim().toLowerCase();
  const known = CANDIDATES.find((c) => c.base === base);
  return known ?? CANDIDATES[0];
}

// ---------------------------------------------------------------
// On-device copies
//
// The server only keeps a voice note for VOICE_NOTE_RETENTION_DAYS. To
// keep listening after that, each device saves its own copy in
// IndexedDB: automatically for notes you send, and for notes you play
// (and, in direct conversations, for notes that arrive). Copies live
// in the browser's storage on that device -- they are not synced and
// are lost if the browser data is cleared.
// ---------------------------------------------------------------

const CACHE_DB = "natm-voice-notes";
const CACHE_STORE = "notes";

interface CachedNote {
  path: string;
  blob: Blob;
  savedAt: number;
}

function openCache(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(CACHE_DB, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(CACHE_STORE, { keyPath: "path" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T | undefined> {
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(undefined);
  });
}

let persistRequested = false;
// Ask the browser not to evict our saved notes under storage pressure.
// Best effort; some browsers decide on their own (installed PWAs usually win).
function requestPersistentStorage() {
  if (persistRequested) return;
  persistRequested = true;
  try {
    void navigator.storage?.persist?.();
  } catch {
    /* not supported */
  }
}

export async function hasVoiceNoteOnDevice(path: string): Promise<boolean> {
  const db = await openCache();
  if (!db) return false;
  try {
    const key = await requestToPromise(
      db.transaction(CACHE_STORE, "readonly").objectStore(CACHE_STORE).getKey(path)
    );
    return key !== undefined;
  } catch {
    return false;
  } finally {
    db.close();
  }
}

async function readVoiceNote(path: string): Promise<Blob | null> {
  const db = await openCache();
  if (!db) return null;
  try {
    const record = await requestToPromise<CachedNote | undefined>(
      db.transaction(CACHE_STORE, "readonly").objectStore(CACHE_STORE).get(path)
    );
    return record?.blob ?? null;
  } catch {
    return null;
  } finally {
    db.close();
  }
}

/** Saves a copy on this device. Never throws -- a failed save just means no local copy. */
export async function saveVoiceNoteOnDevice(path: string, blob: Blob): Promise<boolean> {
  const db = await openCache();
  if (!db) return false;
  requestPersistentStorage();
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(CACHE_STORE, "readwrite");
      tx.objectStore(CACHE_STORE).put({ path, blob, savedAt: Date.now() } satisfies CachedNote);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = tx.onabort = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}

export class VoiceNoteExpiredError extends Error {
  constructor() {
    super("This voice note has expired and isn't saved on this device.");
    this.name = "VoiceNoteExpiredError";
  }
}

/**
 * Returns a playable blob: this device's copy if there is one, otherwise
 * downloads it from the server (and keeps a copy). `serverCopyGone` says
 * the purge job has already deleted the server file.
 */
export async function getVoiceNoteBlob(client: Client, path: string, serverCopyGone: boolean): Promise<Blob> {
  const local = await readVoiceNote(path);
  if (local) return local;
  if (serverCopyGone) throw new VoiceNoteExpiredError();

  const { data, error } = await client.storage.from(VOICE_NOTE_BUCKET).download(path);
  if (error || !data) throw new Error(error?.message ?? "Could not load voice note");
  await saveVoiceNoteOnDevice(path, data);
  return data;
}

/** Quietly saves a copy of a note we don't have yet. Used for notes that arrive in direct chats. */
export async function prefetchVoiceNote(client: Client, path: string): Promise<void> {
  try {
    if (await hasVoiceNoteOnDevice(path)) return;
    const { data } = await client.storage.from(VOICE_NOTE_BUCKET).download(path);
    if (data) await saveVoiceNoteOnDevice(path, data);
  } catch {
    /* best effort */
  }
}

/** Whole days until the server deletes a note sent at `createdAt` (0 = today). */
export function daysUntilVoiceNoteExpires(createdAt: string, now: number = Date.now()): number {
  const expiresAt = new Date(createdAt).getTime() + VOICE_NOTE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000)));
}

// ---------------------------------------------------------------
// Upload / paths
// ---------------------------------------------------------------

export type VoiceNoteScope = {
  kind: "dm" | "pta";
  schoolId: string;
  /** conversation id for "dm", group id for "pta" */
  ownerId: string;
};

export function buildVoiceNotePath(scope: VoiceNoteScope, ext: string): string {
  return `${scope.schoolId}/${scope.kind}/${scope.ownerId}/${crypto.randomUUID()}.${ext}`;
}

export interface VoiceNoteUpload {
  blob: Blob;
  durationMs: number;
  base: string;
  ext: string;
}

/** Uploads the recording, keeps a copy on this device, and returns the stored path. */
export async function uploadVoiceNote(
  client: Client,
  scope: VoiceNoteScope,
  recording: VoiceNoteUpload
): Promise<string> {
  const path = buildVoiceNotePath(scope, recording.ext);
  const { error } = await client.storage
    .from(VOICE_NOTE_BUCKET)
    .upload(path, recording.blob, { contentType: recording.base, upsert: false });
  if (error) throw new Error(error.message);
  await saveVoiceNoteOnDevice(path, recording.blob);
  return path;
}

export function formatVoiceDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
