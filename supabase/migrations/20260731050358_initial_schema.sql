-- ============================================================
-- NATM Initial Schema
-- Schools, Academic Sessions & Terms, Profiles/Roles,
-- Classes, Students, Shadow Teacher Assignments, Attendance
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- Enums ----------
create type staff_role as enum (
  'super_admin',
  'school_admin',
  'class_teacher',
  'shadow_teacher',
  'parent',
  'student'
);

create type attendance_status as enum ('present', 'absent', 'late');

-- ---------- Schools ----------
create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Academic Sessions ----------
create table academic_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,                          -- e.g. "2026/2027"
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

-- ---------- Terms ----------
create table terms (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references academic_sessions(id) on delete cascade,
  term_number smallint not null check (term_number in (1, 2, 3)),
  start_date date,
  end_date date,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  unique (session_id, term_number)
);

-- ---------- Profiles (extends auth.users) ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,  -- null for super_admin
  role staff_role not null,
  full_name text not null,
  photo_url text,
  created_at timestamptz not null default now()
);

-- ---------- Classes ----------
create table classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,                          -- e.g. "JSS 1A"
  class_teacher_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- Students ----------
create table students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid references classes(id) on delete set null,
  profile_id uuid references profiles(id) on delete set null,  -- student's own login, if activated
  full_name text not null,
  unique_student_id text not null,
  photo_url text,
  created_at timestamptz not null default now(),
  unique (school_id, unique_student_id)
);

-- ---------- Parent <-> Student links (supports multi-child parent accounts) ----------
create table parent_student_links (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references profiles(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (parent_id, student_id)
);

-- ---------- Shadow Teacher Assignments (history retained, not overwritten) ----------
create table shadow_teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  shadow_teacher_id uuid not null references profiles(id) on delete cascade,
  is_active boolean not null default true,
  assigned_at timestamptz not null default now(),
  ended_at timestamptz
);

-- Only one active shadow teacher per student at a time
create unique index one_active_shadow_teacher_per_student
  on shadow_teacher_assignments (student_id)
  where is_active;

-- ---------- Attendance ----------
create table attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  term_id uuid not null references terms(id) on delete cascade,
  date date not null,
  status attendance_status not null,
  marked_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  unique (student_id, date)
);

-- ---------- Helpful indexes ----------
create index idx_profiles_school_id on profiles(school_id);
create index idx_classes_school_id on classes(school_id);
create index idx_students_school_id on students(school_id);
create index idx_students_class_id on students(class_id);
create index idx_attendance_student_id on attendance(student_id);
create index idx_attendance_term_id on attendance(term_id);

-- ---------- RLS: enabled now, real policies added in a dedicated migration ----------
-- Mirrors SchoolPilot's approach — tables created with RLS enabled but a
-- temporary permissive policy, so the app stays usable during scaffolding.
-- MUST be replaced with real per-role policies before any production data exists.
alter table schools enable row level security;
alter table academic_sessions enable row level security;
alter table terms enable row level security;
alter table profiles enable row level security;
alter table classes enable row level security;
alter table students enable row level security;
alter table parent_student_links enable row level security;
alter table shadow_teacher_assignments enable row level security;
alter table attendance enable row level security;

create policy "temp_allow_all_authenticated" on schools for all to authenticated using (true) with check (true);
create policy "temp_allow_all_authenticated" on academic_sessions for all to authenticated using (true) with check (true);
create policy "temp_allow_all_authenticated" on terms for all to authenticated using (true) with check (true);
create policy "temp_allow_all_authenticated" on profiles for all to authenticated using (true) with check (true);
create policy "temp_allow_all_authenticated" on classes for all to authenticated using (true) with check (true);
create policy "temp_allow_all_authenticated" on students for all to authenticated using (true) with check (true);
create policy "temp_allow_all_authenticated" on parent_student_links for all to authenticated using (true) with check (true);
create policy "temp_allow_all_authenticated" on shadow_teacher_assignments for all to authenticated using (true) with check (true);
create policy "temp_allow_all_authenticated" on attendance for all to authenticated using (true) with check (true);
