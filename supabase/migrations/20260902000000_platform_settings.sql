-- ============================================================
-- Platform-wide settings, for the Super Admin "Settings" page.
-- Single row (id fixed to 'default') rather than a key-value
-- table -- there are only ever two small groups of settings
-- here, and a fixed-shape row is simpler to read/update than
-- a generic settings-store abstraction would be for this size.
-- Same temp-permissive RLS pattern as the rest of this schema.
-- ============================================================

create table platform_settings (
  id text primary key default 'default',
  -- Pre-fills a new school's Term 1/2/3 subscription_fee_schedule rows at
  -- creation time (create-school Edge Function) so Super Admin isn't
  -- re-entering the same rate card by hand for every new school. Null
  -- means "no default yet" -- create-school skips any term left null.
  default_term_1_fee numeric(12,2),
  default_term_2_fee numeric(12,2),
  default_term_3_fee numeric(12,2),
  maintenance_mode boolean not null default false,
  maintenance_message text,
  updated_at timestamptz not null default now()
);

alter table platform_settings enable row level security;

create policy "temp_allow_all_authenticated" on platform_settings
  for all to authenticated using (true) with check (true);

insert into platform_settings (id) values ('default')
on conflict (id) do nothing;
