-- ============================================================
-- Parent Settings/Profile support.
--
-- profiles.phone/address: parent's own contact info (parent identity
-- lives on profiles, not a students-style child table).
-- profiles.must_change_password: sends a parent through a forced
-- first-login password screen even if they end up signing in with the
-- admin-generated temporary password (e.g. the recovery email hasn't
-- arrived yet -- Supabase's default email sending is rate-limited).
-- The happy path is the recovery email itself, which requires no gate
-- since the parent can't reach the app without setting their own
-- password first.
-- parent_student_links.relationship: free-text (e.g. "Mother",
-- "Father", "Guardian") -- useful context for staff when a student has
-- more than one linked parent/guardian.
-- ============================================================

alter table profiles
  add column phone text,
  add column address text,
  add column must_change_password boolean not null default false;

alter table parent_student_links
  add column relationship text;

-- Storage bucket for parent profile photos. Mirrors staff-photos /
-- student-photos: private bucket, signed URLs only, temp-permissive
-- RLS pattern pending real policies (same convention as the rest of
-- this project's storage buckets).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'parent-photos',
  'parent-photos',
  false,
  5242880, -- 5MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

create policy "temp_allow_authenticated_read_parent_photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'parent-photos');

create policy "temp_allow_authenticated_upload_parent_photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'parent-photos');

create policy "temp_allow_authenticated_update_parent_photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'parent-photos')
  with check (bucket_id = 'parent-photos');

create policy "temp_allow_authenticated_delete_parent_photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'parent-photos');
