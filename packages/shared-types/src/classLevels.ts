// Mirrors the `class_level` Postgres enum exactly -- keep in sync with
// supabase/migrations (currently 20260731240000_global_curriculum.sql,
// 20260903000000_pre_primary_class_levels.sql, and
// 20260913063000_nursery_3_level.sql). Defined here rather than derived
// from @natm/supabase's generated Database type so this package (used by
// every app) doesn't need a dependency on the Supabase client package.
export type ClassLevel =
  | "creche"
  | "pre_nursery"
  | "nursery_1"
  | "nursery_2"
  | "nursery_3"
  | "kg_1"
  | "kg_2"
  | "primary_1"
  | "primary_2"
  | "primary_3"
  | "primary_4"
  | "primary_5"
  | "primary_6"
  | "jss_1"
  | "jss_2"
  | "jss_3"
  | "ss_1"
  | "ss_2"
  | "ss_3";

export interface ClassLevelOption {
  value: ClassLevel;
  label: string;
}

// The full platform superset, in progression order. Individual schools
// enable whichever subset actually applies to them (school_enabled_levels)
// -- e.g. a school using the Nursery 1/2/3 naming enables those and
// leaves kg_1/kg_2 off, a school using KG does the opposite.
export const ALL_CLASS_LEVELS: ClassLevelOption[] = [
  { value: "creche", label: "Creche" },
  { value: "pre_nursery", label: "Pre-Nursery" },
  { value: "nursery_1", label: "Nursery 1" },
  { value: "nursery_2", label: "Nursery 2" },
  { value: "nursery_3", label: "Nursery 3" },
  { value: "kg_1", label: "KG 1" },
  { value: "kg_2", label: "KG 2" },
  { value: "primary_1", label: "Primary 1" },
  { value: "primary_2", label: "Primary 2" },
  { value: "primary_3", label: "Primary 3" },
  { value: "primary_4", label: "Primary 4" },
  { value: "primary_5", label: "Primary 5" },
  { value: "primary_6", label: "Primary 6" },
  { value: "jss_1", label: "JSS 1" },
  { value: "jss_2", label: "JSS 2" },
  { value: "jss_3", label: "JSS 3" },
  { value: "ss_1", label: "SS 1" },
  { value: "ss_2", label: "SS 2" },
  { value: "ss_3", label: "SS 3" },
];

export const CLASS_LEVEL_LABELS: Record<ClassLevel, string> = Object.fromEntries(
  ALL_CLASS_LEVELS.map((l) => [l.value, l.label])
) as Record<ClassLevel, string>;

// Every level a school could mean by "our pre-primary section" --
// covers both the Nursery-3 and the KG naming convention, since a
// school might use either (or occasionally both). Used to seed and
// scope the Early Years subject list (subject_levels).
export const EARLY_YEARS_LEVELS: ClassLevel[] = [
  "creche",
  "pre_nursery",
  "nursery_1",
  "nursery_2",
  "nursery_3",
  "kg_1",
  "kg_2",
];

export function groupClassLevels(levels: ClassLevelOption[]): { label: string; options: ClassLevelOption[] }[] {
  const isEarly = (v: ClassLevel) => (EARLY_YEARS_LEVELS as string[]).includes(v);
  const isPrimary = (v: ClassLevel) => v.startsWith("primary_");
  const isSecondary = (v: ClassLevel) => v.startsWith("jss_") || v.startsWith("ss_");
  return [
    { label: "Early Years", options: levels.filter((l) => isEarly(l.value)) },
    { label: "Primary", options: levels.filter((l) => isPrimary(l.value)) },
    { label: "Secondary", options: levels.filter((l) => isSecondary(l.value)) },
  ].filter((g) => g.options.length > 0);
}
