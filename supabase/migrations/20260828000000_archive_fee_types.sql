-- ============================================================
-- Archive (soft-delete) fee_types
-- School Admin / Finance Manager can archive a fee/support item
-- they no longer want active -- e.g. when a school switches from
-- the 'fees' model to 'partnership' and wants old fee types like
-- "School Fees"/"PTA" to stop being shown/collected against.
-- This is a hide, not a hard delete: existing student_fees and
-- payment_transactions rows referencing the fee_type are left
-- completely untouched, so payment history stays intact.
-- ============================================================

alter table fee_types
  add column is_archived boolean not null default false;

create index idx_fee_types_is_archived on fee_types(is_archived);
