-- Timetable periods: School Admin defines the daily period structure per school
create table if not exists timetable_periods (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  period_number int not null,
  label text not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  unique (school_id, period_number)
);

alter table timetable_periods enable row level security;

create policy "temp_permissive_timetable_periods" on timetable_periods
  for all using (true) with check (true);

-- Timetable entries: per-class grid of Day x Period -> Subject + Teacher
create table if not exists timetable_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 5), -- 1=Mon .. 5=Fri
  period_id uuid not null references timetable_periods(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete restrict,
  teacher_id uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, day_of_week, period_id)
);

alter table timetable_entries enable row level security;

create policy "temp_permissive_timetable_entries" on timetable_entries
  for all using (true) with check (true);

create index if not exists idx_timetable_entries_class on timetable_entries(class_id);
create index if not exists idx_timetable_periods_school on timetable_periods(school_id);
