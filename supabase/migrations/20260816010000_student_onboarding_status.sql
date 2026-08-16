-- ============================================================
-- Student onboarding lifecycle. Tracks a new student account
-- through: admin creates it -> forced password reset on first
-- login -> intake/consent form -> admin review -> approved (full
-- portal access). The Student app gates routes based on this.
-- ============================================================
create type student_onboarding_status as enum (
  'pending_password_reset',
  'pending_intake_form',
  'pending_review',
  'approved'
);

alter table students
  add column onboarding_status student_onboarding_status not null default 'pending_password_reset';
