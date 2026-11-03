-- ============================================================
-- Daily logs: per-student access + direct shadow-teacher assignment
-- ============================================================
-- 1. Access fix. Until now the two daily-log tables were readable by ANY
--    user in the school (parents included, via app_in_own_school) and
--    writable by ANY class teacher / shadow teacher in the school. Only the
--    app's roster screens limited who saw which child.
--
--    After this migration:
--      READ   super admin; school admin and homeschool teacher of the
--             student's school; the class teacher of the student's CURRENT
--             class; the student's active shadow teacher; a linked parent;
--             the child acting as themselves.
--      WRITE  daily_teacher_observations: the class teacher of the
--             student's CURRENT class (or the school's homeschool teacher).
--             shadow_teacher_daily_records: the student's active shadow
--             teacher (or the school's homeschool teacher).
--    finance_manager no longer reads daily logs.
--    Class changes are followed automatically: the new class teacher sees
--    the child's full history, the old one stops seeing it.
--
-- 2. assign_shadow_teacher(): lets a school admin / homeschool teacher
--    assign or change a child's shadow teacher directly, without a
--    completed intake episode, so daily logs can start before Form 1.
--    Atomic (the old two-step client flow could leave a child with no
--    shadow teacher if the second step failed). Requires a class, because
--    the shadow daily record is filed against the child's class.
--
-- Additive: no rows, columns or tables change. Policies on the two log
-- tables are replaced; everything else is untouched.
-- ============================================================

-- ---------- 1. Helper functions ----------

create or replace function app_can_view_student_logs(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from students s
     where s.id = target_student_id
       and (
            app_is_super_admin()
         or (app_role() in ('school_admin'::staff_role, 'homeschool_teacher'::staff_role)
             and s.school_id = app_school_id())
         or (app_role() = 'class_teacher'::staff_role
             and s.school_id = app_school_id()
             and exists (select 1 from classes c
                          where c.id = s.class_id and c.class_teacher_id = auth.uid()))
         or (app_role() = 'shadow_teacher'::staff_role
             and exists (select 1 from shadow_teacher_assignments a
                          where a.student_id = s.id
                            and a.shadow_teacher_id = auth.uid()
                            and a.is_active))
         or app_is_linked_parent(s.id)
         or app_is_own_student(s.id)
       )
  )
$$;

create or replace function app_can_write_class_log(target_student_id uuid, target_school uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from students s
     where s.id = target_student_id
       and s.school_id = target_school
       and s.school_id = app_school_id()
       and (
            app_role() = 'homeschool_teacher'::staff_role
         or (app_role() = 'class_teacher'::staff_role
             and exists (select 1 from classes c
                          where c.id = s.class_id and c.class_teacher_id = auth.uid()))
       )
  )
$$;

create or replace function app_can_write_shadow_log(target_student_id uuid, target_school uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from students s
     where s.id = target_student_id
       and s.school_id = target_school
       and s.school_id = app_school_id()
       and (
            app_role() = 'homeschool_teacher'::staff_role
         or (app_role() = 'shadow_teacher'::staff_role
             and exists (select 1 from shadow_teacher_assignments a
                          where a.student_id = s.id
                            and a.shadow_teacher_id = auth.uid()
                            and a.is_active))
       )
  )
$$;

revoke all on function app_can_view_student_logs(uuid)        from public, anon;
revoke all on function app_can_write_class_log(uuid, uuid)    from public, anon;
revoke all on function app_can_write_shadow_log(uuid, uuid)   from public, anon;
grant execute on function app_can_view_student_logs(uuid)       to authenticated;
grant execute on function app_can_write_class_log(uuid, uuid)   to authenticated;
grant execute on function app_can_write_shadow_log(uuid, uuid)  to authenticated;

-- ---------- 2. Policies on the two log tables ----------

drop policy if exists "daily_teacher_observations_school_staff"   on daily_teacher_observations;
drop policy if exists "daily_teacher_observations_select"         on daily_teacher_observations;
drop policy if exists "daily_teacher_observations_write"          on daily_teacher_observations;
drop policy if exists "daily_teacher_observations_select_family"  on daily_teacher_observations;

create policy "daily_teacher_observations_select" on daily_teacher_observations
  for select to authenticated
  using (app_can_view_student_logs(student_id));
create policy "daily_teacher_observations_write" on daily_teacher_observations
  for all to authenticated
  using (app_can_write_class_log(student_id, school_id))
  with check (app_can_write_class_log(student_id, school_id));

drop policy if exists "shadow_teacher_daily_records_school_staff"   on shadow_teacher_daily_records;
drop policy if exists "shadow_teacher_daily_records_select"         on shadow_teacher_daily_records;
drop policy if exists "shadow_teacher_daily_records_write"          on shadow_teacher_daily_records;
drop policy if exists "shadow_teacher_daily_records_select_family"  on shadow_teacher_daily_records;

create policy "shadow_teacher_daily_records_select" on shadow_teacher_daily_records
  for select to authenticated
  using (app_can_view_student_logs(student_id));
create policy "shadow_teacher_daily_records_write" on shadow_teacher_daily_records
  for all to authenticated
  using (app_can_write_shadow_log(student_id, school_id))
  with check (app_can_write_shadow_log(student_id, school_id));

-- ---------- 3. Direct shadow-teacher assignment ----------

create or replace function assign_shadow_teacher(
  target_student_id uuid,
  target_teacher_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s_school  uuid;
  s_class   uuid;
  t_role    staff_role;
  t_school  uuid;
  t_active  boolean;
  current_t uuid;
begin
  if auth.uid() is null
     or coalesce(app_role() = any (array['school_admin'::staff_role, 'homeschool_teacher'::staff_role]), false) = false then
    raise exception 'only a school admin or homeschool teacher can assign a shadow teacher'
      using errcode = '42501';
  end if;

  select school_id, class_id into s_school, s_class
    from students where id = target_student_id;
  if s_school is null or s_school is distinct from app_school_id() then
    raise exception 'student not found' using errcode = '42501';
  end if;
  if s_class is null then
    raise exception 'assign a class to this student first' using errcode = 'P0001';
  end if;

  select role, school_id, is_active into t_role, t_school, t_active
    from profiles where id = target_teacher_id;
  if t_school is distinct from s_school
     or t_role not in ('shadow_teacher'::staff_role, 'homeschool_teacher'::staff_role)
     or coalesce(t_active, false) = false then
    raise exception 'that person cannot be a shadow teacher for this student' using errcode = 'P0001';
  end if;

  select shadow_teacher_id into current_t
    from shadow_teacher_assignments
   where student_id = target_student_id and is_active;

  if current_t is not distinct from target_teacher_id then
    return jsonb_build_object('outcome', 'unchanged', 'shadow_teacher_id', target_teacher_id);
  end if;

  update shadow_teacher_assignments
     set is_active = false, ended_at = now()
   where student_id = target_student_id and is_active;

  insert into shadow_teacher_assignments (student_id, shadow_teacher_id, is_active)
  values (target_student_id, target_teacher_id, true);

  return jsonb_build_object(
    'outcome', case when current_t is null then 'assigned' else 'changed' end,
    'shadow_teacher_id', target_teacher_id,
    'previous_shadow_teacher_id', current_t
  );
end;
$$;

revoke all on function assign_shadow_teacher(uuid, uuid) from public, anon;
grant execute on function assign_shadow_teacher(uuid, uuid) to authenticated;
