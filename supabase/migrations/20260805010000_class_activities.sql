-- ============================================================
-- Class Activities
-- Class Teacher's daily log of what was actually taught, per
-- class, per subject, per day. This is separate from Timetable
-- (which is just the fixed weekly schedule grid) -- this is the
-- real record of what happened, and is what Shadow Teacher
-- reinforcement notes and future exercise/quiz content attach to.
-- ============================================================

create table class_activities (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  date date not null,
  topic text not null,
  notes text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_class_activities_class_id on class_activities(class_id);
create index idx_class_activities_subject_id on class_activities(subject_id);
create index idx_class_activities_date on class_activities(date);

-- ---------- Shadow Teacher reinforcement notes ----------
-- Per-student notes a Shadow Teacher logs against a specific class
-- activity, confirming/reinforcing what the Class Teacher taught.
create table activity_reinforcements (
  id uuid primary key default gen_random_uuid(),
  class_activity_id uuid not null references class_activities(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  shadow_teacher_id uuid not null references profiles(id),
  note text not null,
  created_at timestamptz not null default now(),
  unique (class_activity_id, student_id)
);

create index idx_activity_reinforcements_activity_id on activity_reinforcements(class_activity_id);
create index idx_activity_reinforcements_student_id on activity_reinforcements(student_id);

alter table class_activities enable row level security;
alter table activity_reinforcements enable row level security;

create policy "temp_allow_all_authenticated" on class_activities
  for all to authenticated using (true) with check (true);
create policy "temp_allow_all_authenticated" on activity_reinforcements
  for all to authenticated using (true) with check (true);
