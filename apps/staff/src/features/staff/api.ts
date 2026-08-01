import { supabase } from "../../lib/supabase";

export interface StaffMember {
  id: string;
  full_name: string;
  role: "class_teacher" | "shadow_teacher" | "finance_manager";
  created_at: string;
}

export async function fetchStaff(schoolId: string): Promise<StaffMember[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at")
    .eq("school_id", schoolId)
    .in("role", ["class_teacher", "shadow_teacher", "finance_manager"])
    .order("full_name", { ascending: true });
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
