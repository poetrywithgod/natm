-- ============================================================
-- Class + Shadow Teacher assignment tracking on assessment_episodes.
--
-- These two steps happen after subject approval (status = 'completed')
-- and write to the existing students.class_id / shadow_teacher_assignments
-- tables -- no new home for the assignment itself, just a record on the
-- episode of when/by whom it was done, same pattern as form1_approved_at/by.
-- ============================================================

alter table assessment_episodes
  add column class_assigned_at timestamptz,
  add column class_assigned_by uuid references profiles(id),
  add column shadow_teacher_assigned_at timestamptz,
  add column shadow_teacher_assigned_by uuid references profiles(id);
