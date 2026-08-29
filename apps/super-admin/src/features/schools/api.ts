import { supabase } from "../../lib/supabase";

// supabase.functions.invoke()'s error.message is a generic "Edge Function
// returned a non-2xx status code" for any failure response -- it never
// surfaces the actual { error: "..." } body. This pulls the real reason
// out of error.context (the raw Response), matching the fix already
// applied in the staff app's create/delete-staff-member.
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

export interface SchoolRow {
  id: string;
  name: string;
  contact_email: string | null;
  is_active: boolean;
  financial_model: string;
  created_at: string;
  student_count: number;
  staff_count: number;
}

export async function fetchSchools(): Promise<SchoolRow[]> {
  const { data: schools, error } = await supabase
    .from("schools")
    .select("id, name, contact_email, is_active, financial_model, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!schools || schools.length === 0) return [];

  // Two lightweight count queries across all schools rather than N+1 --
  // grouped client-side since this is a small, infrequent admin read,
  // not worth a Postgres function for.
  const [{ data: students, error: studentsError }, { data: staff, error: staffError }] = await Promise.all([
    supabase.from("students").select("school_id"),
    supabase.from("profiles").select("school_id").not("school_id", "is", null),
  ]);
  if (studentsError) throw new Error(studentsError.message);
  if (staffError) throw new Error(staffError.message);

  const studentCounts = new Map<string, number>();
  for (const s of students ?? []) {
    studentCounts.set(s.school_id, (studentCounts.get(s.school_id) ?? 0) + 1);
  }
  const staffCounts = new Map<string, number>();
  for (const s of staff ?? []) {
    if (s.school_id) staffCounts.set(s.school_id, (staffCounts.get(s.school_id) ?? 0) + 1);
  }

  return schools.map((s) => ({
    ...s,
    student_count: studentCounts.get(s.id) ?? 0,
    staff_count: staffCounts.get(s.id) ?? 0,
  }));
}

export async function fetchSchool(schoolId: string): Promise<SchoolRow | null> {
  const { data, error } = await supabase
    .from("schools")
    .select("id, name, contact_email, is_active, financial_model, created_at")
    .eq("id", schoolId)
    .single();
  if (error) return null;

  const [{ count: studentCount }, { count: staffCount }] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
  ]);

  return { ...data, student_count: studentCount ?? 0, staff_count: staffCount ?? 0 };
}

export interface SchoolAdminRow {
  id: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
}

export async function fetchSchoolAdmins(schoolId: string): Promise<SchoolAdminRow[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, is_active, created_at")
    .eq("school_id", schoolId)
    .eq("role", "school_admin")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateSchoolDetails(
  schoolId: string,
  updates: { name?: string; contact_email?: string | null }
): Promise<void> {
  const { error } = await supabase.from("schools").update(updates).eq("id", schoolId);
  if (error) throw new Error(error.message);
}

export async function setSchoolActive(schoolId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("schools").update({ is_active: isActive }).eq("id", schoolId);
  if (error) throw new Error(error.message);
}

export interface CreateSchoolResult {
  school: { id: string; name: string };
  admin_invite: { id: string; email: string } | null;
  admin_invite_error: string | null;
}

export async function createSchool(
  name: string,
  contactEmail: string,
  adminName: string,
  adminEmail: string
): Promise<CreateSchoolResult> {
  const { data, error } = await supabase.functions.invoke("create-school", {
    body: {
      name,
      contact_email: contactEmail || null,
      admin_name: adminName || undefined,
      admin_email: adminEmail || undefined,
    },
  });
  if (error) throw await parseFunctionError(error, "Failed to create school");
  if (data?.error) throw new Error(data.error);
  return data as CreateSchoolResult;
}

export async function inviteSchoolAdmin(schoolId: string, fullName: string, email: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("create-school-admin", {
    body: { school_id: schoolId, full_name: fullName, email },
  });
  if (error) throw await parseFunctionError(error, "Failed to invite School Admin");
  if (data?.error) throw new Error(data.error);
}

export async function deleteSchool(schoolId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("delete-school", {
    body: { school_id: schoolId },
  });
  if (error) throw await parseFunctionError(error, "Failed to delete school");
  if (data?.error) throw new Error(data.error);
}
