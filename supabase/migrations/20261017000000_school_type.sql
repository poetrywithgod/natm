-- ============================================================
-- Homeschool tenants, step 1: school_type
-- ============================================================
-- A homeschool family is a tenant in the same multi-tenant system as an
-- institutional school. This adds the discriminator only; the combined
-- homeschool teacher role, fee/attendance/promotion differences and the
-- public application flow are built in later steps.
--
-- Additive: every existing school becomes 'institution' via the default,
-- so nothing existing changes behaviour.
-- ============================================================

alter table schools
  add column if not exists school_type text not null default 'institution'
  check (school_type in ('institution', 'homeschool'));

-- Only Super Admin (or a trusted server context) may change a tenant's
-- type. School Admins can already update their own school row (School
-- Profile page), and RLS can't restrict columns, so without this guard a
-- school admin could flip their own school into a homeschool tenant.
-- NULL auth.uid() = service role / direct SQL, same convention as
-- profiles_guard_columns.
create or replace function schools_guard_school_type()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.school_type is distinct from old.school_type and not app_is_super_admin() then
    raise exception 'schools.school_type can only be changed by a super admin'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists schools_guard_school_type on schools;
create trigger schools_guard_school_type
  before update on schools
  for each row execute function schools_guard_school_type();
