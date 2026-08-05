create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

alter table audit_logs enable row level security;

create policy "temp_permissive_audit_logs" on audit_logs
  for all using (true) with check (true);

create index if not exists idx_audit_logs_school on audit_logs(school_id, created_at desc);
