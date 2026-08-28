-- ============================================================
-- Foundation Partnership/Support financial model
-- Per-school selectable model: 'fees' (default, existing
-- behaviour, unchanged) or 'partnership' (this school's Fee
-- Types/student_fees flow is relabeled in the app as quarterly
-- "Child Developmental Support", and parents additionally pick
-- a Partnership tier each time they make a contribution).
-- No new fee/billing tables -- fee_types/student_fees/
-- payment_transactions are reused as-is, this migration only
-- adds the school-level switch and a per-transaction tier.
-- ============================================================

alter table schools
  add column financial_model text not null default 'fees'
  check (financial_model in ('fees', 'partnership'));

-- Tier the parent selected for this specific contribution.
-- Null for schools on the plain 'fees' model, and null for any
-- 'partnership'-model transaction that predates this feature.
-- Deliberately NOT a persistent field on the student/family --
-- the parent chooses a tier fresh at each payment, they aren't
-- locked into one.
alter table payment_transactions
  add column partnership_tier text
  check (partnership_tier in ('gold', 'silver', 'resource_men_support'));
