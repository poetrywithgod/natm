import { supabase } from "../../lib/supabase";

export type RequestStatus = "open" | "matched" | "cancelled";

export interface TeacherRequest {
  id: string;
  status: RequestStatus;
  children_info: string;
  preferred_start_date: string | null;
  schedule: string | null;
  location: string | null;
  special_needs: string | null;
  notes: string | null;
  created_at: string;
}

export interface NewTeacherRequest {
  children_info: string;
  preferred_start_date?: string;
  schedule?: string;
  location?: string;
  special_needs?: string;
  notes?: string;
}

// The family's most recent requests, newest first.
export async function fetchMyRequests(): Promise<TeacherRequest[]> {
  const { data, error } = await supabase
    .from("teacher_requests")
    .select("id, status, children_info, preferred_start_date, schedule, location, special_needs, notes, created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ ...r, status: r.status as RequestStatus }));
}

export async function createRequest(schoolId: string, requestedBy: string, input: NewTeacherRequest): Promise<void> {
  const clean = (v?: string) => v?.trim() || null;
  const { error } = await supabase.from("teacher_requests").insert({
    school_id: schoolId,
    requested_by: requestedBy,
    children_info: input.children_info.trim(),
    preferred_start_date: clean(input.preferred_start_date),
    schedule: clean(input.schedule),
    location: clean(input.location),
    special_needs: clean(input.special_needs),
    notes: clean(input.notes),
  });
  if (error) {
    // The one-open-request-per-family index.
    if (error.code === "23505") throw new Error("You already have an open request. Withdraw it first to send a new one.");
    throw new Error(error.message);
  }
}

export async function cancelRequest(id: string): Promise<void> {
  const { error } = await supabase
    .from("teacher_requests")
    .update({ status: "cancelled", resolved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "open");
  if (error) throw new Error(error.message);
}
