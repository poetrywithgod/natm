import { supabase } from "../../lib/supabase";

const ALL_STAFF_ROLES = ["school_admin", "class_teacher", "shadow_teacher", "finance_manager"] as const;
export type StaffRole = (typeof ALL_STAFF_ROLES)[number];
export const STAFF_ROLES: readonly StaffRole[] = ALL_STAFF_ROLES;

export interface StaffMember {
  id: string;
  full_name: string;
  role: StaffRole;
  is_active: boolean;
  deactivated_at: string | null;
  created_at: string;
}

export interface StaffRow extends StaffMember {
  school_id: string;
  school_name: string;
}

// supabase.functions.invoke()'s error.message is a generic non-2xx string --
// error.context is the raw Response, which has the real { error: "..." }
// body. Same helper as the staff app and this app's schools/api.ts.
async function parseFunctionError(error: unknown, fallback: string): Promise<Error> {
  const response = (error as { context?: Response } | null)?.context;
  if (response) {
    try {
      const body = await response.json();
      if (body?.error) return new Error(body.error);
    } catch {
      // response wasn't JSON -- fall through to the generic message
    }
  }
  return new Error(error instanceof Error ? error.message : fallback);
}

// Fetches staff across every school. Two lightweight queries grouped
// client-side rather than a join -- same pattern as fetchSchools in
// features/schools/api.ts -- this is a small, infrequent admin read.
export async function fetchAllStaff(): Promise<StaffRow[]> {
  const [{ data: profiles, error: profilesError }, { data: schools, error: schoolsError }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, school_id, is_active, deactivated_at, created_at")
      .in("role", [...ALL_STAFF_ROLES])
      .not("school_id", "is", null)
      .order("created_at", { ascending: false }),
    supabase.from("schools").select("id, name"),
  ]);
  if (profilesError) throw new Error(profilesError.message);
  if (schoolsError) throw new Error(schoolsError.message);

  const schoolNames = new Map((schools ?? []).map((s) => [s.id as string, s.name as string]));
  return (profiles ?? []).map((p) => ({
    ...(p as StaffMember & { school_id: string }),
    school_name: schoolNames.get(p.school_id as string) ?? "Unknown school",
  }));
}

// Same shape, scoped to one school -- used by SchoolDetail, which already
// has the school's own name so doesn't need it repeated per row.
export async function fetchStaffForSchool(schoolId: string): Promise<StaffMember[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active, deactivated_at, created_at")
    .eq("school_id", schoolId)
    .in("role", [...ALL_STAFF_ROLES])
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as StaffMember[];
}

// Invites a staff member of any role to a given school. Routed through the
// create-school-admin Edge Function, which -- despite its name (kept as-is
// to avoid a redeploy/rename) -- now accepts an optional role and defaults
// to school_admin when omitted, matching its original behavior.
export async function inviteStaff(schoolId: string, fullName: string, email: string, role: StaffRole): Promise<void> {
  const { data, error } = await supabase.functions.invoke("create-school-admin", {
    body: { school_id: schoolId, full_name: fullName, email, role },
  });
  if (error) throw await parseFunctionError(error, "Failed to invite staff member");
  if (data?.error) throw new Error(data.error);
}

// Thrown when deactivation is blocked because the staff member still has
// active duties (class ownership or shadow-teacher assignments) to
// reassign first -- same shape as the staff app's version.
export class DeactivationBlockedError extends Error {
  reasons: string[];
  constructor(reasons: string[]) {
    super(reasons.join(" "));
    this.reasons = reasons;
  }
}

export async function deactivateStaff(staffId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("set-staff-active-status", {
    body: { staff_id: staffId, action: "deactivate" },
  });
  if (error) {
    const response = (error as { context?: Response }).context;
    if (response) {
      try {
        const body = await response.json();
        if (body?.reasons?.length) throw new DeactivationBlockedError(body.reasons);
        throw new Error(body?.error ?? error.message);
      } catch (parseErr) {
        if (parseErr instanceof DeactivationBlockedError) throw parseErr;
        throw new Error(error.message);
      }
    }
    throw new Error(error.message);
  }
  if (data?.error) throw new Error(data.error);
}

export async function reactivateStaff(staffId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("set-staff-active-status", {
    body: { staff_id: staffId, action: "reactivate" },
  });
  if (error) throw await parseFunctionError(error, "Failed to reactivate staff member");
  if (data?.error) throw new Error(data.error);
}

export async function deleteStaffMember(staffId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("delete-staff-member", {
    body: { staff_id: staffId },
  });
  if (error) throw await parseFunctionError(error, "Failed to delete staff member");
  if (data?.error) throw new Error(data.error);
}
