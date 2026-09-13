import { supabase } from "../../lib/supabase";
import { ALL_CLASS_LEVELS, type ClassLevel } from "@natm/shared-types";
import { logAuditEvent } from "../audit/api";

// A school with zero rows in school_enabled_levels hasn't configured
// this yet (new school, or one that existed before this feature) --
// treated as "every level enabled" so nothing breaks for them until
// they actually narrow it down in School Profile.
export async function fetchEnabledLevels(schoolId: string): Promise<ClassLevel[]> {
  const { data, error } = await supabase.from("school_enabled_levels").select("level").eq("school_id", schoolId);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return ALL_CLASS_LEVELS.map((l) => l.value);
  return data.map((r) => r.level as ClassLevel);
}

// Distinguishes "not configured yet" (null) from "configured, but
// currently empty" ([]) -- the settings UI needs to know which case
// it's in, whereas fetchEnabledLevels's fallback is only right for
// consumers picking dropdown options.
export async function fetchConfiguredLevels(schoolId: string): Promise<ClassLevel[] | null> {
  const { data, error } = await supabase.from("school_enabled_levels").select("level").eq("school_id", schoolId);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return null;
  return data.map((r) => r.level as ClassLevel);
}

export async function setLevelEnabled(
  schoolId: string,
  level: ClassLevel,
  enabled: boolean,
  actorId: string
): Promise<void> {
  if (enabled) {
    const { error } = await supabase.from("school_enabled_levels").insert({ school_id: schoolId, level });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("school_enabled_levels")
      .delete()
      .eq("school_id", schoolId)
      .eq("level", level);
    if (error) throw new Error(error.message);
  }
  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: enabled ? "school.level_enabled" : "school.level_disabled",
    entity_type: "school",
    entity_id: schoolId,
    details: { level },
  });
}
