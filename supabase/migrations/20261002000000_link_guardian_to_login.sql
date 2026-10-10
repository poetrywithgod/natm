-- ============================================================
-- Link a guardian to an EXISTING student login (no email needed).
--
-- Why: every existing student login already uses the family's real
-- email, so "linking a parent" must not ask for another email. The
-- school admin supplies the guardian's name, relationship and optional
-- phone/address; that same login becomes the family account
-- (role student -> parent) and is linked to the child. The family keeps
-- signing in with the same email and password and gains the
-- Parent / Student toggle.
--
-- Additive: new nullable columns, one new function, and two replaced
-- functions (profiles_guard_columns, revert_family_conversion).
-- No rows are modified by this migration.
-- ============================================================

-- 1. Remember what the profile looked like before conversion, so a
--    revert can restore it (the login's profile name was the child's).
alter table family_conversion_log add column if not exists previous_full_name text;
alter table family_conversion_log add column if not exists previous_phone     text;
alter table family_conversion_log add column if not exists previous_address   text;

-- 2. The profile guard must let trusted SECURITY DEFINER functions
--    (which run as the function owner, not as `authenticated`) change
--    role; direct client updates still run as `authenticated` and stay
--    blocked.
create or replace function profiles_guard_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Service role / direct SQL (no uid), or a trusted SECURITY DEFINER
  -- function (runs as its owner, not as a client role).
  if auth.uid() is null or current_user not in ('authenticated', 'anon') then
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

-- 3. School admin links a guardian to a student who already has a login.
create or replace function link_guardian_to_student_login(
  target_student_id uuid,
  guardian_name     text,
  rel               text,
  guardian_phone    text default null,
  guardian_address  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s_school  uuid;
  pid       uuid;
  onboard   text;
  prev_role staff_role;
  prev_name text;
  prev_phone text;
  prev_addr  text;
  existed   boolean;
  gname     text := nullif(btrim(guardian_name), '');
  grel      text := coalesce(nullif(btrim(rel), ''), 'Parent/Guardian');
begin
  if auth.uid() is null or app_role() is distinct from 'school_admin'::staff_role then
    raise exception 'only a school admin can link a guardian' using errcode = '42501';
  end if;
  if gname is null then
    raise exception 'guardian name is required';
  end if;

  select s.school_id, s.profile_id, s.onboarding_status::text
    into s_school, pid, onboard
    from students s where s.id = target_student_id;
  if s_school is null or s_school is distinct from app_school_id() then
    raise exception 'student not found' using errcode = '42501';
  end if;
  if pid is null then
    raise exception 'student has no login yet; admit with a family email instead'
      using errcode = 'P0002';
  end if;

  select role, full_name, phone, address
    into prev_role, prev_name, prev_phone, prev_addr
    from profiles where id = pid;

  if prev_role is distinct from 'student'::staff_role
     and prev_role is distinct from 'parent'::staff_role then
    raise exception 'this login belongs to a % account and cannot be a family login', prev_role;
  end if;

  select exists (select 1 from parent_student_links
                  where parent_id = pid and student_id = target_student_id) into existed;
  if existed then
    update parent_student_links set relationship = grel
     where parent_id = pid and student_id = target_student_id;
  else
    insert into parent_student_links (parent_id, student_id, relationship)
    values (pid, target_student_id, grel);
  end if;

  update profiles
     set role      = 'parent',
         full_name = gname,
         phone     = coalesce(nullif(btrim(guardian_phone), ''), phone),
         address   = coalesce(nullif(btrim(guardian_address), ''), address),
         must_change_password = must_change_password or (onboard = 'pending_password_reset')
   where id = pid;

  if prev_role = 'student'::staff_role then
    insert into family_conversion_log
      (profile_id, student_id, previous_role, link_created, action,
       previous_full_name, previous_phone, previous_address)
    values
      (pid, target_student_id, prev_role, not existed, 'convert',
       prev_name, prev_phone, prev_addr);
  end if;

  return jsonb_build_object(
    'outcome', case when prev_role = 'student'::staff_role then 'converted' else 'updated' end,
    'parent_id', pid
  );
end;
$$;

-- 4. Revert also restores the profile's previous name/phone/address.
create or replace function revert_family_conversion(target_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
  lg  family_conversion_log%rowtype;
begin
  if auth.uid() is not null then
    raise exception 'service role / SQL editor only' using errcode = '42501';
  end if;

  select s.profile_id into pid from students s where s.id = target_student_id;
  select * into lg from family_conversion_log
   where profile_id = pid and student_id = target_student_id and action = 'convert'
   order by created_at desc limit 1;
  if lg.id is null then
    raise exception 'no conversion recorded for student %', target_student_id;
  end if;

  update profiles
     set role      = lg.previous_role,
         full_name = coalesce(lg.previous_full_name, full_name),
         phone     = case when lg.previous_full_name is not null then lg.previous_phone   else phone   end,
         address   = case when lg.previous_full_name is not null then lg.previous_address else address end
   where id = pid;
  if lg.link_created then
    delete from parent_student_links where parent_id = pid and student_id = target_student_id;
  end if;
  delete from session_modes where user_id = pid;

  insert into family_conversion_log (profile_id, student_id, previous_role, link_created, action)
  values (pid, target_student_id, lg.previous_role, lg.link_created, 'revert');
end;
$$;

-- 5. Grants
revoke all on function link_guardian_to_student_login(uuid, text, text, text, text) from public, anon;
grant execute on function link_guardian_to_student_login(uuid, text, text, text, text) to authenticated;
revoke all on function revert_family_conversion(uuid) from public, anon, authenticated;
