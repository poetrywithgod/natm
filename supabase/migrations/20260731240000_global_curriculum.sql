-- ============================================================
-- Global Curriculum
-- Curriculum is NOT school-scoped — it's a universal standard
-- authored once (by Super Admin) and visible identically across
-- every school on the platform. class_level is a standardized
-- Nigerian education level, separate from each school's own
-- free-text class name, so curriculum can be matched correctly
-- regardless of how a school names its classes.
-- ============================================================

create type class_level as enum (
  'primary_1', 'primary_2', 'primary_3', 'primary_4', 'primary_5', 'primary_6',
  'jss_1', 'jss_2', 'jss_3',
  'ss_1', 'ss_2', 'ss_3'
);

-- Nullable: existing test classes ("JSS 1A") predate this field and
-- aren't backfilled automatically — School Admin sets it per class.
alter table classes add column level class_level;

create table subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table curriculum_documents (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  level class_level not null,
  term_number smallint not null check (term_number in (1, 2, 3)),
  domain_purpose text,
  learning_outcomes text[],
  learning_resources text,
  portfolio_evidence text,
  assessment_evidence text,
  teacher_reflection text,
  ai_recommendation_rules text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject_id, level, term_number)
);

-- One row per week of the scheme of work. `detail` holds the richer,
-- variable-shape content some subjects have per-week (Bible Studies:
-- discover/explore/act_apply/reflect/check_learning/life_application/
-- ot_integration/adaptive_skills) and others only have for one sample
-- week — kept as JSONB since the shape genuinely varies by subject
-- rather than forcing many nullable columns.
create table curriculum_weeks (
  id uuid primary key default gen_random_uuid(),
  curriculum_document_id uuid not null references curriculum_documents(id) on delete cascade,
  week_number smallint not null,
  topic text not null,
  learning_goal text,
  natm_approach text,
  detail jsonb,
  unique (curriculum_document_id, week_number)
);

create index idx_curriculum_documents_level_term on curriculum_documents(level, term_number);
create index idx_curriculum_weeks_document_id on curriculum_weeks(curriculum_document_id);

alter table subjects enable row level security;
alter table curriculum_documents enable row level security;
alter table curriculum_weeks enable row level security;

-- Global content: every authenticated user (any school, any role)
-- can read it. Write access is meant to be Super Admin only —
-- left as temp-permissive for now, same as every other table,
-- to be tightened in the real RLS pass before production.
create policy "temp_allow_all_authenticated" on subjects
  for all to authenticated using (true) with check (true);
create policy "temp_allow_all_authenticated" on curriculum_documents
  for all to authenticated using (true) with check (true);
create policy "temp_allow_all_authenticated" on curriculum_weeks
  for all to authenticated using (true) with check (true);
