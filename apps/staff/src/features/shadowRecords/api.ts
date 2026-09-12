import { supabase } from "../../lib/supabase";
import { logAuditEvent } from "../audit/api";
import type { SectionsData } from "@natm/shared-types";

export interface ShadowTeacherDailyRecord {
  id: string;
  school_id: string;
  class_id: string;
  student_id: string;
  shadow_teacher_id: string;
  therapist_involved: string | null;
  date: string;
  term_number: number | null;
  week: number | null;
  day_label: string | null;
  sections: SectionsData;
  status: "draft" | "submitted";
  shadow_signature: string | null;
  class_teacher_signature: string | null;
  signed_date: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchShadowRecord(
  studentId: string,
  date: string
): Promise<ShadowTeacherDailyRecord | null> {
  const { data, error } = await supabase
    .from("shadow_teacher_daily_records")
    .select("*")
    .eq("student_id", studentId)
    .eq("date", date)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as ShadowTeacherDailyRecord | null;
}

export async function fetchShadowRecordHistory(
  studentId: string,
  limit = 15
): Promise<ShadowTeacherDailyRecord[]> {
  const { data, error } = await supabase
    .from("shadow_teacher_daily_records")
    .select("*")
    .eq("student_id", studentId)
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data as unknown as ShadowTeacherDailyRecord[];
}

export async function saveShadowRecord(params: {
  id?: string;
  schoolId: string;
  classId: string;
  studentId: string;
  shadowTeacherId: string;
  therapistInvolved: string | null;
  date: string;
  termNumber: number | null;
  week: number | null;
  dayLabel: string | null;
  sections: SectionsData;
  status: "draft" | "submitted";
  shadowSignature: string | null;
  classTeacherSignature: string | null;
  signedDate: string | null;
}): Promise<ShadowTeacherDailyRecord> {
  const payload = {
    school_id: params.schoolId,
    class_id: params.classId,
    student_id: params.studentId,
    shadow_teacher_id: params.shadowTeacherId,
    therapist_involved: params.therapistInvolved,
    date: params.date,
    term_number: params.termNumber,
    week: params.week,
    day_label: params.dayLabel,
    sections: params.sections,
    status: params.status,
    shadow_signature: params.shadowSignature,
    class_teacher_signature: params.classTeacherSignature,
    signed_date: params.signedDate,
    created_by: params.shadowTeacherId,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("shadow_teacher_daily_records")
    .upsert((params.id ? { id: params.id, ...payload } : payload) as any, { onConflict: "student_id,date" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  logAuditEvent({
    school_id: params.schoolId,
    actor_id: params.shadowTeacherId,
    action: params.status === "submitted" ? "shadow_daily_record.submitted" : "shadow_daily_record.saved",
    entity_type: "student",
    entity_id: params.studentId,
    details: { date: params.date, status: params.status },
  });

  return data as unknown as ShadowTeacherDailyRecord;
}

// Looks up the class teacher's name for the informational "Class Teacher"
// field on the Shadow Teacher's form header.
export async function fetchClassTeacherName(classId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("classes")
    .select("teacher:profiles!classes_class_teacher_id_fkey(full_name)")
    .eq("id", classId)
    .maybeSingle();
  if (error) return null;
  return (data as any)?.teacher?.full_name ?? null;
}
