-- ============================================================
-- Platform-wide announcements from Super Admin to School
-- Admins. Deliberately a separate table from `announcements`
-- (school_id not null there, posted by a School Admin to their
-- own staff/students/parents) rather than reusing it with a
-- nullable school_id -- that would mean every existing reader
-- of `announcements` (AdminAnnouncements, ClassTeacher/
-- ShadowTeacher/FinanceManager Announcements pages) would need
-- to learn a new "null school_id means platform-wide" meaning.
-- A dedicated table with its own single reader (the School
-- Admin dashboard) is simpler and safer to reason about.
-- No read-tracking for v1 -- same simplicity level as Curriculum
-- and the global Audit Log, neither of which track per-user
-- read state either.
-- ============================================================

create table platform_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  posted_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table platform_announcements enable row level security;

create policy "temp_allow_all_authenticated" on platform_announcements
  for all to authenticated using (true) with check (true);

create index idx_platform_announcements_created on platform_announcements(created_at desc);
