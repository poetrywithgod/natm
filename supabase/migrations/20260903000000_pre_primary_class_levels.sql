-- ============================================================
-- The class_level enum only covered Primary 1 upward, so
-- schools with a pre-primary section (Creche through KG) had
-- no way to record those classes' level at all -- Classes,
-- Curriculum, Intake, and Promotion all silently skipped them.
-- Adding the 6 standard Nigerian pre-primary levels ahead of
-- Primary 1, in the order a child actually progresses through
-- them: Creche, Pre-Nursery, Nursery 1, Nursery 2, KG 1, KG 2.
--
-- ALTER TYPE ... ADD VALUE cannot run inside the same
-- transaction as anything that USES the new value, so this
-- migration only touches the enum itself -- nothing else.
-- Each statement inserts immediately before 'primary_1', which
-- (run in this order) produces exactly the sequence above: each
-- new value lands right before primary_1, i.e. after every
-- value already inserted there before it.
-- ============================================================

alter type class_level add value if not exists 'creche' before 'primary_1';
alter type class_level add value if not exists 'pre_nursery' before 'primary_1';
alter type class_level add value if not exists 'nursery_1' before 'primary_1';
alter type class_level add value if not exists 'nursery_2' before 'primary_1';
alter type class_level add value if not exists 'kg_1' before 'primary_1';
alter type class_level add value if not exists 'kg_2' before 'primary_1';
