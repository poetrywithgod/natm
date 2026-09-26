-- ============================================================
-- FINER PER-ROLE WRITE PERMISSIONS WITHIN ONE SCHOOL
-- ============================================================
-- Follow-up to 20260923185710_real_rls_policies.sql, which explicitly
-- deferred this: that migration correctly stops School A from
-- touching School B's data, but within one school any staff role
-- could still write to any staff table -- e.g. a shadow_teacher could
-- edit fee_types, which should be finance_manager-only.
--
-- Every table below gets its blanket "for all" staff policy split
-- into two: a SELECT policy that stays exactly as broad as before
-- (any staff of that school, or super_admin) -- so School Admin's
-- oversight views keep working -- and INSERT/UPDATE/DELETE policies
-- narrowed to whichever specific role(s) actually create/edit that
-- data, verified against the app's own real write call-sites (which
-- page calls which function), not guessed from table names.
--
-- Left unchanged, on purpose: payment_transactions, audit_logs,
-- notifications (all three are legitimately insert-able broadly --
-- audit/notification rows get written by many roles' actions, and
-- payment_transactions writes only ever happen via edge functions
-- using the service role, which bypasses RLS entirely), and
-- partnership_pledges / student_badges / quiz_attempts / quiz_answers
-- (already select-only for staff; actual writes are parent/student-
-- owned via their own separate policies). class_activities is also
-- left unchanged: its create/update functions currently have zero
-- callers anywhere in the app (being wired up separately), so there's
-- no real usage pattern yet to verify a role assignment against.
-- ============================================================


-- ---------- school_admin-only tables ----------

drop policy if exists "academic_sessions_school_staff" on academic_sessions;
create policy "academic_sessions_select" on academic_sessions
  for select to authenticated using (app_in_own_school(school_id));
create policy "academic_sessions_write" on academic_sessions
  for all to authenticated
  using (app_school_id() = school_id and app_is_school_staff() and app_role() = 'school_admin')
  with check (app_school_id() = school_id and app_is_school_staff() and app_role() = 'school_admin');

drop policy if exists "classes_school_staff" on classes;
create policy "classes_select" on classes
  for select to authenticated using (app_in_own_school(school_id));
create policy "classes_write" on classes
  for all to authenticated
  using (app_school_id() = school_id and app_role() = 'school_admin')
  with check (app_school_id() = school_id and app_role() = 'school_admin');

drop policy if exists "timetable_periods_school_staff" on timetable_periods;
create policy "timetable_periods_select" on timetable_periods
  for select to authenticated using (app_in_own_school(school_id));
create policy "timetable_periods_write" on timetable_periods
  for all to authenticated
  using (app_school_id() = school_id and app_role() = 'school_admin')
  with check (app_school_id() = school_id and app_role() = 'school_admin');

drop policy if exists "timetable_entries_school_staff" on timetable_entries;
create policy "timetable_entries_select" on timetable_entries
  for select to authenticated using (app_in_own_school(school_id));
create policy "timetable_entries_write" on timetable_entries
  for all to authenticated
  using (app_school_id() = school_id and app_role() = 'school_admin')
  with check (app_school_id() = school_id and app_role() = 'school_admin');

drop policy if exists "school_enabled_levels_school_staff" on school_enabled_levels;
create policy "school_enabled_levels_select" on school_enabled_levels
  for select to authenticated using (app_in_own_school(school_id));
create policy "school_enabled_levels_write" on school_enabled_levels
  for all to authenticated
  using (app_school_id() = school_id and app_role() = 'school_admin')
  with check (app_school_id() = school_id and app_role() = 'school_admin');

drop policy if exists "announcements_school_staff" on announcements;
create policy "announcements_select" on announcements
  for select to authenticated using (app_in_own_school(school_id));
create policy "announcements_write" on announcements
  for all to authenticated
  using (app_school_id() = school_id and app_role() = 'school_admin')
  with check (app_school_id() = school_id and app_role() = 'school_admin');

drop policy if exists "news_posts_school_staff" on news_posts;
create policy "news_posts_select" on news_posts
  for select to authenticated using (app_in_own_school(school_id));
create policy "news_posts_write" on news_posts
  for all to authenticated
  using (app_school_id() = school_id and app_role() = 'school_admin')
  with check (app_school_id() = school_id and app_role() = 'school_admin');

drop policy if exists "promotions_school_staff" on promotions;
create policy "promotions_select" on promotions
  for select to authenticated using (app_in_own_school(school_id));
create policy "promotions_write" on promotions
  for all to authenticated
  using (app_school_id() = school_id and app_role() = 'school_admin')
  with check (app_school_id() = school_id and app_role() = 'school_admin');

drop policy if exists "student_subject_carryovers_school_staff" on student_subject_carryovers;
create policy "student_subject_carryovers_select" on student_subject_carryovers
  for select to authenticated using (app_in_own_school(school_id));
create policy "student_subject_carryovers_write" on student_subject_carryovers
  for all to authenticated
  using (app_school_id() = school_id and app_role() = 'school_admin')
  with check (app_school_id() = school_id and app_role() = 'school_admin');

drop policy if exists "quarterly_subject_scores_school_staff" on quarterly_subject_scores;
create policy "quarterly_subject_scores_select" on quarterly_subject_scores
  for select to authenticated using (app_in_own_school(school_id));
create policy "quarterly_subject_scores_write" on quarterly_subject_scores
  for all to authenticated
  using (app_school_id() = school_id and app_role() = 'school_admin')
  with check (app_school_id() = school_id and app_role() = 'school_admin');

drop policy if exists "student_subjects_school_staff" on student_subjects;
create policy "student_subjects_select" on student_subjects
  for select to authenticated using (app_in_own_school(school_id));
create policy "student_subjects_write" on student_subjects
  for all to authenticated
  using (app_school_id() = school_id and app_role() = 'school_admin')
  with check (app_school_id() = school_id and app_role() = 'school_admin');

drop policy if exists "class_subjects_school_staff" on class_subjects;
create policy "class_subjects_select" on class_subjects
  for select to authenticated
  using (app_in_own_school((select school_id from classes where id = class_subjects.class_id)));
create policy "class_subjects_write" on class_subjects
  for all to authenticated
  using (
    app_role() = 'school_admin'
    and app_school_id() = (select school_id from classes where id = class_subjects.class_id)
  )
  with check (
    app_role() = 'school_admin'
    and app_school_id() = (select school_id from classes where id = class_subjects.class_id)
  );

drop policy if exists "shadow_teacher_assignments_school_staff" on shadow_teacher_assignments;
create policy "shadow_teacher_assignments_select" on shadow_teacher_assignments
  for select to authenticated
  using (app_in_own_school((select school_id from students where id = shadow_teacher_assignments.student_id)));
create policy "shadow_teacher_assignments_write" on shadow_teacher_assignments
  for all to authenticated
  using (
    app_role() = 'school_admin'
    and app_school_id() = (select school_id from students where id = shadow_teacher_assignments.student_id)
  )
  with check (
    app_role() = 'school_admin'
    and app_school_id() = (select school_id from students where id = shadow_teacher_assignments.student_id)
  );

drop policy if exists "students_school_staff" on students;
create policy "students_select_staff" on students
  for select to authenticated using (app_in_own_school(school_id));
create policy "students_write_staff" on students
  for all to authenticated
  using (app_school_id() = school_id and app_role() = 'school_admin')
  with check (app_school_id() = school_id and app_role() = 'school_admin');
-- students_select_family / students_update_family (parent/own-student
-- self-access) are separate, pre-existing policies -- untouched here.

drop policy if exists "parent_student_links_school_staff" on parent_student_links;
create policy "parent_student_links_select" on parent_student_links
  for select to authenticated using (app_in_own_school((select school_id from students where id = student_id)));
create policy "parent_student_links_write" on parent_student_links
  for all to authenticated
  using (
    app_role() = 'school_admin'
    and app_school_id() = (select school_id from students where id = student_id)
  )
  with check (
    app_role() = 'school_admin'
    and app_school_id() = (select school_id from students where id = student_id)
  );

drop policy if exists "assessment_episodes_school_staff" on assessment_episodes;
create policy "assessment_episodes_select" on assessment_episodes
  for select to authenticated using (app_in_own_school(school_id));
create policy "assessment_episodes_write" on assessment_episodes
  for all to authenticated
  using (app_school_id() = school_id and app_role() = 'school_admin')
  with check (app_school_id() = school_id and app_role() = 'school_admin');

drop policy if exists "terms_school_staff" on terms;
create policy "terms_write" on terms
  for all to authenticated
  using (
    app_role() = 'school_admin'
    and app_school_id() = (select school_id from academic_sessions where id = terms.session_id)
  )
  with check (
    app_role() = 'school_admin'
    and app_school_id() = (select school_id from academic_sessions where id = terms.session_id)
  );
-- terms already has its own separate broad select policy -- untouched.


-- ---------- finance_manager-only tables ----------

drop policy if exists "fee_types_school_staff" on fee_types;
create policy "fee_types_select" on fee_types
  for select to authenticated using (app_in_own_school(school_id));
create policy "fee_types_write" on fee_types
  for all to authenticated
  using (app_school_id() = school_id and app_role() = 'finance_manager')
  with check (app_school_id() = school_id and app_role() = 'finance_manager');

drop policy if exists "student_fees_school_staff" on student_fees;
create policy "student_fees_select" on student_fees
  for select to authenticated using (app_in_own_school(school_id));
create policy "student_fees_write" on student_fees
  for all to authenticated
  using (app_school_id() = school_id and app_role() = 'finance_manager')
  with check (app_school_id() = school_id and app_role() = 'finance_manager');


-- ---------- class_teacher-only tables ----------

drop policy if exists "attendance_school_staff" on attendance;
create policy "attendance_select" on attendance
  for select to authenticated
  using (app_in_own_school((select school_id from students where id = attendance.student_id)));
create policy "attendance_write" on attendance
  for all to authenticated
  using (
    app_role() = 'class_teacher'
    and app_school_id() = (select school_id from students where id = attendance.student_id)
  )
  with check (
    app_role() = 'class_teacher'
    and app_school_id() = (select school_id from students where id = attendance.student_id)
  );
-- attendance already has its own separate family-select policy -- untouched.

drop policy if exists "class_work_school_staff" on class_work;
create policy "class_work_select" on class_work
  for select to authenticated using (app_in_own_school(school_id));
create policy "class_work_write" on class_work
  for all to authenticated
  using (app_school_id() = school_id and app_role() = 'class_teacher')
  with check (app_school_id() = school_id and app_role() = 'class_teacher');

drop policy if exists "class_work_assignees_school_staff" on class_work_assignees;
create policy "class_work_assignees_write" on class_work_assignees
  for all to authenticated
  using (
    app_role() = 'class_teacher'
    and app_school_id() = (select school_id from class_work where id = class_work_id)
  )
  with check (
    app_role() = 'class_teacher'
    and app_school_id() = (select school_id from class_work where id = class_work_id)
  );
-- class_work_assignees already has its own separate family-select policy -- untouched.

drop policy if exists "lessons_school_staff" on lessons;
create policy "lessons_select" on lessons
  for select to authenticated using (app_in_own_school(school_id));
create policy "lessons_write" on lessons
  for all to authenticated
  using (app_school_id() = school_id and app_role() = 'class_teacher')
  with check (app_school_id() = school_id and app_role() = 'class_teacher');

drop policy if exists "quizzes_school_staff" on quizzes;
create policy "quizzes_select" on quizzes
  for select to authenticated using (app_in_own_school(school_id));
create policy "quizzes_write" on quizzes
  for all to authenticated
  using (app_school_id() = school_id and app_role() = 'class_teacher')
  with check (app_school_id() = school_id and app_role() = 'class_teacher');

drop policy if exists "quiz_questions_school_staff" on quiz_questions;
create policy "quiz_questions_write" on quiz_questions
  for all to authenticated
  using (
    app_role() = 'class_teacher'
    and app_school_id() = (select school_id from quizzes where id = quiz_id)
  )
  with check (
    app_role() = 'class_teacher'
    and app_school_id() = (select school_id from quizzes where id = quiz_id)
  );
-- quiz_questions already has its own separate student-select policy -- untouched.

drop policy if exists "daily_teacher_observations_school_staff" on daily_teacher_observations;
create policy "daily_teacher_observations_select" on daily_teacher_observations
  for select to authenticated using (app_in_own_school(school_id));
create policy "daily_teacher_observations_write" on daily_teacher_observations
  for all to authenticated
  using (app_school_id() = school_id and app_role() = 'class_teacher')
  with check (app_school_id() = school_id and app_role() = 'class_teacher');


-- ---------- shadow_teacher-only tables ----------

drop policy if exists "shadow_teacher_daily_records_school_staff" on shadow_teacher_daily_records;
create policy "shadow_teacher_daily_records_select" on shadow_teacher_daily_records
  for select to authenticated using (app_in_own_school(school_id));
create policy "shadow_teacher_daily_records_write" on shadow_teacher_daily_records
  for all to authenticated
  using (app_school_id() = school_id and app_role() = 'shadow_teacher')
  with check (app_school_id() = school_id and app_role() = 'shadow_teacher');

drop policy if exists "activity_reinforcements_school_staff" on activity_reinforcements;
create policy "activity_reinforcements_write" on activity_reinforcements
  for all to authenticated
  using (
    app_role() = 'shadow_teacher'
    and app_school_id() = (select school_id from class_activities where id = class_activity_id)
  )
  with check (
    app_role() = 'shadow_teacher'
    and app_school_id() = (select school_id from class_activities where id = class_activity_id)
  );
-- activity_reinforcements already has its own separate family-select policy -- untouched.
