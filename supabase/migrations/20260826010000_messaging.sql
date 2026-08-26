-- ============================================================
-- Parent <-> Shadow Teacher messaging.
--
-- One conversation per (student, parent) pair -- the shadow teacher on
-- a conversation is whoever is currently assigned to that student
-- (shadow_teacher_assignments.is_active), so if a student is
-- reassigned to a new shadow teacher the existing thread's
-- shadow_teacher_id is updated rather than starting a new thread,
-- preserving history for the parent. Per-role last-read timestamps
-- drive unread counts without a separate read-receipts table.
--
-- Student messaging routes through the parent only -- no
-- student-facing tables here by design (see NATM messaging decision).
-- ============================================================

create table conversations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  parent_id uuid not null references profiles(id) on delete cascade,
  shadow_teacher_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  parent_last_read_at timestamptz,
  shadow_teacher_last_read_at timestamptz
);

create unique index one_conversation_per_student_parent on conversations(student_id, parent_id);
create index idx_conversations_parent_id on conversations(parent_id);
create index idx_conversations_shadow_teacher_id on conversations(shadow_teacher_id);
create index idx_conversations_student_id on conversations(student_id);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  sender_role text not null check (sender_role in ('parent', 'shadow_teacher')),
  body text not null,
  created_at timestamptz not null default now()
);

create index idx_messages_conversation_id on messages(conversation_id);
create index idx_messages_created_at on messages(created_at);

alter table conversations enable row level security;
alter table messages enable row level security;
create policy "temp_allow_all_authenticated" on conversations for all to authenticated using (true) with check (true);
create policy "temp_allow_all_authenticated" on messages for all to authenticated using (true) with check (true);

-- Realtime: parent/teacher chat screens subscribe to new rows on this
-- table, filtered by conversation_id.
alter publication supabase_realtime add table messages;
