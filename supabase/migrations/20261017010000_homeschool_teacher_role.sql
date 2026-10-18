-- ============================================================
-- Homeschool tenants, step 2a (1/2): the homeschool_teacher role value
-- ============================================================
-- Kept in its own migration: a freshly added enum value can't be used in
-- the same transaction that adds it, and the next migration uses it.
--
-- homeschool_teacher is the one combined role for a homeschool tenant's
-- teacher: School Admin + Class Teacher + Shadow Teacher capabilities in
-- a single login, because one person plays all three parts for a family.
-- ============================================================

alter type staff_role add value if not exists 'homeschool_teacher';
