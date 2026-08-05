-- ============================================================
-- Storage bucket for staff (school_admin/class_teacher/shadow_teacher)
-- profile photos. Mirrors student-photos: private bucket, signed
-- URLs only, temp-permissive RLS pattern pending real policies.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'staff-photos',
  'staff-photos',
  false,
  5242880, -- 5MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

create policy "temp_allow_authenticated_read_staff_photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'staff-photos');

create policy "temp_allow_authenticated_upload_staff_photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'staff-photos');

create policy "temp_allow_authenticated_update_staff_photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'staff-photos')
  with check (bucket_id = 'staff-photos');

create policy "temp_allow_authenticated_delete_staff_photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'staff-photos');
