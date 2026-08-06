-- ============================================================
-- Quizzes
-- AI-generated objective quizzes attached to a lesson. Generated
-- by an Edge Function from the lesson's extracted_text via Claude,
-- reviewed/approved by the Class Teacher. quiz_attempts/quiz_answers
-- are created now so the schema is ready, but stay empty until the
-- Student/Parent app's "Start Quiz" screen exists.
-- ============================================================

create type quiz_difficulty as enum ('easy', 'normal', 'hard');
create type quiz_status as enum ('generating', 'ready', 'failed');
create type quiz_question_type as enum ('multiple_choice', 'fill_in_blank');
create type quiz_attempt_status as enum ('in_progress', 'submitted');

create table quizzes (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  difficulty quiz_difficulty not null,
  status quiz_status not null default 'generating',
  error_message text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  question_type quiz_question_type not null,
  question_text text not null,
  options jsonb,                 -- array of strings, multiple_choice only
  correct_answer text not null,  -- exact option text (MC) or expected answer (fill-in-blank)
  marks numeric not null default 1,
  order_index smallint not null,
  created_at timestamptz not null default now()
);

create table quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  status quiz_attempt_status not null default 'in_progress',
  score numeric,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  unique (quiz_id, student_id)
);

create table quiz_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references quiz_attempts(id) on delete cascade,
  question_id uuid not null references quiz_questions(id) on delete cascade,
  student_answer text,
  is_correct boolean,
  marks_awarded numeric,
  unique (attempt_id, question_id)
);

create index idx_quizzes_lesson_id on quizzes(lesson_id);
create index idx_quiz_questions_quiz_id on quiz_questions(quiz_id);
create index idx_quiz_attempts_quiz_id on quiz_attempts(quiz_id);
create index idx_quiz_attempts_student_id on quiz_attempts(student_id);
create index idx_quiz_answers_attempt_id on quiz_answers(attempt_id);

alter table quizzes enable row level security;
alter table quiz_questions enable row level security;
alter table quiz_attempts enable row level security;
alter table quiz_answers enable row level security;

create policy "temp_allow_all_authenticated" on quizzes for all to authenticated using (true) with check (true);
create policy "temp_allow_all_authenticated" on quiz_questions for all to authenticated using (true) with check (true);
create policy "temp_allow_all_authenticated" on quiz_attempts for all to authenticated using (true) with check (true);
create policy "temp_allow_all_authenticated" on quiz_answers for all to authenticated using (true) with check (true);
