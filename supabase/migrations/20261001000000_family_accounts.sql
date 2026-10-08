-- ============================================================
-- Family accounts (step 2): one shared login per family, with a
-- server-enforced Parent / Student mode.
--
-- Model
--   * A family logs in as ONE auth user with profiles.role = 'parent'.
--   * "Student mode" is per login SESSION (JWT session_id), stored in
--     session_modes and switched only through set_session_mode().
--     A session with no row is in PARENT mode (safe default).
--   * Parent mode  = monitoring + fees + foundation pledges + own
--     profile. Student mode = school work (quizzes, badges, intake,
--     the child's own record).
--   * Legacy student logins (role = 'student') are unchanged.
--
-- Schema changes are additive. The only existing objects replaced:
--   - app_is_own_student()      (now means "acting as that student")
--   - students_update_family, assessment_episodes_parent and
--     form1_submissions_parent policies (parent-mode writes removed;
--     student-mode writes added).
-- No rows are modified by this migration.
--
-- DEPLOY ORDER: ship the app with the Parent/Student toggle BEFORE
-- applying this to production, otherwise parent-role accounts lose
-- the ability to write intake/student data until they can switch mode.
-- ============================================================

-- ---------- 1. Additive columns / tables ----------

alter table students add column if not exists archived_at timestamptz;

create table if not exists family_conversion_log (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null,              -- no FK: the log must outlive deletes
  student_id    uuid,
  previous_role staff_role not null,
  link_created  boolean not null default false,
  action        text not null check (action in ('convert', 'revert')),
  created_at    timestamptz not null default now()
);
alter table family_conversion_log enable row level security;
create policy "family_conversion_log_super_admin_read" on family_conversion_log
  for select to authenticated using (app_is_super_admin());

create table if not exists session_modes (
  session_id uuid primary key,
  user_id    uuid not null references profiles(id) on delete cascade,
  mode       text not null check (mode in ('parent', 'student')),
  updated_at timestamptz not null default now()
);
create index if not exists idx_session_modes_user on session_modes(user_id);
alter table session_modes enable row level security;  -- no policies: RPC only

-- ---------- 2. Session mode ----------

create or replace function app_session_mode()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select m.mode from session_modes m
      where m.user_id = auth.uid()
        and m.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid),
    'parent')
$$;

create or replace function set_session_mode(new_mode text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  r   staff_role;
  n   bigint;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if new_mode not in ('parent', 'student') then
    raise exception 'invalid mode %', new_mode;
  end if;
  select role into r from profiles where id = auth.uid();
  if r is distinct from 'parent'::staff_role then
    raise exception 'only family (parent) accounts can switch mode' using errcode = '42501';
  end if;
  sid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  if sid is null then
    raise exception 'no session id in token' using errcode = '42501';
  end if;

  insert into session_modes (session_id, user_id, mode)
  values (sid, auth.uid(), new_mode)
  on conflict (session_id) do update
    set mode = excluded.mode, updated_at = now()
    where session_modes.user_id = auth.uid();
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'session belongs to another user' using errcode = '42501';
  end if;

  delete from session_modes
   where user_id = auth.uid() and updated_at < now() - interval '30 days';

  return new_mode;
end;
$$;

-- "Is the caller acting as this student right now?"
--   * legacy student login (role = student) on their own record, or
--   * a family (parent-role) account in STUDENT mode, for a child they
--     are linked to or whose own login they hold.
create or replace function app_is_own_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from students s
    where s.id = target_student_id
      and (
        (s.profile_id = auth.uid() and app_role() = 'student')
        or (
          app_role() = 'parent'
          and app_session_mode() = 'student'
          and (s.profile_id = auth.uid() or app_is_linked_parent(s.id))
        )
      )
  )
$$;

-- ---------- 3. Policies: parent mode reads, student mode writes ----------

drop policy if exists "students_update_family" on students;
create policy "students_update_acting_student" on students
  for update to authenticated
  using (app_is_own_student(id))
  with check (app_is_own_student(id));

drop policy if exists "assessment_episodes_parent" on assessment_episodes;
create policy "assessment_episodes_family_select" on assessment_episodes
  for select to authenticated
  using (app_is_linked_parent(student_id) or app_is_own_student(student_id));
create policy "assessment_episodes_acting_student_write" on assessment_episodes
  for all to authenticated
  using (app_is_own_student(student_id))
  with check (app_is_own_student(student_id));

drop policy if exists "form1_submissions_parent" on form1_submissions;
create policy "form1_submissions_family_select" on form1_submissions
  for select to authenticated
  using (app_is_linked_parent(student_id) or app_is_own_student(student_id));
create policy "form1_submissions_acting_student_write" on form1_submissions
  for all to authenticated
  using (app_is_own_student(student_id))
  with check (app_is_own_student(student_id));

-- ---------- 4. Guardian details for staff ----------
-- School admin: any student in their school. Class teacher: students in
-- their class. Shadow teacher: students they are actively assigned to.

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

-- ---------- 5. Conversion of existing student logins (service role only) ----------
-- Run from the SQL editor / service role (auth.uid() is NULL there).
-- Keeps students.profile_id, so every FK and the submitted_by audit
-- trail stay valid. Fully reversible via revert_family_conversion().

create or replace function convert_student_login_to_family(
  target_student_id uuid,
  rel text default 'Parent/Guardian'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pid      uuid;
  prev     staff_role;
  onboard  text;
  existed  boolean;
begin
  if auth.uid() is not null then
    raise exception 'service role / SQL editor only' using errcode = '42501';
  end if;

  select s.profile_id, s.onboarding_status::text into pid, onboard
    from students s where s.id = target_student_id;
  if pid is null then
    raise exception 'student % has no own login to convert', target_student_id;
  end if;

  select role into prev from profiles where id = pid;
  if prev is distinct from 'student'::staff_role then
    raise exception 'profile % has role % (expected student)', pid, prev;
  end if;

  select exists (select 1 from parent_student_links
                  where parent_id = pid and student_id = target_student_id) into existed;
  if not existed then
    insert into parent_student_links (parent_id, student_id, relationship)
    values (pid, target_student_id, rel);
  end if;

  update profiles
     set role = 'parent',
         must_change_password = must_change_password or (onboard = 'pending_password_reset')
   where id = pid;

  insert into family_conversion_log (profile_id, student_id, previous_role, link_created, action)
  values (pid, target_student_id, prev, not existed, 'convert');
end;
$$;

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

  update profiles set role = lg.previous_role where id = pid;
  if lg.link_created then
    delete from parent_student_links where parent_id = pid and student_id = target_student_id;
  end if;
  delete from session_modes where user_id = pid;

  insert into family_conversion_log (profile_id, student_id, previous_role, link_created, action)
  values (pid, target_student_id, lg.previous_role, lg.link_created, 'revert');
end;
$$;

-- ---------- 6. Grants ----------
revoke all on function convert_student_login_to_family(uuid, text) from public, anon, authenticated;
revoke all on function revert_family_conversion(uuid)              from public, anon, authenticated;
revoke all on function set_session_mode(text)                      from public, anon;
revoke all on function get_student_guardians(uuid)                 from public, anon;
revoke all on function app_session_mode()                          from public, anon;
grant execute on function set_session_mode(text)      to authenticated;
grant execute on function get_student_guardians(uuid) to authenticated;
grant execute on function app_session_mode()         to authenticated;
