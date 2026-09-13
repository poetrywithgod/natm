-- ============================================================
-- The pre-primary sequence added in 20260903000000 assumed every
-- school uses the Creche/Nursery/KG/Primary convention (KG 1, KG 2
-- immediately before Primary 1). Several schools -- including the
-- one that flagged this -- use Nursery 1/2/3 as their own name for
-- that same final pre-primary stage instead of KG, with no KG
-- classes at all. Adding nursery_3 as its own level rather than
-- reusing kg_1/kg_2: a school can now enable Nursery 1/2/3 and
-- skip KG entirely, or enable KG and skip Nursery 3, or (rare, but
-- not prevented) use both if that's genuinely how they're
-- structured. Which of these a given school actually uses is
-- decided in the next migration (school_enabled_levels).
--
-- ALTER TYPE ... ADD VALUE cannot run inside the same transaction
-- as anything that USES the new value -- this migration only
-- touches the enum itself, same constraint as 20260903000000.
-- ============================================================

alter type class_level add value if not exists 'nursery_3' before 'kg_1';
