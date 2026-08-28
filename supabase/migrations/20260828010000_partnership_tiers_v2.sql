-- ============================================================
-- Partnership model v2 correction
-- Gold: monetary, open-ended, minimum ~N1,000,000 per contribution
--   (enforced client-side, not in the DB)
-- Silver: monetary, any amount the partner can give
-- Bronze (renamed from the earlier "Resource Men Support"): NOT
--   monetary -- volunteering physical labour/service at the school.
--   Can't go through payment_transactions (that table requires
--   amount > 0), so it gets its own lightweight pledges table.
-- Child Developmental Support itself has no fixed amount -- it's
-- the tiers above that carry the money (or don't, for Bronze), not
-- a per-item target. fee_types.is_open_amount marks an item as
-- "no fixed due amount", auto-created quarterly by the app under
-- the Partnership model.
-- ============================================================

alter table fee_types
  add column is_open_amount boolean not null default false;

-- Rename the tier value. No real transactions are expected to exist
-- yet (Remita has never gone live -- no merchant account), but
-- backfill defensively in case any test rows exist.
update payment_transactions
  set partnership_tier = 'bronze'
  where partnership_tier = 'resource_men_support';

alter table payment_transactions
  drop constraint payment_transactions_partnership_tier_check;

alter table payment_transactions
  add constraint payment_transactions_partnership_tier_check
  check (partnership_tier in ('gold', 'silver', 'bronze'));

-- One row per parent's volunteer/in-kind commitment under the
-- Bronze tier. No amount column -- this tier is explicitly not
-- about money. Finance Manager/School Admin follow up on these
-- manually (phone/WhatsApp, same as the CCSF public site's
-- non-monetary Get Involved pages).
create table partnership_pledges (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  parent_id uuid not null references profiles(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

create index idx_partnership_pledges_school_id on partnership_pledges(school_id);
create index idx_partnership_pledges_student_id on partnership_pledges(student_id);
create index idx_partnership_pledges_parent_id on partnership_pledges(parent_id);

alter table partnership_pledges enable row level security;
create policy "temp_allow_all_authenticated" on partnership_pledges
  for all to authenticated using (true) with check (true);
