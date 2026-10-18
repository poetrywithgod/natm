-- ============================================================
-- Homeschool tenants, step 2a (2/2): what homeschool_teacher may do
-- ============================================================
-- Adds NO new tables. Makes the existing role-scoped policies treat
-- homeschool_teacher as school_admin + class_teacher + shadow_teacher,
-- and confines the role to homeschool tenants.
--
-- Deliberately NOT included: finance_manager powers (homeschool tenants
-- have no internal fees) and the Parent Model Forum / PTA chat (single
-- family, no group chat). The chat functions only list the roles they
-- name, so homeschool_teacher stays out of them without any change.
--
-- Additive: no existing row, column or table changes. Existing roles
-- keep exactly the access they have today.
-- ============================================================

-- 1. homeschool_teacher may only exist inside a homeschool tenant.
--    No auth.uid() exemption on purpose: this is a data rule, so it holds
--    for edge functions (service role) and direct SQL as well.
create or replace function profiles_guard_homeschool_teacher()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role = 'homeschool_teacher'::staff_role then
    if new.school_id is null
       or not exists (
         select 1 from schools s
          where s.id = new.school_id and s.school_type = 'homeschool'
       ) then
      raise exception 'homeschool_teacher can only belong to a homeschool tenant'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_homeschool_teacher on profiles;
create trigger profiles_guard_homeschool_teacher
  before insert or update of role, school_id on profiles
  for each row execute function profiles_guard_homeschool_teacher();

-- 2. Counts as "school staff" (the broad read/oversight checks).
create or replace function app_is_school_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role in ('school_admin', 'class_teacher', 'shadow_teacher', 'finance_manager', 'homeschool_teacher')
  )
$$;

-- 3. Every policy that names school_admin, class_teacher or
--    shadow_teacher through app_role() = '<role>' also admits
--    homeschool_teacher. Rewritten from the live definitions rather than
--    re-typed, so it covers every table the earlier role-scoped
--    migrations touched (and any added since) without risk of a typo
--    silently dropping a clause. Safe to re-run: already-extended
--    policies no longer match the pattern.
do $$
declare
  r record;
  pat constant text := '\(app_role\(\) = ''(school_admin|class_teacher|shadow_teacher)''::staff_role\)';
  rep constant text := '(app_role() = ANY (ARRAY[''\1''::staff_role, ''homeschool_teacher''::staff_role]))';
  new_using text;
  new_check text;
  stmt text;
  changed int := 0;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (qual ~ pat or with_check ~ pat)
  loop
    new_using := case when r.qual is null then null else regexp_replace(r.qual, pat, rep, 'g') end;
    new_check := case when r.with_check is null then null else regexp_replace(r.with_check, pat, rep, 'g') end;

    stmt := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if new_using is not null then
      stmt := stmt || format(' using (%s)', new_using);
    end if;
    if new_check is not null then
      stmt := stmt || format(' with check (%s)', new_check);
    end if;
    execute stmt;
    changed := changed + 1;
  end loop;
  raise notice 'homeschool_teacher: extended % policies', changed;
end $$;

-- 4. Linking a guardian to a student login: a homeschool teacher is the
--    tenant's admin too. Same function as 20261002000000, with only the
--    caller check widened.
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
  if auth.uid() is null
     or coalesce(app_role() = any (array['school_admin'::staff_role, 'homeschool_teacher'::staff_role]), false) = false then
    raise exception 'only a school admin or homeschool teacher can link a guardian' using errcode = '42501';
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

-- 5. Guardian details on a student's "parent data" tab: a homeschool
--    teacher is the tenant's admin and teacher in one, so they see every
--    student's guardians in their own tenant. Same function as
--    20261001000000, with one added clause.
create or replace function get_student_guardians(target_student_id uuid)
returns table (
  parent_id    uuid,
  full_name    text,
  relationship text,
  phone        text,
  address      text,
  photo_url    text,
  email        text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s_school  uuid;
  s_class   uuid;
  permitted boolean;
begin
  select st.school_id, st.class_id into s_school, s_class
    from students st where st.id = target_student_id;
  if s_school is null then
    return;
  end if;

  permitted :=
       app_is_super_admin()
    or (app_role() = 'school_admin' and s_school = app_school_id())
    or (app_role() = 'homeschool_teacher' and s_school = app_school_id())
    or (app_role() = 'class_teacher' and s_school = app_school_id()
        and exists (select 1 from classes c
                     where c.id = s_class and c.class_teacher_id = auth.uid()))
    or (app_role() = 'shadow_teacher'
        and exists (select 1 from shadow_teacher_assignments a
                     where a.student_id = target_student_id
                       and a.shadow_teacher_id = auth.uid()
                       and a.is_active));

  if not permitted then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
    select p.id, p.full_name, l.relationship, p.phone, p.address, p.photo_url,
           u.email::text
      from parent_student_links l
      join profiles p on p.id = l.parent_id
      left join auth.users u on u.id = p.id
     where l.student_id = target_student_id
     order by l.created_at;
end;
$$;
