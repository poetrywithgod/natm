-- ============================================================
-- Platform subscriptions
-- Super Admin sets a per-school termly fee; School Admin pays it via
-- Remita to keep the school active on the platform. Deliberately
-- separate from payment_transactions/student_fees (which are about a
-- parent paying a school) -- this is a school paying the platform, a
-- different relationship entirely, so it gets its own pair of tables
-- mirroring that existing shape rather than overloading it.
-- ============================================================

alter table schools
  add column subscription_fee numeric(12,2);

-- One invoice per (school, term) -- amount_due is a snapshot of
-- schools.subscription_fee at invoice-creation time, so a later fee
-- change doesn't retroactively alter an already-issued invoice.
create table subscription_invoices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  term_id uuid not null references terms(id) on delete cascade,
  amount_due numeric(12,2) not null,
  amount_paid numeric(12,2) not null default 0,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, term_id)
);

create index idx_subscription_invoices_school on subscription_invoices(school_id);

alter table subscription_invoices enable row level security;
create policy "temp_allow_all_authenticated" on subscription_invoices
  for all to authenticated using (true) with check (true);

-- Mirrors payment_transactions' shape (order_id/rrr/status/
-- remita_transaction_id) but keyed to an invoice instead of a student
-- fee -- see initiate-subscription-payment and the extended
-- remita-webhook, which now branches on which of these two tables a
-- given RRR belongs to.
create table subscription_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  invoice_id uuid not null references subscription_invoices(id) on delete cascade,
  initiated_by uuid references profiles(id),
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  order_id text not null unique,
  rrr text,
  remita_transaction_id text,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_subscription_payment_transactions_school on subscription_payment_transactions(school_id);
create index idx_subscription_payment_transactions_rrr on subscription_payment_transactions(rrr);
create index idx_subscription_payment_transactions_status on subscription_payment_transactions(status);

alter table subscription_payment_transactions enable row level security;
create policy "temp_allow_all_authenticated" on subscription_payment_transactions
  for all to authenticated using (true) with check (true);
