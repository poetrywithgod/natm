-- ============================================================
-- Platform integration status board, for the Super Admin
-- "Integrations" page. A handful of rows (one per external
-- dependency), most of which can only be checked manually
-- (no merchant account to ping for Remita, no way to verify
-- SMTP delivery from an edge function) -- 'anthropic' is the
-- one exception with a real live check (test-anthropic-connection).
-- Same temp-permissive RLS pattern as the rest of this schema
-- (see initial_schema.sql) -- authorization is enforced at the
-- app/edge-function layer, not here.
-- ============================================================

create table system_integrations (
  id text primary key,
  label text not null,
  status text not null default 'not_configured'
    check (status in ('not_configured', 'blocked', 'configured', 'working')),
  notes text,
  last_checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table system_integrations enable row level security;

create policy "temp_allow_all_authenticated" on system_integrations
  for all to authenticated using (true) with check (true);

insert into system_integrations (id, label, status, notes) values
  (
    'anthropic',
    'Anthropic AI (Intake Recommendations)',
    'blocked',
    'ANTHROPIC_API_KEY has $0 credit — Nigerian card declined on console.anthropic.com. Use "Test Connection" to re-check after topping up.'
  ),
  (
    'remita',
    'Remita Payments',
    'configured',
    'Code-complete everywhere (fees, subscriptions) but genuinely untested — no live Remita merchant account exists yet.'
  ),
  (
    'email',
    'Email / SMTP',
    'blocked',
    'Custom SMTP is routed through Brevo, whose forced click-tracking breaks Supabase Auth confirmation links (invite/reset). No verified domain yet for an alternative provider (Resend/SES/Postmark all require one to send to real recipients).'
  ),
  (
    'domain',
    'Platform Domain',
    'not_configured',
    'No custom domain purchased yet. The CCSF site runs on a placeholder Vercel URL.'
  )
on conflict (id) do nothing;
