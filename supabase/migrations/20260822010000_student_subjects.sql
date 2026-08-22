-- ============================================================
-- Student Subjects
--
-- A student's individual subject list, independent of class_subjects
-- (which is "what this class offers" and requires a class to exist).
-- IEP subject assignment happens BEFORE a student has a class --
-- the AI suggestion + admin approval flow only produces a suggested
-- class_level, not an actual class -- so subjects assigned at that
-- point need a home that doesn't depend on class_id.
--
-- Once a class is later assigned to the student, class_subjects
-- remains the "what does this class generally offer" list; this
-- table is "what THIS student specifically takes", which can be a
-- subset, a superset (individualized additions), or simply match --
-- the two are deliberately independent, same reasoning as
-- class_subjects vs curriculum_documents.
-- ============================================================

create table student_subjects (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  assessment_episode_id uuid references assessment_episodes(id) on delete set null,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references profiles(id),
  unique (student_id, subject_id)
);

create index idx_student_subjects_student on student_subjects(student_id);
create index idx_student_subjects_school on student_subjects(school_id);

alter table student_subjects enable row level security;

create policy "temp_permissive_student_subjects" on student_subjects
  for all to authenticated using (true) with check (true);
