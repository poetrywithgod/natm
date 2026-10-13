import { createClient } from 'jsr:@supabase/supabase-js@2';

// Deletes voice-note audio files older than the retention window and marks
// their messages (audio_deleted_at). The message rows stay -- only the audio
// goes. Meant to run once a day from a scheduler; it is not called by the
// apps. Protected by a shared secret header, not a user JWT, so deploy it
// with --no-verify-jwt.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET');
// Keep in sync with VOICE_NOTE_RETENTION_DAYS in packages/supabase/src/voiceNotes.ts
// (the apps use it to show "expires in N days").
const RETENTION_DAYS = Number(Deno.env.get('VOICE_NOTE_RETENTION_DAYS') ?? '15');

const BUCKET = 'chat-voice-notes';
const TABLES = ['messages', 'pta_messages'] as const;
const BATCH_SIZE = 100;
// Bounded so one run can't go on forever; the next day's run picks up the rest.
const MAX_BATCHES_PER_TABLE = 20;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }
  if (!Number.isFinite(RETENTION_DAYS) || RETENTION_DAYS < 1) {
    return json({ error: 'Invalid VOICE_NOTE_RETENTION_DAYS' }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const purged: Record<string, number> = { messages: 0, pta_messages: 0 };
  const errors: string[] = [];

  for (const table of TABLES) {
    for (let batch = 0; batch < MAX_BATCHES_PER_TABLE; batch++) {
      const { data: rows, error: selectError } = await supabase
        .from(table)
        .select('id, audio_path')
        .not('audio_path', 'is', null)
        .is('audio_deleted_at', null)
        .lt('created_at', cutoff)
        .order('created_at', { ascending: true })
        .limit(BATCH_SIZE);

      if (selectError) {
        errors.push(`${table}: ${selectError.message}`);
        break;
      }
      if (!rows || rows.length === 0) break;

      // Remove the files first. Only mark messages as purged once the files
      // are really gone, so a failed run is simply retried tomorrow.
      const paths = rows.map((r) => r.audio_path as string);
      const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths);
      if (removeError) {
        errors.push(`${table}: could not remove files: ${removeError.message}`);
        break;
      }

      const { error: updateError } = await supabase
        .from(table)
        .update({ audio_deleted_at: new Date().toISOString() })
        .in('id', rows.map((r) => r.id));
      if (updateError) {
        errors.push(`${table}: could not mark messages: ${updateError.message}`);
        break;
      }

      purged[table] += rows.length;
      if (rows.length < BATCH_SIZE) break;
    }
  }

  return json({ retention_days: RETENTION_DAYS, cutoff, purged, errors }, errors.length ? 500 : 200);
});
