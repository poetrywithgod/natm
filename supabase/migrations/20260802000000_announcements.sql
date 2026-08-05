create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  title text not null,
  body text not null,
  target_students boolean not null default false,
  target_parents boolean not null default false,
  target_staff boolean not null default true,
  posted_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table announcements enable row level security;

create policy "temp_permissive_announcements" on announcements
  for all using (true) with check (true);

create index if not exists idx_announcements_school on announcements(school_id, created_at desc);
