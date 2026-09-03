-- ============================================================
-- Sales pipeline for prospective schools, before they become a
-- real tenant. Deliberately a separate, lightweight table from
-- `schools` -- a prospect has no students, staff, curriculum
-- access, or billing, and shouldn't need any of that
-- infrastructure just to be tracked as a lead. Converting a
-- prospect ("won") creates a real school via the existing
-- create-school Edge Function and records the link, rather
-- than prospects ever becoming schools in place.
-- ============================================================

create table prospects (
  id uuid primary key default gen_random_uuid(),
  school_name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  stage text not null default 'new'
    check (stage in ('new', 'contacted', 'demo_scheduled', 'negotiating', 'won', 'lost')),
  notes text,
  converted_school_id uuid references schools(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table prospects enable row level security;

create policy "temp_allow_all_authenticated" on prospects
  for all to authenticated using (true) with check (true);

create index idx_prospects_stage on prospects(stage, created_at desc);
