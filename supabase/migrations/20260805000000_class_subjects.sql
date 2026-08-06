-- ============================================================
-- Class Subjects
-- Which subjects a given class offers. Deliberately independent
-- of curriculum_documents (Super Admin's pedagogical content) --
-- this is a lightweight School Admin-managed assignment, so
-- Timetable's Subject field and "subjects a student is offering"
-- don't have to wait on Super Admin/curriculum authorship.
-- ============================================================

create table class_subjects (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (class_id, subject_id)
);

create index idx_class_subjects_class_id on class_subjects(class_id);
create index idx_class_subjects_subject_id on class_subjects(subject_id);

alter table class_subjects enable row level security;

create policy "temp_allow_all_authenticated" on class_subjects
  for all to authenticated using (true) with check (true);
