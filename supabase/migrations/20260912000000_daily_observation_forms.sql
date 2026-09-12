-- ============================================================
-- Daily Observation Forms
-- Replaces the old topic-only class_activities log with the
-- full NATM Daily Teacher Observation Form (Class Teacher) and
-- introduces the Shadow Teacher Daily Support & Intervention
-- Record for the first time. Both are filled per learner, per
-- day, and apply identically to every class/level -- only the
-- class name shown differs.
--
-- Every section of each paper form is captured under a single
-- `sections` jsonb column (typed on the app side), so the schema
-- stays stable even as individual form fields evolve. Flat
-- columns are reserved for what we actually query/filter/join
-- on: school/class/student/teacher, date, term/week/day, status.
--
-- class_activities / activity_reinforcements are left in place
-- (Shadow Teacher's per-student reinforcement note on the
-- Student Detail activity feed still reads them) but are no
-- longer written to by the Class Teacher's Daily Activities page.
-- ============================================================

create table daily_teacher_observations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  teacher_id uuid not null references profiles(id),
  date date not null,
  term_number int,
  week int,
  day_label text,
  sections jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  teacher_signature text,
  parent_signature text,
  signed_date date,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, date)
);

create index idx_daily_teacher_observations_class_date on daily_teacher_observations(class_id, date);
create index idx_daily_teacher_observations_student_id on daily_teacher_observations(student_id);

create table shadow_teacher_daily_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  shadow_teacher_id uuid not null references profiles(id),
  therapist_involved text,
  date date not null,
  term_number int,
  week int,
  day_label text,
  sections jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  shadow_signature text,
  class_teacher_signature text,
  signed_date date,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, date)
);

create index idx_shadow_daily_records_shadow_teacher on shadow_teacher_daily_records(shadow_teacher_id, date);
create index idx_shadow_daily_records_student_id on shadow_teacher_daily_records(student_id);

alter table daily_teacher_observations enable row level security;
alter table shadow_teacher_daily_records enable row level security;

create policy "temp_allow_all_authenticated" on daily_teacher_observations
  for all to authenticated using (true) with check (true);
create policy "temp_allow_all_authenticated" on shadow_teacher_daily_records
  for all to authenticated using (true) with check (true);
