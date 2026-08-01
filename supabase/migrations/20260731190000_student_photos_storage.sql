-- ============================================================
-- Storage bucket for student profile photos
-- Mirrors the "temp permissive" RLS pattern used on the DB tables:
-- authenticated-only access for now, to be tightened to real
-- per-role/per-school policies before production.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-photos',
  'student-photos',
  false,
  5242880, -- 5MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

create policy "temp_allow_authenticated_read_student_photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'student-photos');

create policy "temp_allow_authenticated_upload_student_photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'student-photos');

create policy "temp_allow_authenticated_update_student_photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'student-photos')
  with check (bucket_id = 'student-photos');

create policy "temp_allow_authenticated_delete_student_photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'student-photos');
