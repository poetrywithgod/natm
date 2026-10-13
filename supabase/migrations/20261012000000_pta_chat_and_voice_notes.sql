-- ============================================================
-- Parent <-> Class Teacher messaging, per-school PTA group chat,
-- and voice notes for both.
--
-- 1. DIRECT THREADS (conversations / messages)
--    A conversation is still one (student, parent) pair, but there can
--    now be TWO per pair: one with the child's shadow teacher (existing)
--    and one with the child's class teacher (new). `teacher_kind` says
--    which, and exactly one of shadow_teacher_id / class_teacher_id is
--    set. Existing rows are untouched (they default to 'shadow_teacher').
--
-- 2. PTA GROUP
--    One group per school. Membership is NOT a stored list -- it is a
--    rule, evaluated live (app_is_pta_group_member): every ACTIVE profile
--    of that school whose role is parent, class_teacher, shadow_teacher,
--    school_admin or finance_manager. New parents/staff are therefore in
--    the group the moment their account exists, and deactivated staff
--    drop out automatically -- nothing to sync, nothing to go stale.
--    A family login that is currently in Student mode is excluded
--    (student-facing school work stays separate from parent chat).
--
-- 3. VOICE NOTES
--    messages / pta_messages get audio_path + audio_duration_ms. Files
--    live in a PRIVATE bucket, chat-voice-notes, and are read through
--    signed URLs. Path convention:
--      {school_id}/dm/{conversation_id}/{file}
--      {school_id}/pta/{group_id}/{file}
--
-- Additive: no existing row is modified. Existing policies replaced:
-- conversations_participants and messages_participants (tightened --
-- see notes inline).
-- ============================================================


-- ============================================================
-- 1. DIRECT THREADS
-- ============================================================

alter table conversations alter column shadow_teacher_id drop not null;

alter table conversations
  add column if not exists teacher_kind text not null default 'shadow_teacher'
    check (teacher_kind in ('shadow_teacher', 'class_teacher')),
  add column if not exists class_teacher_id uuid references profiles(id) on delete cascade,
  add column if not exists class_teacher_last_read_at timestamptz;

alter table conversations
  add constraint conversations_teacher_matches_kind check (
    (teacher_kind = 'shadow_teacher' and shadow_teacher_id is not null and class_teacher_id is null)
    or
    (teacher_kind = 'class_teacher' and class_teacher_id is not null and shadow_teacher_id is null)
  );

drop index if exists one_conversation_per_student_parent;
create unique index one_conversation_per_student_parent_kind
  on conversations(student_id, parent_id, teacher_kind);
create index if not exists idx_conversations_class_teacher_id on conversations(class_teacher_id);

alter table messages drop constraint if exists messages_sender_role_check;
alter table messages
  add constraint messages_sender_role_check
  check (sender_role in ('parent', 'shadow_teacher', 'class_teacher'));

alter table messages alter column body drop not null;
alter table messages
  add column if not exists audio_path text,
  add column if not exists audio_duration_ms integer
    check (audio_duration_ms is null or (audio_duration_ms > 0 and audio_duration_ms <= 300000));
alter table messages
  add constraint messages_has_content check (
    nullif(btrim(coalesce(body, '')), '') is not null or audio_path is not null
  );

-- Is this a real parent/student/teacher combination? Used by the
-- conversations write policy so nobody can open a thread with a person
-- who isn't actually that child's teacher, or about a child who isn't
-- theirs. The shadow teacher must hold the ACTIVE assignment; the class
-- teacher must be the teacher of the class the student is in.
create or replace function app_dm_valid(
  p_school uuid, p_student uuid, p_parent uuid,
  p_kind text, p_shadow uuid, p_class uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (select 1 from students s where s.id = p_student and s.school_id = p_school)
    and exists (
      select 1 from parent_student_links l
      where l.parent_id = p_parent and l.student_id = p_student
    )
    and case p_kind
      when 'shadow_teacher' then exists (
        select 1 from shadow_teacher_assignments a
        where a.student_id = p_student and a.shadow_teacher_id = p_shadow and a.is_active
      )
      when 'class_teacher' then exists (
        select 1 from students s join classes c on c.id = s.class_id
        where s.id = p_student and c.class_teacher_id = p_class
      )
      else false
    end
$$;

-- Is the caller a participant (not just an overseer) of this thread?
-- Parents only count while their login is in Parent mode.
create or replace function app_is_dm_participant(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from conversations c
    where c.id = p_conversation
      and (
        (c.parent_id = auth.uid() and app_session_mode() = 'parent')
        or c.shadow_teacher_id = auth.uid()
        or c.class_teacher_id = auth.uid()
      )
  )
$$;

create or replace function app_can_view_dm(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_is_dm_participant(p_conversation)
    or app_is_super_admin()
    or exists (
      select 1 from conversations c
      where c.id = p_conversation
        and app_role() = 'school_admin' and c.school_id = app_school_id()
    )
$$;

drop policy if exists "conversations_participants" on conversations;

create policy "conversations_select" on conversations
  for select to authenticated
  using (
    (parent_id = auth.uid() and app_session_mode() = 'parent')
    or shadow_teacher_id = auth.uid()
    or class_teacher_id = auth.uid()
    or (app_role() = 'school_admin' and school_id = app_school_id())
    or app_is_super_admin()
  );

create policy "conversations_insert" on conversations
  for insert to authenticated
  with check (
    app_dm_valid(school_id, student_id, parent_id, teacher_kind, shadow_teacher_id, class_teacher_id)
    and (
      (parent_id = auth.uid() and app_session_mode() = 'parent')
      or shadow_teacher_id = auth.uid()
      or class_teacher_id = auth.uid()
    )
  );

-- Participants update last_message_at / read markers (and the teacher
-- id when a student is reassigned); the new row must still be valid.
create policy "conversations_update" on conversations
  for update to authenticated
  using (
    (parent_id = auth.uid() and app_session_mode() = 'parent')
    or shadow_teacher_id = auth.uid()
    or class_teacher_id = auth.uid()
  )
  with check (
    app_dm_valid(school_id, student_id, parent_id, teacher_kind, shadow_teacher_id, class_teacher_id)
    and (
      (parent_id = auth.uid() and app_session_mode() = 'parent')
      or shadow_teacher_id = auth.uid()
      or class_teacher_id = auth.uid()
    )
  );

create policy "conversations_delete" on conversations
  for delete to authenticated
  using ((app_role() = 'school_admin' and school_id = app_school_id()) or app_is_super_admin());

drop policy if exists "messages_participants" on messages;

create policy "messages_select" on messages
  for select to authenticated
  using (app_can_view_dm(conversation_id));

-- Messages are immutable once sent. You can only send as yourself, in
-- your own role, into a thread you participate in, and a voice note
-- must live under that thread's own folder.
create policy "messages_insert" on messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and (
          (messages.sender_role = 'parent' and c.parent_id = auth.uid() and app_session_mode() = 'parent')
          or (messages.sender_role = 'shadow_teacher' and c.shadow_teacher_id = auth.uid())
          or (messages.sender_role = 'class_teacher' and c.class_teacher_id = auth.uid())
        )
        and (
          messages.audio_path is null
          or messages.audio_path like c.school_id::text || '/dm/' || c.id::text || '/%'
        )
    )
  );

create policy "messages_delete" on messages
  for delete to authenticated
  using (app_is_super_admin());


-- ============================================================
-- 2. PTA GROUP
-- ============================================================

create table pta_groups (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null unique references schools(id) on delete cascade,
  name            text not null default 'PTA Group',
  created_at      timestamptz not null default now()
);

create table pta_messages (
  id                uuid primary key default gen_random_uuid(),
  group_id          uuid not null references pta_groups(id) on delete cascade,
  school_id         uuid not null references schools(id) on delete cascade,
  sender_id         uuid references profiles(id) on delete set null,
  -- Snapshots, set by trigger: parents can't read each other's profiles,
  -- so the name has to travel with the message.
  sender_name       text not null default '',
  sender_role       text not null default '',
  body              text,
  audio_path        text,
  audio_duration_ms integer
    check (audio_duration_ms is null or (audio_duration_ms > 0 and audio_duration_ms <= 300000)),
  created_at        timestamptz not null default now(),
  check (nullif(btrim(coalesce(body, '')), '') is not null or audio_path is not null),
  check (audio_path is null or audio_path like school_id::text || '/pta/' || group_id::text || '/%')
);
create index idx_pta_messages_group_created on pta_messages(group_id, created_at desc);

create table pta_read_state (
  group_id      uuid not null references pta_groups(id) on delete cascade,
  profile_id    uuid not null references profiles(id) on delete cascade,
  last_read_at  timestamptz not null default now(),
  primary key (group_id, profile_id)
);

alter table pta_groups enable row level security;
alter table pta_messages enable row level security;
alter table pta_read_state enable row level security;

-- One group per school: created with the school, backfilled for the
-- schools that already exist.
create or replace function create_pta_group_for_school()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into pta_groups (school_id) values (new.id) on conflict (school_id) do nothing;
  return new;
end;
$$;

create trigger trg_schools_create_pta_group
  after insert on schools
  for each row execute function create_pta_group_for_school();

insert into pta_groups (school_id)
select id from schools
on conflict (school_id) do nothing;

-- Membership rule (see header). SECURITY DEFINER so it can read profiles
-- from inside another table's policy without recursing through RLS.
create or replace function app_is_pta_group_member(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from pta_groups g
    join profiles p on p.school_id = g.school_id
    where g.id = p_group
      and p.id = auth.uid()
      and p.is_active
      and p.role in ('parent', 'class_teacher', 'shadow_teacher', 'school_admin', 'finance_manager')
      and (p.role <> 'parent' or app_session_mode() = 'parent')
  )
$$;

create policy "pta_groups_select" on pta_groups
  for select to authenticated
  using (app_is_pta_group_member(id));

create policy "pta_messages_select" on pta_messages
  for select to authenticated
  using (app_is_pta_group_member(group_id));

create policy "pta_messages_insert" on pta_messages
  for insert to authenticated
  with check (sender_id = auth.uid() and app_is_pta_group_member(group_id));

-- Moderation: the school's admin can remove a message from their group.
create policy "pta_messages_delete" on pta_messages
  for delete to authenticated
  using (
    app_role() = 'school_admin' and school_id = app_school_id()
  );

create policy "pta_read_state_own" on pta_read_state
  for all to authenticated
  using (profile_id = auth.uid() and app_is_pta_group_member(group_id))
  with check (profile_id = auth.uid() and app_is_pta_group_member(group_id));

-- The client only supplies group + content. Who sent it, in what role,
-- and which school it belongs to are decided here, so none of it can be
-- spoofed.
create or replace function pta_messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p profiles%rowtype;
  g_school uuid;
begin
  select school_id into g_school from pta_groups where id = new.group_id;
  if g_school is null then
    raise exception 'PTA group not found';
  end if;
  new.school_id := g_school;

  if auth.uid() is not null then
    select * into p from profiles where id = auth.uid();
    new.sender_id := p.id;
    new.sender_name := p.full_name;
    new.sender_role := p.role::text;
  end if;
  return new;
end;
$$;

create trigger trg_pta_messages_before_insert
  before insert on pta_messages
  for each row execute function pta_messages_before_insert();

-- One in-app notification per member -- but only if they don't already
-- have an unread one for this group, so a busy chat produces a single
-- "new messages" nudge per person until they open it (not one push per
-- message per member).
create or replace function pta_messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  preview text;
begin
  preview := case
    when new.audio_path is not null and nullif(btrim(coalesce(new.body, '')), '') is null then 'Voice note'
    when length(new.body) > 100 then left(new.body, 100) || '…'
    else new.body
  end;

  insert into notifications (school_id, recipient_id, type, title, body, related_entity_type, related_entity_id)
  select new.school_id, p.id, 'pta_message', 'PTA Group',
         new.sender_name || ': ' || preview, 'pta_group', new.group_id
  from profiles p
  where p.school_id = new.school_id
    and p.is_active
    and p.id is distinct from new.sender_id
    and p.role in ('parent', 'class_teacher', 'shadow_teacher', 'school_admin', 'finance_manager')
    and not exists (
      select 1 from notifications n
      where n.recipient_id = p.id
        and n.type = 'pta_message'
        and n.related_entity_id = new.group_id
        and n.read_at is null
    );
  return new;
end;
$$;

create trigger trg_pta_messages_after_insert
  after insert on pta_messages
  for each row execute function pta_messages_after_insert();

alter publication supabase_realtime add table pta_messages;

-- Who is in the group: names and roles only (parents can't read each
-- other's profiles, and shouldn't -- phone/address stay private).
create or replace function get_pta_members(p_group uuid)
returns table (profile_id uuid, full_name text, role staff_role)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not app_is_pta_group_member(p_group) then
    raise exception 'Not a member of this group';
  end if;
  return query
    select p.id, p.full_name, p.role
    from pta_groups g
    join profiles p on p.school_id = g.school_id
    where g.id = p_group
      and p.is_active
      and p.role in ('parent', 'class_teacher', 'shadow_teacher', 'school_admin', 'finance_manager')
    order by
      case p.role
        when 'school_admin' then 1 when 'finance_manager' then 2
        when 'class_teacher' then 3 when 'shadow_teacher' then 4 else 5 end,
      p.full_name;
end;
$$;

-- One call for the list row: the caller's group, how many people are in
-- it, the latest message, and how many they haven't read.
create or replace function get_pta_overview()
returns table (
  group_id uuid, name text, member_count bigint,
  last_message_at timestamptz, last_message_preview text, unread_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  g pta_groups%rowtype;
  last_read timestamptz;
begin
  select pg.* into g from pta_groups pg where pg.school_id = app_school_id();
  if g.id is null or not app_is_pta_group_member(g.id) then
    return;
  end if;

  select r.last_read_at into last_read
  from pta_read_state r where r.group_id = g.id and r.profile_id = auth.uid();

  return query
    select
      g.id,
      g.name,
      (select count(*) from profiles p
        where p.school_id = g.school_id and p.is_active
          and p.role in ('parent', 'class_teacher', 'shadow_teacher', 'school_admin', 'finance_manager')),
      (select max(m.created_at) from pta_messages m where m.group_id = g.id),
      (select case
                when m.audio_path is not null and nullif(btrim(coalesce(m.body, '')), '') is null
                  then m.sender_name || ': Voice note'
                else m.sender_name || ': ' || m.body
              end
         from pta_messages m where m.group_id = g.id order by m.created_at desc limit 1),
      (select count(*) from pta_messages m
        where m.group_id = g.id
          and m.sender_id is distinct from auth.uid()
          and (last_read is null or m.created_at > last_read));
end;
$$;


-- ============================================================
-- 3. VOICE-NOTE STORAGE
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-voice-notes', 'chat-voice-notes', false, 10485760,
  array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/x-m4a', 'audio/wav']
)
on conflict (id) do nothing;

-- p_write = true  -> may the caller UPLOAD under this path? (participants only)
-- p_write = false -> may the caller READ it? (participants, plus the
--                    school admin for direct threads, matching the
--                    existing oversight rule on conversations)
create or replace function app_chat_audio_access(p_name text, p_write boolean)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[] := string_to_array(p_name, '/');
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_school uuid;
  v_owner  uuid;
begin
  if array_length(parts, 1) is null or array_length(parts, 1) < 4 then
    return false;
  end if;
  if parts[1] !~ uuid_re or parts[3] !~ uuid_re then
    return false;
  end if;
  v_school := parts[1]::uuid;
  v_owner  := parts[3]::uuid;

  if parts[2] = 'pta' then
    return exists (select 1 from pta_groups g where g.id = v_owner and g.school_id = v_school)
       and app_is_pta_group_member(v_owner);
  elsif parts[2] = 'dm' then
    if not exists (select 1 from conversations c where c.id = v_owner and c.school_id = v_school) then
      return false;
    end if;
    if p_write then
      return app_is_dm_participant(v_owner);
    end if;
    return app_can_view_dm(v_owner);
  end if;
  return false;
end;
$$;

create policy "chat_voice_notes_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-voice-notes' and app_chat_audio_access(name, false));

create policy "chat_voice_notes_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-voice-notes' and app_chat_audio_access(name, true));
