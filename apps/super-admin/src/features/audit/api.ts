import { supabase } from "../../lib/supabase";

export interface AuditLogRow {
  id: string;
  school_id: string;
  school_name: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

// Global, cross-school feed -- every other consumer of audit_logs in the
// app (apps/staff's AdminAuditLog) is scoped to one school_id; this is
// the one place that intentionally reads across all of them, which is
// exactly what makes this a super_admin-only view rather than something
// School Admins could also see.
export async function fetchGlobalAuditLog(limit = 100, schoolId?: string): Promise<AuditLogRow[]> {
  let query = supabase
    .from("audit_logs")
    .select("id, school_id, actor_id, action, entity_type, entity_id, details, created_at, schools(name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (schoolId) query = query.eq("school_id", schoolId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return [];

  const actorIds = [...new Set(data.map((r) => r.actor_id).filter((id): id is string => !!id))];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] };
  const actorNames = new Map((actors ?? []).map((a) => [a.id, a.full_name]));

  return data.map((r) => {
    const school = r.schools as unknown as { name: string } | null;
    return {
      id: r.id,
      school_id: r.school_id,
      school_name: school?.name ?? "Unknown school",
      actor_id: r.actor_id,
      actor_name: r.actor_id ? actorNames.get(r.actor_id) ?? "Unknown" : null,
      action: r.action,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      details: r.details as Record<string, unknown> | null,
      created_at: r.created_at,
    };
  });
}
