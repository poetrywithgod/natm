import { supabase } from "../../lib/supabase";

export interface StaffMember {
  id: string;
  full_name: string;
  role: "class_teacher" | "shadow_teacher" | "finance_manager";
  created_at: string;
  is_active: boolean;
  deactivated_at: string | null;
}

export async function fetchStaff(schoolId: string, includeInactive: boolean): Promise<StaffMember[]> {
  let query = supabase
    .from("profiles")
    .select("id, full_name, role, created_at, is_active, deactivated_at")
    .eq("school_id", schoolId)
    .in("role", ["class_teacher", "shadow_teacher", "finance_manager"]);

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query.order("full_name", { ascending: true });
  if (error) throw new Error(error.message);
  return data as StaffMember[];
}

// Calls the create-staff-member Edge Function, which uses the service role
// to invite a real auth.users account by email (they set their own password
// via the invite link) and creates the linked profiles row.
export async function createStaffMember(
  fullName: string,
  email: string,
  role: "class_teacher" | "shadow_teacher" | "finance_manager"
): Promise<void> {
  const { data, error } = await supabase.functions.invoke("create-staff-member", {
    body: { full_name: fullName, email, role },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
}

// Thrown when deactivation is blocked because the staff member still has
// active duties (class ownership or shadow-teacher assignments) to reassign.
export class DeactivationBlockedError extends Error {
  reasons: string[];
  constructor(reasons: string[]) {
    super(reasons.join(" "));
    this.reasons = reasons;
  }
}

export async function deactivateStaffMember(staffId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("set-staff-active-status", {
    body: { staff_id: staffId, action: "deactivate" },
  });

  if (error) {
    // Edge Function returned a non-2xx — error.context is the raw Response
    // object, not the parsed body. Parse it to get the actual reasons/message.
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

  if (data?.error) {
    if (data.reasons?.length) throw new DeactivationBlockedError(data.reasons);
    throw new Error(data.error);
  }
}

export async function reactivateStaffMember(staffId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("set-staff-active-status", {
    body: { staff_id: staffId, action: "reactivate" },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
}
