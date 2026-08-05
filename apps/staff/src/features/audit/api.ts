import { supabase } from "../../lib/supabase";

export interface AuditLogEntry {
  id: string;
  school_id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  actor?: { full_name: string } | null;
}

// Fire-and-forget-ish, but still awaited by callers so failures can be seen
// in dev — a failed audit write should never block the actual user action,
// so callers wrap this in its own try/catch rather than let it throw upward.
export async function logAuditEvent(input: {
  school_id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    school_id: input.school_id,
    actor_id: input.actor_id,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id ?? null,
    details: input.details ?? null,
  });
  if (error) {
    // Deliberately not thrown — see comment above.
    console.error("Failed to write audit log:", error.message);
  }
}

export async function fetchAuditLogs(schoolId: string, limit = 200): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*, actor:profiles(full_name)")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as unknown as AuditLogEntry[]) ?? [];
}
