-- ============================================================
-- Two related gaps this migration closes:
--
-- 1. Every school currently sees the exact same 19 class levels
--    (Creche through SS 3) when creating a class, whether or not
--    they actually run a Creche section, use KG at all, or go up
--    to SS 3. There has never been a concept of "which levels does
--    this school use" -- school_enabled_levels adds it. Existing
--    schools are backfilled from the levels their classes already
--    use, so nobody's current setup changes; they can add or
--    remove levels afterwards from School Profile.
--
-- 2. Subjects (Mathematics, English Language, etc.) have never
--    been restricted to a level -- the Super Admin Curriculum page
--    and the School Admin "add subject to class" box both offer
--    every global subject to every level, which is how Primary/
--    Secondary subjects ended up attached to Creche-KG2 classes.
--    subject_levels adds the missing restriction, seeded with the
--    8 Early Years subjects mapped to every pre-primary level
--    (Creche through KG 2, covering both the Nursery-3 and KG
--    naming conventions), and the cleanup below removes whatever
--    non-Early-Years subjects/curriculum docs had been wrongly
--    attached to pre-primary classes and levels up to now.
-- ============================================================

create table school_enabled_levels (
  school_id uuid not null references schools(id) on delete cascade,
  level class_level not null,
  primary key (school_id, level)
);

-- Backfill: give every existing school a starting config that
-- matches exactly what they already use, so nothing breaks. A
-- school with zero rows here (new schools, going forward) is
-- treated as "all levels enabled" by the app until they configure
-- it -- see fetchEnabledLevels in apps/staff.
insert into school_enabled_levels (school_id, level)
select distinct school_id, level from classes where level is not null
on conflict do nothing;

create table subject_levels (
  subject_id uuid not null references subjects(id) on delete cascade,
  level class_level not null,
  primary key (subject_id, level)
);

alter table school_enabled_levels enable row level security;
alter table subject_levels enable row level security;

create policy "temp_allow_all_authenticated" on school_enabled_levels
  for all to authenticated using (true) with check (true);
create policy "temp_allow_all_authenticated" on subject_levels
  for all to authenticated using (true) with check (true);

-- Seed the 8 Early Years subjects (global, same as every other
-- subject) and map each to every pre-primary level.
do $$
declare
  subject_name text;
  subject_id uuid;
  pre_primary_level class_level;
begin
  foreach subject_name in array array[
    'Health & Self-Care Development',
    'Early Literacy Development',
    'Early Numeracy Development',
    'Physical & Motor Development',
    'Social & Emotional Intelligence Development',
    'Environmental Awareness & Discovery',
    'Creativity & Innovation Development',
    'Communication & Expression Development'
  ]
  loop
    insert into subjects (name) values (subject_name)
      on conflict (name) do nothing;
    select id into subject_id from subjects where name = subject_name;

    foreach pre_primary_level in array array[
      'creche', 'pre_nursery', 'nursery_1', 'nursery_2', 'nursery_3', 'kg_1', 'kg_2'
    ]::class_level[]
    loop
      insert into subject_levels (subject_id, level) values (subject_id, pre_primary_level)
        on conflict do nothing;
    end loop;
  end loop;
end $$;

-- Cleanup: remove non-Early-Years subjects that had been attached
-- to pre-primary classes (class_subjects) or pre-primary curriculum
-- documents, across every school -- the actual "sweep" the Early
-- Years subject list was supposed to replace.
delete from class_subjects cs
using classes c
where cs.class_id = c.id
  and c.level in ('creche', 'pre_nursery', 'nursery_1', 'nursery_2', 'nursery_3', 'kg_1', 'kg_2')
  and cs.subject_id not in (select subject_id from subject_levels where level = c.level);

delete from curriculum_documents cd
where cd.level in ('creche', 'pre_nursery', 'nursery_1', 'nursery_2', 'nursery_3', 'kg_1', 'kg_2')
  and cd.subject_id not in (select subject_id from subject_levels where level = cd.level);
