-- ============================================================
-- REPLACE STORAGE BUCKET PLACEHOLDER POLICIES WITH REAL ONES
-- ============================================================
-- Follow-up to 20260923185710_real_rls_policies.sql, which explicitly
-- deferred this: every storage bucket (student/staff/parent photos,
-- lesson PDFs, news images, school logos, curriculum PDFs) has carried
-- a "temp_allow_authenticated_*" (or, for school-logos/curriculum-pdfs,
-- an entirely unscoped "Authenticated users can ...") policy since its
-- own first migration -- any authenticated user, any school, could
-- read and write every object in every one of these buckets.
--
-- Reuses the exact same app_school_id() / app_is_super_admin() /
-- app_is_school_staff() / app_can_staff_write() / app_is_linked_parent()
-- / app_is_own_student() helper functions the table-RLS migration
-- already defined (schema-qualified, not redefined).
--
-- A few of these bucket policies need to check students/lessons/
-- profiles/parent_student_links data that isn't captured by those
-- existing helpers alone. Those checks are wrapped in their own new
-- SECURITY DEFINER + STABLE helper functions below, for the exact
-- reason the original migration's own comment gives for doing the
-- same thing: querying those tables directly from inside a storage
-- policy would otherwise also run through THEIR OWN RLS policies as
-- the calling (authenticated) role, not just the condition written
-- here. In every case below that would have happened to filter to
-- the same result anyway (the app-table policies encode equivalent
-- logic), but that's incidental, not guaranteed, and exactly the kind
-- of fragility the security-definer pattern exists to remove.
--
-- storage.foldername(name) returns an object's path split into an
-- array of its folder segments (filename excluded), 1-indexed -- e.g.
-- for 'abc/def/file.jpg' it returns ARRAY['abc','def'].
-- ============================================================


-- ============================================================
-- STORAGE-SPECIFIC HELPER FUNCTIONS
-- ============================================================

-- SELECT-time check for student-photos: is this exact stored path a
-- real student's current photo, and can the caller see that student?
create or replace function app_student_photo_visible(photo_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from students s
    where s.photo_url = photo_path
      and (app_can_staff_write(s.school_id) or app_is_linked_parent(s.id) or app_is_own_student(s.id))
  )
$$;

-- Write-time (insert/update) check for student-photos: does the
-- claimed student_id genuinely belong to the claimed school_id (so
-- the path can't be forged to point at another school), and can the
-- caller write that student's data?
create or replace function app_student_photo_writable(claimed_school_id uuid, claimed_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from students s
    where s.id = claimed_student_id
      and s.school_id = claimed_school_id
      and (app_can_staff_write(s.school_id) or app_is_own_student(s.id))
  )
$$;

-- Delete-time check for student-photos: staff-only (no client flow
-- ever deletes a student's photo object directly; matches the
-- original placeholder's authenticated-only delete being narrowed
-- down, not widened).
create or replace function app_student_photo_deletable(claimed_school_id uuid, claimed_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from students s
    where s.id = claimed_student_id
      and s.school_id = claimed_school_id
      and app_can_staff_write(s.school_id)
  )
$$;

-- SELECT-time check for staff-photos: self, any same-school colleague,
-- or super_admin.
create or replace function app_staff_photo_visible(owner_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select owner_profile_id = auth.uid()
    or app_is_super_admin()
    or exists (select 1 from profiles p where p.id = owner_profile_id and p.school_id = app_school_id())
$$;

-- SELECT-time check for parent-photos: self, super_admin, or staff at
-- a school where this parent has a linked child.
create or replace function app_parent_photo_visible(owner_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select owner_profile_id = auth.uid()
    or app_is_super_admin()
    or (
      app_is_school_staff()
      and exists (
        select 1 from parent_student_links pl
        join students s on s.id = pl.student_id
        where pl.parent_id = owner_profile_id and s.school_id = app_school_id()
      )
    )
$$;

-- SELECT-time check for lesson-pdfs: this exact stored path belongs
-- to a real lesson, and the caller is either staff at that lesson's
-- school or a student/parent currently in that lesson's class.
create or replace function app_lesson_pdf_visible(pdf_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from lessons l
    where l.pdf_storage_path = pdf_path
      and (
        app_can_staff_write(l.school_id)
        or exists (
          select 1 from students s
          where s.class_id = l.class_id
            and (app_is_own_student(s.id) or app_is_linked_parent(s.id))
        )
      )
  )
$$;


-- ============================================================
-- STUDENT-PHOTOS (private) -- path convention: {school_id}/{student_id}/...
-- ============================================================

drop policy if exists "temp_allow_authenticated_read_student_photos" on storage.objects;
drop policy if exists "temp_allow_authenticated_upload_student_photos" on storage.objects;
drop policy if exists "temp_allow_authenticated_update_student_photos" on storage.objects;
drop policy if exists "temp_allow_authenticated_delete_student_photos" on storage.objects;

create policy "student_photos_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'student-photos' and app_student_photo_visible(name));

create policy "student_photos_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'student-photos'
    and app_student_photo_writable((storage.foldername(name))[1]::uuid, (storage.foldername(name))[2]::uuid)
  );

create policy "student_photos_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'student-photos'
    and app_student_photo_writable((storage.foldername(name))[1]::uuid, (storage.foldername(name))[2]::uuid)
  )
  with check (
    bucket_id = 'student-photos'
    and app_student_photo_writable((storage.foldername(name))[1]::uuid, (storage.foldername(name))[2]::uuid)
  );

create policy "student_photos_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'student-photos'
    and app_student_photo_deletable((storage.foldername(name))[1]::uuid, (storage.foldername(name))[2]::uuid)
  );


-- ============================================================
-- STAFF-PHOTOS (private) -- path convention: {profile_id}/... (shared
-- by the staff app and the super-admin app -- super_admin accounts
-- have no school_id, so this can't be school-prefixed the way
-- student-photos is). Write is always self-upload in the app code.
-- ============================================================

drop policy if exists "temp_allow_authenticated_read_staff_photos" on storage.objects;
drop policy if exists "temp_allow_authenticated_upload_staff_photos" on storage.objects;
drop policy if exists "temp_allow_authenticated_update_staff_photos" on storage.objects;
drop policy if exists "temp_allow_authenticated_delete_staff_photos" on storage.objects;

create policy "staff_photos_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'staff-photos' and app_staff_photo_visible((storage.foldername(name))[1]::uuid));

create policy "staff_photos_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'staff-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "staff_photos_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'staff-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'staff-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "staff_photos_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'staff-photos' and (storage.foldername(name))[1] = auth.uid()::text);


-- ============================================================
-- PARENT-PHOTOS (private) -- path convention: {profile_id}/..., same
-- shape as staff-photos.
-- ============================================================

drop policy if exists "temp_allow_authenticated_read_parent_photos" on storage.objects;
drop policy if exists "temp_allow_authenticated_upload_parent_photos" on storage.objects;
drop policy if exists "temp_allow_authenticated_update_parent_photos" on storage.objects;
drop policy if exists "temp_allow_authenticated_delete_parent_photos" on storage.objects;

create policy "parent_photos_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'parent-photos' and app_parent_photo_visible((storage.foldername(name))[1]::uuid));

create policy "parent_photos_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'parent-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "parent_photos_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'parent-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'parent-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "parent_photos_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'parent-photos' and (storage.foldername(name))[1] = auth.uid()::text);


-- ============================================================
-- LESSON-PDFS (private) -- path convention: {school_id}/{class_id}/...
-- No update policy: the app never overwrites a lesson PDF object in
-- place (same as before this migration).
-- ============================================================

drop policy if exists "temp_allow_authenticated_read_lesson_pdfs" on storage.objects;
drop policy if exists "temp_allow_authenticated_upload_lesson_pdfs" on storage.objects;
drop policy if exists "temp_allow_authenticated_delete_lesson_pdfs" on storage.objects;

create policy "lesson_pdfs_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'lesson-pdfs' and app_lesson_pdf_visible(name));

create policy "lesson_pdfs_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'lesson-pdfs' and app_can_staff_write((storage.foldername(name))[1]::uuid));

create policy "lesson_pdfs_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'lesson-pdfs' and app_can_staff_write((storage.foldername(name))[1]::uuid));


-- ============================================================
-- NEWS-IMAGES (public bucket -- reads go through the public-URL
-- endpoint and never hit these policies; only writes need scoping).
-- Path convention: {school_id}/...
-- ============================================================

drop policy if exists "temp_allow_authenticated_upload_news_images" on storage.objects;
drop policy if exists "temp_allow_authenticated_update_news_images" on storage.objects;
drop policy if exists "temp_allow_authenticated_delete_news_images" on storage.objects;

create policy "news_images_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'news-images' and app_can_staff_write((storage.foldername(name))[1]::uuid));

create policy "news_images_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'news-images' and app_can_staff_write((storage.foldername(name))[1]::uuid))
  with check (bucket_id = 'news-images' and app_can_staff_write((storage.foldername(name))[1]::uuid));

create policy "news_images_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'news-images' and app_can_staff_write((storage.foldername(name))[1]::uuid));


-- ============================================================
-- SCHOOL-LOGOS (public bucket). Path convention: {school_id}/...
-- Previously ANY authenticated user, any school, could overwrite any
-- other school's logo -- the old policies checked bucket_id only.
-- "Anyone can view school logos" is already correct/intentional
-- (public bucket, deliberately world-readable) and is left alone.
-- ============================================================

drop policy if exists "Authenticated users can upload school logos" on storage.objects;
drop policy if exists "Authenticated users can update school logos" on storage.objects;

create policy "school_logos_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'school-logos' and app_can_staff_write((storage.foldername(name))[1]::uuid));

create policy "school_logos_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'school-logos' and app_can_staff_write((storage.foldername(name))[1]::uuid))
  with check (bucket_id = 'school-logos' and app_can_staff_write((storage.foldername(name))[1]::uuid));


-- ============================================================
-- CURRICULUM-PDFS (public bucket). Global content, not tenant-scoped
-- -- Super Admin only, per the product design. Previously ANY
-- authenticated user, any school, could upload/replace/delete ANY
-- curriculum PDF platform-wide -- the old policies checked bucket_id
-- only. "Anyone can view curriculum PDFs" is already correct/
-- intentional and is left alone.
-- ============================================================

drop policy if exists "Authenticated users can upload curriculum PDFs" on storage.objects;
drop policy if exists "Authenticated users can update curriculum PDFs" on storage.objects;
drop policy if exists "Authenticated users can delete curriculum PDFs" on storage.objects;

create policy "curriculum_pdfs_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'curriculum-pdfs' and app_is_super_admin());

create policy "curriculum_pdfs_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'curriculum-pdfs' and app_is_super_admin())
  with check (bucket_id = 'curriculum-pdfs' and app_is_super_admin());

create policy "curriculum_pdfs_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'curriculum-pdfs' and app_is_super_admin());
