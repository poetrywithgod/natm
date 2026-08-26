-- ============================================================
-- Payment Transactions (Remita)
-- One row per parent-initiated online payment attempt against a
-- student_fees row. Created by the initiate-remita-payment Edge
-- Function (server-side, holds the Remita API key). Updated to
-- success/failed by the remita-webhook Edge Function once Remita
-- confirms the transaction. student_fees.amount_paid is only ever
-- incremented on a genuine pending -> success transition, so a
-- duplicate webhook delivery can't double-count a payment.
-- Supports partial/installment payments: amount is whatever the
-- parent chose to pay this time, not necessarily the full balance.
-- ============================================================

create table payment_transactions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  fee_type_id uuid not null references fee_types(id) on delete cascade,
  term_id uuid not null references terms(id) on delete cascade,
  initiated_by uuid not null references profiles(id) on delete set null, -- the parent
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  order_id text not null unique, -- our reference, sent to Remita as orderId/transactionId
  rrr text, -- Remita Retrieval Reference, set once RRR generation succeeds
  remita_transaction_id text, -- Remita's own transaction id, from the webhook payload
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_payment_transactions_school_id on payment_transactions(school_id);
create index idx_payment_transactions_student_id on payment_transactions(student_id);
create index idx_payment_transactions_initiated_by on payment_transactions(initiated_by);
create index idx_payment_transactions_rrr on payment_transactions(rrr);
create index idx_payment_transactions_status on payment_transactions(status);

alter table payment_transactions enable row level security;
create policy "temp_allow_all_authenticated" on payment_transactions
  for all to authenticated using (true) with check (true);
