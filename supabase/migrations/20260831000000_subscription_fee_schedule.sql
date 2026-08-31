-- ============================================================
-- Per-term subscription fee schedule
-- Replaces the single schools.subscription_fee (one recurring rate
-- reused for whatever term happens to be current) with an explicit
-- rate card: Super Admin sets a separate amount for Term 1, Term 2,
-- and Term 3. schools.subscription_fee is left in place but unused
-- going forward -- a harmless dead column, safer than dropping one
-- with live data on a production-ish DB.
-- ============================================================

create table subscription_fee_schedule (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  term_number int not null check (term_number in (1, 2, 3)),
  amount numeric(12,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, term_number)
);

create index idx_subscription_fee_schedule_school on subscription_fee_schedule(school_id);

alter table subscription_fee_schedule enable row level security;
create policy "temp_allow_all_authenticated" on subscription_fee_schedule
  for all to authenticated using (true) with check (true);
