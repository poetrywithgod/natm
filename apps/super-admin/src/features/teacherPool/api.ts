import { supabase } from "../../lib/supabase";

export type PoolStatus = "available" | "assigned" | "inactive";

export interface PoolTeacher {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  qualifications: string | null;
  notes: string | null;
  status: PoolStatus;
  assigned_school_id: string | null;
  assigned_school_name: string | null;
  assigned_at: string | null;
  created_at: string;
}

export interface NewPoolTeacher {
  full_name: string;
  email: string;
  phone?: string;
  qualifications?: string;
  notes?: string;
}

async function parseFunctionError(error: unknown, fallback: string): Promise<Error> {
  const response = (error as { context?: Response } | null)?.context;
  if (response) {
    try {
      const body = await response.json();
      if (body?.error) return new Error(body.error);
    } catch {
      // not JSON -- fall through
    }
  }
  return new Error(error instanceof Error ? error.message : fallback);
}

export async function fetchPoolTeachers(): Promise<PoolTeacher[]> {
  const { data, error } = await supabase
    .from("teacher_pool")
    .select(
      "id, full_name, email, phone, qualifications, notes, status, assigned_school_id, assigned_at, created_at, schools:assigned_school_id(name)"
    )
    .order("full_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const school = r.schools as { name: string } | { name: string }[] | null;
    const schoolName = Array.isArray(school) ? school[0]?.name : school?.name;
    return {
      id: r.id,
      full_name: r.full_name,
      email: r.email,
      phone: r.phone,
      qualifications: r.qualifications,
      notes: r.notes,
      status: r.status as PoolStatus,
      assigned_school_id: r.assigned_school_id,
      assigned_school_name: schoolName ?? null,
      assigned_at: r.assigned_at,
      created_at: r.created_at,
    };
  });
}

export async function addPoolTeacher(input: NewPoolTeacher): Promise<void> {
  const { error } = await supabase.from("teacher_pool").insert({
    full_name: input.full_name,
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() || null,
    qualifications: input.qualifications?.trim() || null,
    notes: input.notes?.trim() || null,
  });
  if (error) {
    if (error.code === "23505") throw new Error("A pool teacher with this email already exists.");
    throw new Error(error.message);
  }
}

// Only an available teacher can be set inactive and back; an assigned one
// must be unassigned first so their access to the family is ended cleanly.
export async function setPoolTeacherInactive(id: string, inactive: boolean): Promise<void> {
  const { error } = await supabase
    .from("teacher_pool")
    .update({ status: inactive ? "inactive" : "available" })
    .eq("id", id)
    .neq("status", "assigned");
  if (error) throw new Error(error.message);
}

export async function deletePoolTeacher(id: string): Promise<void> {
  const { error } = await supabase.from("teacher_pool").delete().eq("id", id).is("profile_id", null);
  if (error) throw new Error(error.message);
}

export async function assignPoolTeacher(poolId: string, schoolId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("assign-pool-teacher", {
    body: { action: "assign", pool_id: poolId, school_id: schoolId },
  });
  if (error) throw await parseFunctionError(error, "Failed to assign teacher");
  if (data?.error) throw new Error(data.error);
}

export async function unassignPoolTeacher(poolId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("assign-pool-teacher", {
    body: { action: "unassign", pool_id: poolId },
  });
  if (error) throw await parseFunctionError(error, "Failed to unassign teacher");
  if (data?.error) throw new Error(data.error);
}
