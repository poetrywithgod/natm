-- ============================================================
-- Allow anonymous (pre-login) reads on schools. Needed so the
-- Student/Parent app's Login screen can show "host school"
-- branding (name/logo/motto) before the user has authenticated.
-- Matches this project's existing temp-permissive RLS pattern.
-- ============================================================
create policy "temp_allow_anon_read_schools" on schools
  for select
  to anon
  using (true);
