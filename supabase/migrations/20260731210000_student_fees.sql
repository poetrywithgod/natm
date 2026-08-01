-- ============================================================
-- Student Fees
-- One row per student per term. is_paid is computed from
-- amount_paid vs amount_due so charts never get out of sync
-- with a manually-toggled boolean.
-- A student with no row for the current term is "not yet billed" —
-- the app layer treats that the same as unpaid for chart purposes.
-- ============================================================

create table student_fees (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  term_id uuid not null references terms(id) on delete cascade,
  amount_due numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  is_paid boolean generated always as (amount_due > 0 and amount_paid >= amount_due) stored,
  updated_at timestamptz not null default now(),
  unique (student_id, term_id)
);

create index idx_student_fees_school_id on student_fees(school_id);
create index idx_student_fees_term_id on student_fees(term_id);
create index idx_student_fees_student_id on student_fees(student_id);

alter table student_fees enable row level security;
create policy "temp_allow_all_authenticated" on student_fees
  for all to authenticated using (true) with check (true);
