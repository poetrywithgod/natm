-- ============================================================
-- NATM teacher pool
-- ============================================================
-- Vetted, NATM-trained teachers kept at platform level by Super Admin.
-- A pool teacher is not part of any tenant until Super Admin assigns
-- them to a homeschool family; assignment makes them that tenant's
-- homeschool_teacher, and unassigning ends their access again.
-- Super Admin only: pool rows hold contact details and vetting notes.
-- ============================================================

create table teacher_pool (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  qualifications text,
  notes text,
  status text not null default 'available'
    check (status in ('available', 'assigned', 'inactive')),
  -- Set the first time the teacher is assigned; their login is reused
  -- for any later family so one person never has two accounts.
  profile_id uuid references profiles(id) on delete set null,
  assigned_school_id uuid references schools(id) on delete set null,
  assigned_at timestamptz,
  created_at timestamptz not null default now(),
  constraint teacher_pool_assigned_has_school
    check (status <> 'assigned' or assigned_school_id is not null)
);

create unique index teacher_pool_email_key on teacher_pool (lower(email));
create index idx_teacher_pool_status on teacher_pool (status, full_name);

alter table teacher_pool enable row level security;

create policy "teacher_pool_super_admin" on teacher_pool
  for all to authenticated
  using (app_is_super_admin())
  with check (app_is_super_admin());
