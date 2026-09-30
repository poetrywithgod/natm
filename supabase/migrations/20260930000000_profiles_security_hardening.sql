-- ============================================================
-- Profiles security hardening (step 1 of the family-account work).
--
-- 1. profiles_update_self (real_rls_policies) is row-level only: a
--    signed-in user could PATCH their own profile row and change
--    `role` or `school_id`. RLS can't restrict columns, so a BEFORE
--    UPDATE trigger blocks client changes to id / role / school_id.
--    Service-role callers (edge functions, SQL editor) have
--    auth.uid() = NULL and are unaffected.
--
-- 2. must_change_password was cleared by a client-side profiles
--    update, so it could be bypassed without changing the password.
--    Clients may no longer flip it true -> false. Instead it is
--    cleared server-side, only when auth.users.encrypted_password
--    actually changes.
--
-- Additive: no table, column, policy, or row is changed or removed.
-- ============================================================

create or replace function profiles_guard_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- NULL uid = service role / direct SQL / trusted server context.
  if auth.uid() is null then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'profiles.id cannot be changed' using errcode = '42501';
  end if;
  if new.role is distinct from old.role then
    raise exception 'profiles.role cannot be changed by the user' using errcode = '42501';
  end if;
  if new.school_id is distinct from old.school_id then
    raise exception 'profiles.school_id cannot be changed by the user' using errcode = '42501';
  end if;
  if old.must_change_password = true and new.must_change_password = false then
    raise exception 'must_change_password is cleared automatically when the password changes'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_columns on profiles;
create trigger profiles_guard_columns
  before update on profiles
  for each row execute function profiles_guard_columns();

-- Clear the forced-reset flag only when the password really changed.
create or replace function clear_must_change_password_on_password_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set must_change_password = false
   where id = new.id
     and must_change_password = true;
  return new;
end;
$$;

drop trigger if exists on_auth_password_changed on auth.users;
create trigger on_auth_password_changed
  after update of encrypted_password on auth.users
  for each row
  when (old.encrypted_password is distinct from new.encrypted_password)
  execute function clear_must_change_password_on_password_change();
