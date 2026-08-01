-- ============================================================
-- Auto-generated unique_student_id
-- Per-school atomic counter (avoids collisions if two admins
-- create students at the same moment) + a BEFORE INSERT trigger
-- so the app layer never has to think about generating this.
-- Format: STU-00001 (5-digit, sequential per school)
-- ============================================================

create table school_student_id_counters (
  school_id uuid primary key references schools(id) on delete cascade,
  next_number integer not null default 1
);

alter table school_student_id_counters enable row level security;
create policy "temp_allow_all_authenticated" on school_student_id_counters
  for all to authenticated using (true) with check (true);

create or replace function set_student_unique_id()
returns trigger as $$
declare
  v_number integer;
begin
  if new.unique_student_id is not null and new.unique_student_id <> '' then
    return new;
  end if;

  insert into school_student_id_counters (school_id)
  values (new.school_id)
  on conflict (school_id) do nothing;

  update school_student_id_counters
  set next_number = next_number + 1
  where school_id = new.school_id
  returning next_number - 1 into v_number;

  new.unique_student_id := 'STU-' || lpad(v_number::text, 5, '0');
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_set_student_unique_id
  before insert on students
  for each row
  execute function set_student_unique_id();

-- unique_student_id no longer needs a value supplied by the app —
-- allow inserts to omit it (the trigger fills it in before the
-- not-null/unique constraints are checked).
alter table students alter column unique_student_id drop not null;
