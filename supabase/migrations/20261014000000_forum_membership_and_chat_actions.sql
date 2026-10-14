-- ============================================================
-- Parent Model Forum (formerly "PTA Group") + chat actions.
--
-- 1. MEMBERSHIP IS NOW EXPLICIT
--    Before: everyone at the school was in the group by rule.
--    Now: only the school admin(s) are in it by default. The admin
--    invites parents / teachers / the finance manager. The invitee gets
--    a notification and accepts or declines. Anyone except a school
--    admin can leave; the admin can remove people. Every join / leave /
--    removal is written into the chat as a system message.
--    A member only sees messages from the moment they joined.
--    (Internal names -- pta_groups, pta_messages, 'pta' routes -- are
--    unchanged; only what people read says "Parent Model Forum".)
--
-- 2. MESSAGE ACTIONS (group AND direct chats)
--    reply, edit (own text), delete (own; the school admin can delete
--    any forum message), react (one emoji per person per message).
--    Deleting is soft: the row stays as "This message was deleted" so
--    replies keep making sense; the text is wiped and a voice file is
--    removed by the daily purge job.
--
-- 3. CLEAR CHAT -- per person, hides everything up to now for them only.
--
-- 4. AVATARS -- member lists carry the profile photo path, and forum
--    co-members may now read each other's parent-photos objects.
-- ============================================================


-- ============================================================
-- 1. MEMBERSHIP
-- ============================================================

alter table pta_groups alter column name set default 'Parent Model Forum';
update pta_groups set name = 'Parent Model Forum' where name = 'PTA Group';

create table pta_members (
  group_id    uuid not null references pta_groups(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  status      text not null check (status in ('invited', 'active', 'declined', 'left', 'removed')),
  invited_by  uuid references profiles(id) on delete set null,
  invited_at  timestamptz,
  joined_at   timestamptz,
  updated_at  timestamptz not null default now(),
  primary key (group_id, profile_id)
);
create index idx_pta_members_profile on pta_members(profile_id);

alter table pta_members enable row level security;

-- Reads go through the RPCs below (so parents never see each other's
-- profiles); a person can only read their own row directly.
create policy "pta_members_select_own" on pta_members
  for select to authenticated
  using (profile_id = auth.uid());

-- School admins are members from the start (joined_at = epoch so they see
-- the whole history, including anything sent before this change).
insert into pta_members (group_id, profile_id, status, joined_at)
select g.id, p.id, 'active', 'epoch'::timestamptz
from pta_groups g
join profiles p on p.school_id = g.school_id and p.role = 'school_admin'
on conflict (group_id, profile_id) do nothing;

create or replace function forum_sync_admin_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'school_admin' and new.school_id is not null then
    insert into pta_members (group_id, profile_id, status, joined_at)
    select g.id, new.id, 'active', 'epoch'::timestamptz
    from pta_groups g
    where g.school_id = new.school_id
    on conflict (group_id, profile_id) do update
      set status = 'active', joined_at = 'epoch'::timestamptz, updated_at = now()
      where pta_members.status <> 'active';
  end if;
  return new;
end;
$$;

create trigger trg_profiles_forum_admin
  after insert or update of role, school_id on profiles
  for each row execute function forum_sync_admin_membership();

-- When is the caller a member of this group, and since when?  NULL = not a
-- member. Membership needs (a) an ACTIVE row in pta_members and (b) the
-- profile still being an active member of the group's school in an
-- eligible role (parents only while their login is in Parent mode).
create or replace function app_pta_member_since(p_group uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select m.joined_at
  from pta_members m
  join pta_groups g on g.id = m.group_id
  join profiles p on p.id = m.profile_id
  where m.group_id = p_group
    and m.profile_id = auth.uid()
    and m.status = 'active'
    and p.is_active
    and p.school_id = g.school_id
    and p.role in ('parent', 'class_teacher', 'shadow_teacher', 'school_admin', 'finance_manager')
    and (p.role <> 'parent' or app_session_mode() = 'parent')
$$;

create or replace function app_is_pta_group_member(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_pta_member_since(p_group) is not null
$$;

create or replace function app_is_forum_admin(p_group uuid)
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
      and p.role = 'school_admin'
  )
$$;


-- ============================================================
-- 2. FORUM MESSAGES: system notices, replies, edit, delete
-- ============================================================

alter table pta_messages
  add column if not exists kind        text not null default 'user' check (kind in ('user', 'system')),
  add column if not exists event       text check (event in ('joined', 'left', 'removed')),
  add column if not exists subject_id  uuid references profiles(id) on delete set null,
  add column if not exists reply_to_id uuid references pta_messages(id) on delete set null,
  add column if not exists edited_at   timestamptz,
  add column if not exists deleted_at  timestamptz,
  add column if not exists deleted_by  uuid references profiles(id) on delete set null;

-- A deleted message has neither text nor audio any more.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'pta_messages'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%btrim%'
  loop
    execute format('alter table pta_messages drop constraint %I', c.conname);
  end loop;
end $$;
alter table pta_messages add constraint pta_messages_has_content check (
  deleted_at is not null
  or nullif(btrim(coalesce(body, '')), '') is not null
  or audio_path is not null
);

create index if not exists idx_pta_messages_deleted_audio
  on pta_messages (deleted_at)
  where deleted_at is not null and audio_path is not null and audio_deleted_at is null;

drop policy if exists "pta_messages_select" on pta_messages;
create policy "pta_messages_select" on pta_messages
  for select to authenticated
  using (
    app_is_pta_group_member(group_id)
    and created_at >= app_pta_member_since(group_id)
  );

-- Members can only post ordinary messages as themselves. System notices,
-- edits and deletions only ever come from the functions below.
drop policy if exists "pta_messages_insert" on pta_messages;
create policy "pta_messages_insert" on pta_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and app_is_pta_group_member(group_id)
    and kind = 'user'
    and event is null
    and edited_at is null
    and deleted_at is null
    and deleted_by is null
  );

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
    raise exception 'Forum not found';
  end if;
  new.school_id := g_school;

  if new.reply_to_id is not null and not exists (
    select 1 from pta_messages r where r.id = new.reply_to_id and r.group_id = new.group_id
  ) then
    raise exception 'Cannot reply to a message from another group';
  end if;

  if new.kind = 'system' then
    new.sender_id := null;
    new.sender_name := '';
    new.sender_role := 'system';
  elsif auth.uid() is not null then
    select * into p from profiles where id = auth.uid();
    new.sender_id := p.id;
    new.sender_name := p.full_name;
    new.sender_role := p.role::text;
  end if;
  return new;
end;
$$;

-- One in-app notification per ACTIVE member (not for system notices), and
-- only if they don't already have an unread one for this forum.
create or replace function pta_messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  preview text;
begin
  if new.kind = 'system' then
    return new;
  end if;

  preview := case
    when new.audio_path is not null and nullif(btrim(coalesce(new.body, '')), '') is null then 'Voice note'
    when length(new.body) > 100 then left(new.body, 100) || '…'
    else new.body
  end;

  insert into notifications (school_id, recipient_id, type, title, body, related_entity_type, related_entity_id)
  select new.school_id, p.id, 'pta_message', 'Parent Model Forum',
         new.sender_name || ': ' || preview, 'pta_group', new.group_id
  from pta_members m
  join profiles p on p.id = m.profile_id
  where m.group_id = new.group_id
    and m.status = 'active'
    and p.school_id = new.school_id
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

-- A short helper the membership functions use to write the "X joined" lines.
create or replace function forum_post_system_message(p_group uuid, p_event text, p_subject uuid, p_text text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into pta_messages (group_id, school_id, kind, event, subject_id, body)
  select p_group, g.school_id, 'system', p_event, p_subject, p_text
  from pta_groups g where g.id = p_group
$$;
revoke all on function forum_post_system_message(uuid, text, uuid, text) from public, anon, authenticated;


-- ============================================================
-- 3. MEMBERSHIP FUNCTIONS
-- ============================================================

create or replace function invite_to_forum(p_group uuid, p_profiles uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_p profiles%rowtype;
  target  profiles%rowtype;
  pid     uuid;
  existing text;
  n integer := 0;
begin
  if not app_is_forum_admin(p_group) then
    raise exception 'Only the school admin can invite people';
  end if;
  select * into admin_p from profiles where id = auth.uid();

  foreach pid in array coalesce(p_profiles, '{}'::uuid[]) loop
    select * into target from profiles where id = pid;
    if not found
       or target.school_id is distinct from admin_p.school_id
       or not target.is_active
       or target.role::text not in ('parent', 'class_teacher', 'shadow_teacher', 'finance_manager') then
      continue;
    end if;

    select m.status into existing from pta_members m where m.group_id = p_group and m.profile_id = pid;
    if existing in ('active', 'invited') then
      continue;
    end if;

    insert into pta_members (group_id, profile_id, status, invited_by, invited_at, joined_at, updated_at)
    values (p_group, pid, 'invited', auth.uid(), now(), null, now())
    on conflict (group_id, profile_id) do update
      set status = 'invited', invited_by = auth.uid(), invited_at = now(), joined_at = null, updated_at = now();

    insert into notifications (school_id, recipient_id, type, title, body, related_entity_type, related_entity_id)
    values (
      target.school_id, pid, 'forum_invite', 'Invitation: Parent Model Forum',
      admin_p.full_name || ' invited you to join the Parent Model Forum.',
      'pta_group', p_group
    );
    n := n + 1;
  end loop;
  return n;
end;
$$;

create or replace function respond_to_forum_invite(p_group uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m pta_members%rowtype;
  me profiles%rowtype;
begin
  select * into m from pta_members where group_id = p_group and profile_id = auth.uid() and status = 'invited';
  if not found then
    raise exception 'There is no pending invitation';
  end if;
  select * into me from profiles where id = auth.uid();

  if p_accept then
    update pta_members set status = 'active', joined_at = now(), updated_at = now()
    where group_id = p_group and profile_id = auth.uid();
    perform forum_post_system_message(p_group, 'joined', auth.uid(), me.full_name || ' joined the group');
  else
    update pta_members set status = 'declined', joined_at = null, updated_at = now()
    where group_id = p_group and profile_id = auth.uid();
  end if;

  update notifications set read_at = now()
  where recipient_id = auth.uid() and type = 'forum_invite'
    and related_entity_id = p_group and read_at is null;

  if m.invited_by is not null then
    insert into notifications (school_id, recipient_id, type, title, body, related_entity_type, related_entity_id)
    values (
      me.school_id, m.invited_by, 'forum_update', 'Parent Model Forum',
      me.full_name || case when p_accept then ' accepted your invitation.' else ' declined your invitation.' end,
      'pta_group', p_group
    );
  end if;
end;
$$;

create or replace function leave_forum(p_group uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me profiles%rowtype;
begin
  select * into me from profiles where id = auth.uid();
  if me.role = 'school_admin' then
    raise exception 'The school admin cannot leave the forum';
  end if;
  update pta_members set status = 'left', updated_at = now()
  where group_id = p_group and profile_id = auth.uid() and status = 'active';
  if not found then
    raise exception 'You are not a member of this forum';
  end if;
  perform forum_post_system_message(p_group, 'left', auth.uid(), me.full_name || ' left the group');
end;
$$;

create or replace function remove_from_forum(p_group uuid, p_profile uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_p profiles%rowtype;
  target  profiles%rowtype;
  m pta_members%rowtype;
begin
  if not app_is_forum_admin(p_group) then
    raise exception 'Only the school admin can remove people';
  end if;
  select * into admin_p from profiles where id = auth.uid();
  select * into target from profiles where id = p_profile;
  if target.role = 'school_admin' then
    raise exception 'The school admin cannot be removed';
  end if;
  select * into m from pta_members where group_id = p_group and profile_id = p_profile;
  if not found or m.status not in ('active', 'invited') then
    raise exception 'That person is not in the forum';
  end if;

  if m.status = 'invited' then
    delete from pta_members where group_id = p_group and profile_id = p_profile;
    update notifications set read_at = now()
    where recipient_id = p_profile and type = 'forum_invite'
      and related_entity_id = p_group and read_at is null;
    return;
  end if;

  update pta_members set status = 'removed', updated_at = now()
  where group_id = p_group and profile_id = p_profile;
  perform forum_post_system_message(
    p_group, 'removed', p_profile, target.full_name || ' was removed by ' || admin_p.full_name
  );
  insert into notifications (school_id, recipient_id, type, title, body, related_entity_type, related_entity_id)
  values (target.school_id, p_profile, 'forum_update', 'Parent Model Forum',
          'You were removed from the Parent Model Forum.', 'pta_group', p_group);
end;
$$;

-- Who is in the forum. Names, roles and photo paths only -- never contact
-- details. Everyone sees the active members; the admin also sees pending
-- invitations.
drop function if exists get_pta_members(uuid);
create or replace function get_pta_members(p_group uuid)
returns table (
  profile_id uuid, full_name text, role staff_role, photo_url text,
  status text, joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  is_admin boolean;
begin
  if not app_is_pta_group_member(p_group) then
    raise exception 'Not a member of this forum';
  end if;
  is_admin := app_is_forum_admin(p_group);

  return query
    select p.id, p.full_name, p.role, p.photo_url, m.status, m.joined_at
    from pta_members m
    join pta_groups g on g.id = m.group_id
    join profiles p on p.id = m.profile_id and p.school_id = g.school_id
    where m.group_id = p_group
      and p.is_active
      and p.role in ('parent', 'class_teacher', 'shadow_teacher', 'school_admin', 'finance_manager')
      and (m.status = 'active' or (is_admin and m.status = 'invited'))
    order by
      case m.status when 'active' then 1 else 2 end,
      case p.role
        when 'school_admin' then 1 when 'finance_manager' then 2
        when 'class_teacher' then 3 when 'shadow_teacher' then 4 else 5 end,
      p.full_name;
end;
$$;

-- The admin's "add people" list: everyone at the school who could be
-- invited and isn't already in or invited. `detail` helps tell people
-- apart (a parent's children, a class teacher's class).
create or replace function get_forum_invitable(p_group uuid)
returns table (
  profile_id uuid, full_name text, role staff_role, photo_url text,
  detail text, previous_status text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not app_is_forum_admin(p_group) then
    raise exception 'Only the school admin can invite people';
  end if;

  return query
    select
      p.id, p.full_name, p.role, p.photo_url,
      case p.role
        when 'parent' then (
          select string_agg(s.full_name, ', ' order by s.full_name)
          from parent_student_links l join students s on s.id = l.student_id
          where l.parent_id = p.id and s.school_id = g.school_id
        )
        when 'class_teacher' then (
          select string_agg(c.name, ', ' order by c.name)
          from classes c where c.class_teacher_id = p.id
        )
        else null
      end,
      m.status
    from pta_groups g
    join profiles p on p.school_id = g.school_id
    left join pta_members m on m.group_id = g.id and m.profile_id = p.id
    where g.id = p_group
      and p.is_active
      and p.role in ('parent', 'class_teacher', 'shadow_teacher', 'finance_manager')
      and coalesce(m.status, 'none') not in ('active', 'invited')
    order by
      case p.role when 'finance_manager' then 1 when 'class_teacher' then 2 when 'shadow_teacher' then 3 else 4 end,
      p.full_name;
end;
$$;

-- The row on the messages list. Returned to anyone eligible (so an invited
-- person can accept right from the list); message details only to members.
drop function if exists get_pta_overview();
create or replace function get_pta_overview()
returns table (
  group_id uuid, name text, member_count bigint,
  last_message_at timestamptz, last_message_preview text, unread_count bigint,
  my_status text, is_admin boolean, invited_by_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  g pta_groups%rowtype;
  me profiles%rowtype;
  mem pta_members%rowtype;
  since timestamptz;
  last_read timestamptz;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null or not me.is_active or me.school_id is null
     or me.role::text not in ('parent', 'class_teacher', 'shadow_teacher', 'school_admin', 'finance_manager')
     or (me.role = 'parent' and app_session_mode() <> 'parent') then
    return;
  end if;

  select pg.* into g from pta_groups pg where pg.school_id = me.school_id;
  if g.id is null then
    return;
  end if;

  select * into mem from pta_members pm where pm.group_id = g.id and pm.profile_id = me.id;
  since := app_pta_member_since(g.id);

  if since is null then
    -- Not a member: only an open invitation is worth showing.
    if mem.status = 'invited' then
      return query
        select g.id, g.name, 0::bigint, null::timestamptz, null::text, 0::bigint,
               'invited'::text, false,
               (select ip.full_name from profiles ip where ip.id = mem.invited_by);
    end if;
    return;
  end if;

  select r.last_read_at into last_read
  from pta_read_state r where r.group_id = g.id and r.profile_id = me.id;

  return query
    select
      g.id,
      g.name,
      (select count(*) from pta_members m2
         join profiles p2 on p2.id = m2.profile_id and p2.school_id = g.school_id
        where m2.group_id = g.id and m2.status = 'active' and p2.is_active
          and p2.role in ('parent', 'class_teacher', 'shadow_teacher', 'school_admin', 'finance_manager')),
      (select max(m.created_at) from pta_messages m where m.group_id = g.id and m.created_at >= since),
      (select case
                when m.deleted_at is not null then 'This message was deleted'
                when m.kind = 'system' then m.body
                when m.audio_path is not null and nullif(btrim(coalesce(m.body, '')), '') is null
                  then m.sender_name || ': Voice note'
                else m.sender_name || ': ' || m.body
              end
         from pta_messages m
        where m.group_id = g.id and m.created_at >= since
        order by m.created_at desc limit 1),
      (select count(*) from pta_messages m
        where m.group_id = g.id
          and m.kind = 'user'
          and m.deleted_at is null
          and m.created_at >= since
          and m.sender_id is distinct from me.id
          and (last_read is null or m.created_at > last_read)),
      'active'::text,
      (me.role = 'school_admin'),
      null::text;
end;
$$;


-- ============================================================
-- 4. DIRECT CHATS: reply / edit / delete columns
-- ============================================================

alter table messages
  add column if not exists reply_to_id uuid references messages(id) on delete set null,
  add column if not exists edited_at   timestamptz,
  add column if not exists deleted_at  timestamptz,
  add column if not exists deleted_by  uuid references profiles(id) on delete set null;

alter table messages drop constraint if exists messages_has_content;
alter table messages add constraint messages_has_content check (
  deleted_at is not null
  or nullif(btrim(coalesce(body, '')), '') is not null
  or audio_path is not null
);

create index if not exists idx_messages_deleted_audio
  on messages (deleted_at)
  where deleted_at is not null and audio_path is not null and audio_deleted_at is null;

drop policy if exists "messages_insert" on messages;
create policy "messages_insert" on messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and edited_at is null
    and deleted_at is null
    and deleted_by is null
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

create or replace function messages_reply_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reply_to_id is not null and not exists (
    select 1 from messages r where r.id = new.reply_to_id and r.conversation_id = new.conversation_id
  ) then
    raise exception 'Cannot reply to a message from another conversation';
  end if;
  return new;
end;
$$;

create trigger trg_messages_reply_guard
  before insert on messages
  for each row execute function messages_reply_guard();


-- ============================================================
-- 5. REACTIONS, CLEAR CHAT, EDIT / DELETE
-- ============================================================

create table chat_reactions (
  kind        text not null check (kind in ('dm', 'pta')),
  message_id  uuid not null,
  profile_id  uuid not null references profiles(id) on delete cascade,
  emoji       text not null check (emoji in ('👍', '❤️', '😂', '😮', '😢', '🙏')),
  created_at  timestamptz not null default now(),
  primary key (kind, message_id, profile_id)
);
create index idx_chat_reactions_message on chat_reactions(kind, message_id);

alter table chat_reactions enable row level security;

-- You can see the reactions on messages you can see (the subselects run
-- under the caller's own RLS). Writes only through react_chat_message().
create policy "chat_reactions_select" on chat_reactions
  for select to authenticated
  using (
    (kind = 'pta' and exists (select 1 from pta_messages m where m.id = chat_reactions.message_id))
    or (kind = 'dm' and exists (select 1 from messages m where m.id = chat_reactions.message_id))
  );

create table chat_clears (
  profile_id  uuid not null references profiles(id) on delete cascade,
  kind        text not null check (kind in ('dm', 'pta')),
  target_id   uuid not null,  -- conversation id or forum (group) id
  cleared_at  timestamptz not null default now(),
  primary key (profile_id, kind, target_id)
);

alter table chat_clears enable row level security;
create policy "chat_clears_own" on chat_clears
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create or replace function react_chat_message(p_kind text, p_id uuid, p_emoji text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  grp uuid;
  conv uuid;
  created timestamptz;
  current_emoji text;
begin
  if p_kind = 'pta' then
    select m.group_id, m.created_at into grp, created
    from pta_messages m where m.id = p_id and m.deleted_at is null and m.kind = 'user';
    if grp is null or not app_is_pta_group_member(grp) or created < app_pta_member_since(grp) then
      raise exception 'Message not found';
    end if;
  elsif p_kind = 'dm' then
    select m.conversation_id into conv from messages m where m.id = p_id and m.deleted_at is null;
    if conv is null or not app_is_dm_participant(conv) then
      raise exception 'Message not found';
    end if;
  else
    raise exception 'Unknown chat type';
  end if;

  select r.emoji into current_emoji
  from chat_reactions r where r.kind = p_kind and r.message_id = p_id and r.profile_id = auth.uid();

  if p_emoji is null or p_emoji = '' or p_emoji = current_emoji then
    delete from chat_reactions where kind = p_kind and message_id = p_id and profile_id = auth.uid();
  else
    insert into chat_reactions (kind, message_id, profile_id, emoji)
    values (p_kind, p_id, auth.uid(), p_emoji)
    on conflict (kind, message_id, profile_id) do update set emoji = excluded.emoji, created_at = now();
  end if;
end;
$$;

create or replace function edit_chat_message(p_kind text, p_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  new_body text := nullif(btrim(coalesce(p_body, '')), '');
  n integer;
begin
  if new_body is null then
    raise exception 'A message cannot be empty';
  end if;

  if p_kind = 'pta' then
    update pta_messages m set body = new_body, edited_at = now()
    where m.id = p_id and m.kind = 'user' and m.deleted_at is null
      and m.sender_id = auth.uid() and m.body is not null
      and app_is_pta_group_member(m.group_id);
  elsif p_kind = 'dm' then
    update messages m set body = new_body, edited_at = now()
    where m.id = p_id and m.deleted_at is null
      and m.sender_id = auth.uid() and m.body is not null
      and app_is_dm_participant(m.conversation_id);
  else
    raise exception 'Unknown chat type';
  end if;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'You can only edit your own text messages';
  end if;
end;
$$;

-- Own messages; plus the school admin may delete any forum message.
create or replace function delete_chat_message(p_kind text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if p_kind = 'pta' then
    update pta_messages m set body = null, deleted_at = now(), deleted_by = auth.uid()
    where m.id = p_id and m.kind = 'user' and m.deleted_at is null
      and app_is_pta_group_member(m.group_id)
      and (m.sender_id = auth.uid() or app_is_forum_admin(m.group_id));
  elsif p_kind = 'dm' then
    update messages m set body = null, deleted_at = now(), deleted_by = auth.uid()
    where m.id = p_id and m.deleted_at is null
      and m.sender_id = auth.uid()
      and app_is_dm_participant(m.conversation_id);
  else
    raise exception 'Unknown chat type';
  end if;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'You cannot delete that message';
  end if;
  delete from chat_reactions where kind = p_kind and message_id = p_id;
end;
$$;


-- ============================================================
-- 6. AVATARS: forum co-members may read each other's parent photos
--    (staff photos are already readable by anyone at the same school).
-- ============================================================

create or replace function app_parent_photo_visible(owner_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select owner_profile_id = auth.uid()
    or app_is_super_admin()
    or (
      app_is_school_staff()
      and exists (
        select 1 from parent_student_links pl
        join students s on s.id = pl.student_id
        where pl.parent_id = owner_profile_id and s.school_id = app_school_id()
      )
    )
    or exists (
      select 1
      from pta_members me
      join pta_members them on them.group_id = me.group_id
      where me.profile_id = auth.uid() and me.status = 'active'
        and them.profile_id = owner_profile_id and them.status = 'active'
        and app_is_pta_group_member(me.group_id)
    )
$$;


-- ============================================================
-- 7. GRANTS + REALTIME
-- ============================================================

grant select on pta_members to authenticated;
grant select on chat_reactions to authenticated;
grant select, insert, update, delete on chat_clears to authenticated;
grant all on pta_members, chat_reactions, chat_clears to service_role;

grant execute on function app_pta_member_since(uuid) to authenticated;
grant execute on function app_is_forum_admin(uuid) to authenticated;
grant execute on function invite_to_forum(uuid, uuid[]) to authenticated;
grant execute on function respond_to_forum_invite(uuid, boolean) to authenticated;
grant execute on function leave_forum(uuid) to authenticated;
grant execute on function remove_from_forum(uuid, uuid) to authenticated;
grant execute on function get_pta_members(uuid) to authenticated;
grant execute on function get_forum_invitable(uuid) to authenticated;
grant execute on function get_pta_overview() to authenticated;
grant execute on function react_chat_message(text, uuid, text) to authenticated;
grant execute on function edit_chat_message(text, uuid, text) to authenticated;
grant execute on function delete_chat_message(text, uuid) to authenticated;

alter publication supabase_realtime add table chat_reactions;
alter publication supabase_realtime add table pta_members;
