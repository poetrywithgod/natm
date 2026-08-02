-- Promotion history: one row per promotion decision made on a student
create table if not exists promotions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  from_class_id uuid references classes(id) on delete set null,
  to_class_id uuid not null references classes(id) on delete cascade,
  decision text not null check (decision in ('promoted', 'repeated')),
  academic_session_id uuid not null references academic_sessions(id) on delete cascade,
  promoted_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

alter table promotions enable row level security;

create policy "temp_permissive_promotions" on promotions
  for all using (true) with check (true);

create index if not exists idx_promotions_student on promotions(student_id);

-- Subject carryovers: a promoted student who carries a specific subject
-- back to their old (lower) class, additive alongside their new class's subjects
create table if not exists student_subject_carryovers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  carryover_class_id uuid not null references classes(id) on delete cascade,
  academic_session_id uuid not null references academic_sessions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_id, subject_id, academic_session_id)
);

alter table student_subject_carryovers enable row level security;

create policy "temp_permissive_carryovers" on student_subject_carryovers
  for all using (true) with check (true);

create index if not exists idx_carryovers_student on student_subject_carryovers(student_id);
