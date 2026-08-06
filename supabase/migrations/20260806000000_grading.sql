-- ============================================================
-- Grading
-- Every quiz attempt (whether from a lesson-linked quiz or, later,
-- assigned homework -- both reuse the quizzes/quiz_attempts schema)
-- contributes a score. total_marks is denormalized onto the attempt
-- at submission time so percentage = score/total_marks is cheap to
-- compute without re-summing quiz_questions every time.
--
-- quarterly_subject_scores stores the FINALIZED score once a calendar
-- quarter ends (School Admin triggers finalization manually for now --
-- no scheduled job yet). The running average for the current,
-- not-yet-finalized quarter is computed live from quiz_attempts.
-- ============================================================

alter table quiz_attempts add column total_marks numeric;

create table quarterly_subject_scores (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  year smallint not null,
  quarter_number smallint not null check (quarter_number in (1, 2, 3, 4)),
  average_score numeric not null,   -- percentage, 0-100
  attempt_count int not null,
  finalized_by uuid not null references profiles(id),
  finalized_at timestamptz not null default now(),
  unique (student_id, subject_id, year, quarter_number)
);

create index idx_quarterly_subject_scores_student_id on quarterly_subject_scores(student_id);

alter table quarterly_subject_scores enable row level security;
create policy "temp_allow_all_authenticated" on quarterly_subject_scores
  for all to authenticated using (true) with check (true);
