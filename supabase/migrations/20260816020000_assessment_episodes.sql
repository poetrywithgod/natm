-- ============================================================
-- IEP intake/assessment pipeline: Assessment Episodes.
--
-- One episode = one full assessment cycle for a student (Form 1
-- intake + Form 2 on-site observation + AI suggestion + admin
-- approval). Reassessment creates a NEW episode rather than
-- editing an old one -- once a form is submitted it becomes
-- read-only (enforced by trigger below, not just convention),
-- preserving a full auditable history per the ~3-month IEP
-- review cadence the forms themselves already reference.
--
-- Large repeating structured content (dozens of intake fields,
-- 16 Part-B rating domains, 12 Form-2 dual-scored domains) is
-- stored as JSONB rather than exploded into 100+ columns --
-- standard practice for forms this size, and lets the exact
-- field set evolve without a migration every time.
-- ============================================================

create type assessment_episode_status as enum (
  'form1_draft',
  'form1_submitted',
  'form1_approved',
  'form2_draft',
  'form2_submitted',
  'ai_suggested',
  'completed'
);

create table assessment_episodes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  episode_number smallint not null,
  status assessment_episode_status not null default 'form1_draft',
  form1_submitted_at timestamptz,
  form1_approved_at timestamptz,
  form1_approved_by uuid references profiles(id),
  form2_submitted_at timestamptz,
  ai_suggested_at timestamptz,
  suggested_subjects jsonb,
  suggested_level class_level,
  approved_subjects jsonb,
  approved_level class_level,
  completed_at timestamptz,
  completed_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (student_id, episode_number)
);

create table form1_submissions (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null unique references assessment_episodes(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  part_a jsonb not null default '{}',
  part_b jsonb not null default '{}',
  consents jsonb not null default '{}',
  submitted_at timestamptz,
  submitted_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table form2_submissions (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null unique references assessment_episodes(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  observation_info jsonb not null default '{}',
  protocol_notes jsonb not null default '{}',
  domains jsonb not null default '{}',
  submitted_at timestamptz,
  submitted_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table assessment_episodes enable row level security;
create policy "temp_permissive_assessment_episodes" on assessment_episodes
  for all using (true) with check (true);

alter table form1_submissions enable row level security;
create policy "temp_permissive_form1_submissions" on form1_submissions
  for all using (true) with check (true);

alter table form2_submissions enable row level security;
create policy "temp_permissive_form2_submissions" on form2_submissions
  for all using (true) with check (true);

-- ============================================================
-- Immutability enforcement: this is a REAL business rule, not a
-- placeholder policy. Once submitted_at is set on a submission,
-- any further UPDATE to that row is rejected outright -- edits
-- must happen via a new draft in a new episode, never in place.
-- ============================================================
create or replace function prevent_edit_after_submission() returns trigger as $$
begin
  if old.submitted_at is not null then
    raise exception 'This submission is locked and cannot be edited after submission.';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger form1_lock_after_submit
  before update on form1_submissions
  for each row execute function prevent_edit_after_submission();

create trigger form2_lock_after_submit
  before update on form2_submissions
  for each row execute function prevent_edit_after_submission();

create index idx_assessment_episodes_student on assessment_episodes(student_id, episode_number desc);
create index idx_form1_submissions_episode on form1_submissions(episode_id);
create index idx_form2_submissions_episode on form2_submissions(episode_id);
