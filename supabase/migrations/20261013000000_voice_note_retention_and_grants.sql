-- ============================================================
-- Follow-up to 20261012000000_pta_chat_and_voice_notes.sql
--
-- 1. API GRANTS (fix)
--    This project's config no longer auto-exposes new tables/functions
--    to the Data API roles. The previous migration created pta_groups,
--    pta_messages and pta_read_state (and several helper functions)
--    without explicit GRANTs, so the API roles could not touch them even
--    though the RLS policies were correct. RLS still decides WHICH rows;
--    these grants only let the roles reach the tables at all.
--
-- 2. VOICE-NOTE RETENTION
--    Voice notes are kept on the server for a limited time (30 days, see
--    the purge-voice-notes edge function); after that the audio file is
--    deleted and the message is marked with audio_deleted_at. Each
--    device keeps its own copy of notes it has played or sent, so people
--    can still listen to them after the server copy is gone. The message
--    row (and its audio_path / duration) stays, so the thread history and
--    the "voice note" bubble are unchanged -- only the audio is gone.
-- ============================================================


-- ---------- 1. Grants ----------

grant select on pta_groups to authenticated;
grant select, insert, delete on pta_messages to authenticated;
grant select, insert, update, delete on pta_read_state to authenticated;

-- Edge functions (send-push, purge-voice-notes) run as service_role.
grant all on pta_groups, pta_messages, pta_read_state to service_role;

grant execute on function app_dm_valid(uuid, uuid, uuid, text, uuid, uuid) to authenticated;
grant execute on function app_is_dm_participant(uuid) to authenticated;
grant execute on function app_can_view_dm(uuid) to authenticated;
grant execute on function app_is_pta_group_member(uuid) to authenticated;
grant execute on function app_chat_audio_access(text, boolean) to authenticated;
grant execute on function get_pta_members(uuid) to authenticated;
grant execute on function get_pta_overview() to authenticated;


-- ---------- 2. Voice-note retention ----------

alter table messages add column if not exists audio_deleted_at timestamptz;
alter table pta_messages add column if not exists audio_deleted_at timestamptz;

-- The purge job looks for old notes whose audio hasn't been removed yet.
create index if not exists idx_messages_audio_to_purge
  on messages (created_at)
  where audio_path is not null and audio_deleted_at is null;

create index if not exists idx_pta_messages_audio_to_purge
  on pta_messages (created_at)
  where audio_path is not null and audio_deleted_at is null;
