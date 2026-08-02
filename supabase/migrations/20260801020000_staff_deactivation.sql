alter table profiles add column is_active boolean not null default true;
alter table profiles add column deactivated_at timestamptz;

create index if not exists idx_profiles_is_active on profiles(is_active);
