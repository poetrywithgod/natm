-- ============================================================
-- Homeschool teacher requests
-- ============================================================
-- A homeschool family asks NATM for a teacher from the teacher pool.
-- The family's parent files the request from the parent app; Super
-- Admin sees open requests next to the pool and fulfils them by
-- assigning a pool teacher (which marks the request matched).
-- ============================================================

create table teacher_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  requested_by uuid not null references profiles(id) on delete cascade,
  status text not null default 'open'
    check (status in ('open', 'matched', 'cancelled')),
  children_info text not null,          -- how many children, ages / levels
  preferred_start_date date,
  schedule text,                        -- days and hours the family wants
  location text,                        -- where teaching happens / area
  special_needs text,                   -- support needs the teacher should know
  notes text,
  pool_teacher_id uuid references teacher_pool(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_teacher_requests_status on teacher_requests (status, created_at desc);
create index idx_teacher_requests_school on teacher_requests (school_id);
-- One open request per family at a time.
create unique index teacher_requests_one_open_per_school
  on teacher_requests (school_id) where status = 'open';

alter table teacher_requests enable row level security;

-- Super Admin: everything.
create policy "teacher_requests_super_admin" on teacher_requests
  for all to authenticated
  using (app_is_super_admin())
  with check (app_is_super_admin());

-- A parent sees their own family's requests...
create policy "teacher_requests_parent_select" on teacher_requests
  for select to authenticated
  using (
    app_role() = 'parent'
    and app_school_id() = school_id
  );

-- ...files a new one for their own homeschool family...
create policy "teacher_requests_parent_insert" on teacher_requests
  for insert to authenticated
  with check (
    app_role() = 'parent'
    and requested_by = auth.uid()
    and app_school_id() = school_id
    and status = 'open'
    and exists (select 1 from schools s where s.id = school_id and s.school_type = 'homeschool')
  );

-- ...and may withdraw an open one (and nothing else about it).
create policy "teacher_requests_parent_cancel" on teacher_requests
  for update to authenticated
  using (
    app_role() = 'parent'
    and app_school_id() = school_id
    and status = 'open'
  )
  with check (
    app_role() = 'parent'
    and app_school_id() = school_id
    and status = 'cancelled'
  );
