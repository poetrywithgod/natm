-- ============================================================
-- Badges (student gamification).
--
-- The badge catalog itself (name, description, icon, criteria) is
-- static content defined in code (apps/student-parent/src/features/
-- gamification/api.ts), not admin-editable data -- same reasoning as
-- other fixed enums in this schema. This table only records WHO
-- earned WHICH catalog badge and WHEN; once earned, a badge is
-- permanent (never removed even if the underlying stats that earned
-- it would later look different, e.g. after a reassessment).
--
-- Streaks are NOT stored here -- like the running (non-finalized)
-- subject average in quarterly_subject_scores, current/longest streak
-- is computed live from quiz_attempts.submitted_at each time it's
-- needed, not materialized.
-- ============================================================

create table student_badges (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  badge_key text not null,
  earned_at timestamptz not null default now(),
  unique (student_id, badge_key)
);

create index idx_student_badges_student_id on student_badges(student_id);

alter table student_badges enable row level security;
create policy "temp_allow_all_authenticated" on student_badges
  for all to authenticated using (true) with check (true);
