-- ============================================================
-- Class Work
-- A ready quiz assigned by the Class Teacher, either to the whole
-- class or to specific students, with a due date. class_work_assignees
-- being empty means "whole class"; populated rows scope it narrower.
--
-- notifications is a general-purpose table (not just for class work) --
-- rows are written here immediately on assignment; the push-delivery
-- Edge Function (a later build step) reads and sends them, so this
-- doesn't need to be rebuilt once push infra exists.
-- ============================================================

create table class_work (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  quiz_id uuid not null references quizzes(id) on delete cascade,
  due_date date,
  assigned_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table class_work_assignees (
  id uuid primary key default gen_random_uuid(),
  class_work_id uuid not null references class_work(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  unique (class_work_id, student_id)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  recipient_id uuid not null references profiles(id) on delete cascade,
  type text not null,               -- e.g. 'work_assigned'
  title text not null,
  body text,
  related_entity_type text,
  related_entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_class_work_class_id on class_work(class_id);
create index idx_class_work_assignees_class_work_id on class_work_assignees(class_work_id);
create index idx_class_work_assignees_student_id on class_work_assignees(student_id);
create index idx_notifications_recipient_id on notifications(recipient_id);

alter table class_work enable row level security;
alter table class_work_assignees enable row level security;
alter table notifications enable row level security;

create policy "temp_allow_all_authenticated" on class_work for all to authenticated using (true) with check (true);
create policy "temp_allow_all_authenticated" on class_work_assignees for all to authenticated using (true) with check (true);
create policy "temp_allow_all_authenticated" on notifications for all to authenticated using (true) with check (true);
