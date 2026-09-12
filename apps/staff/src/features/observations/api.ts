import { supabase } from "../../lib/supabase";
import { logAuditEvent } from "../audit/api";
import type { SectionsData } from "@natm/shared-types";

// Same pattern used by the School Admin dashboard summary: find the
// current session for the school, then the current term within it.
export async function fetchCurrentTermNumber(schoolId: string): Promise<number | null> {
  const { data: session, error: sessionError } = await supabase
    .from("academic_sessions")
    .select("id")
    .eq("school_id", schoolId)
    .eq("is_current", true)
    .maybeSingle();
  if (sessionError || !session) return null;

  const { data: term, error: termError } = await supabase
    .from("terms")
    .select("term_number")
    .eq("session_id", session.id)
    .eq("is_current", true)
    .maybeSingle();
  if (termError) return null;
  return term?.term_number ?? null;
}

// A student's full observation history for one term -- the basis for the
// Promotion review's Term Progress card, so admins see the daily-log
// score and weak subjects (for carryover decisions) alongside attendance
// and fees, without pulling in irrelevant terms.
export async function fetchObservationsForTerm(
  studentId: string,
  termNumber: number
): Promise<DailyTeacherObservation[]> {
  const { data, error } = await supabase
    .from("daily_teacher_observations")
    .select("*")
    .eq("student_id", studentId)
    .eq("term_number", termNumber);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DailyTeacherObservation[];
}
export async function fetchShadowTeacherNameForStudent(studentId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("shadow_teacher_assignments")
    .select("shadow_teacher:profiles(full_name)")
    .eq("student_id", studentId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) return null;
  return (data as any)?.shadow_teacher?.full_name ?? null;
}

// Raw rows for the roster "who needs attention" widget on the Class
// Teacher Dashboard -- 14 days covers this-week-vs-last-week deltas.
export async function fetchClassObservationsSince(
  classId: string,
  sinceDateISO: string
): Promise<{ student_id: string; date: string; sections: SectionsData }[]> {
  const { data, error } = await supabase
    .from("daily_teacher_observations")
    .select("student_id, date, sections")
    .eq("class_id", classId)
    .gte("date", sinceDateISO);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as { student_id: string; date: string; sections: SectionsData }[];
}

export interface DailyTeacherObservation {
  id: string;
  school_id: string;
  class_id: string;
  student_id: string;
  teacher_id: string;
  date: string;
  term_number: number | null;
  week: number | null;
  day_label: string | null;
  sections: SectionsData;
  status: "draft" | "submitted";
  teacher_signature: string | null;
  parent_signature: string | null;
  signed_date: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchObservation(
  studentId: string,
  date: string
): Promise<DailyTeacherObservation | null> {
  const { data, error } = await supabase
    .from("daily_teacher_observations")
    .select("*")
    .eq("student_id", studentId)
    .eq("date", date)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as DailyTeacherObservation | null;
}

export async function fetchObservationHistory(
  studentId: string,
  limit = 15
): Promise<DailyTeacherObservation[]> {
  const { data, error } = await supabase
    .from("daily_teacher_observations")
    .select("*")
    .eq("student_id", studentId)
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data as unknown as DailyTeacherObservation[];
}

export async function saveObservation(params: {
  id?: string;
  schoolId: string;
  classId: string;
  studentId: string;
  teacherId: string;
  date: string;
  termNumber: number | null;
  week: number | null;
  dayLabel: string | null;
  sections: SectionsData;
  status: "draft" | "submitted";
  teacherSignature: string | null;
  parentSignature: string | null;
  signedDate: string | null;
}): Promise<DailyTeacherObservation> {
  const payload = {
    school_id: params.schoolId,
    class_id: params.classId,
    student_id: params.studentId,
    teacher_id: params.teacherId,
    date: params.date,
    term_number: params.termNumber,
    week: params.week,
    day_label: params.dayLabel,
    sections: params.sections,
    status: params.status,
    teacher_signature: params.teacherSignature,
    parent_signature: params.parentSignature,
    signed_date: params.signedDate,
    created_by: params.teacherId,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("daily_teacher_observations")
    .upsert((params.id ? { id: params.id, ...payload } : payload) as any, { onConflict: "student_id,date" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  logAuditEvent({
    school_id: params.schoolId,
    actor_id: params.teacherId,
    action: params.status === "submitted" ? "daily_observation.submitted" : "daily_observation.saved",
    entity_type: "student",
    entity_id: params.studentId,
    details: { date: params.date, status: params.status },
  });

  return data as unknown as DailyTeacherObservation;
}
