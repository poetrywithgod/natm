-- ============================================================
-- Fee Types
-- School Admin creates named fee types (e.g. "School Fees",
-- "PTA Fees") with an amount, a term, and an optional class scope
-- (null class_id = applies to the whole school). Creating one
-- generates a student_fees row for every applicable student,
-- so a student can now owe several distinct fees per term,
-- each tracked (and paid) independently.
-- ============================================================

create table fee_types (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  term_id uuid not null references terms(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null,
  class_id uuid references classes(id) on delete cascade, -- null = whole school
  created_at timestamptz not null default now()
);

create index idx_fee_types_school_id on fee_types(school_id);
create index idx_fee_types_term_id on fee_types(term_id);

alter table fee_types enable row level security;
create policy "temp_allow_all_authenticated" on fee_types
  for all to authenticated using (true) with check (true);

-- student_fees now hangs off a specific fee_type rather than being
-- one flat per-term amount. Old rows (from before fee types existed)
-- are left with a null fee_type_id and are effectively orphaned/unused
-- going forward — fine, since no real production fee data exists yet.
alter table student_fees add column fee_type_id uuid references fee_types(id) on delete cascade;
alter table student_fees drop constraint student_fees_student_id_term_id_key;
alter table student_fees add constraint student_fees_student_id_fee_type_id_key unique (student_id, fee_type_id);
create index idx_student_fees_fee_type_id on student_fees(fee_type_id);
