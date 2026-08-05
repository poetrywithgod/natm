import { supabase } from "../../lib/supabase";
import { CLASS_LEVELS } from "../classes/api";
import { logAuditEvent } from "../audit/api";

export interface AttendanceRecord {
  id: string;
  date: string;
  status: "present" | "absent" | "late";
}

export interface FeeRecord {
  id: string;
  amount_due: number;
  amount_paid: number;
  is_paid: boolean;
  fee_type: { name: string } | null;
}

export interface ClassSuggestion {
  id: string;
  name: string;
  level: string | null;
}

export async function fetchStudentAttendance(studentId: string): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from("attendance")
    .select("id, date, status")
    .eq("student_id", studentId)
    .order("date", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchStudentFees(studentId: string): Promise<FeeRecord[]> {
  const { data, error } = await supabase
    .from("student_fees")
    .select("id, amount_due, amount_paid, is_paid, fee_type:fee_types(name)")
    .eq("student_id", studentId)
    .not("fee_type_id", "is", null);
  if (error) throw new Error(error.message);
  return (data as unknown as FeeRecord[]) ?? [];
}

export async function fetchCurrentSessionId(schoolId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("academic_sessions")
    .select("id")
    .eq("school_id", schoolId)
    .eq("is_current", true)
    .maybeSingle();
  if (error) return null;
  return data?.id ?? null;
}

export async function suggestNextClasses(
  schoolId: string,
  currentLevel: string | null
): Promise<ClassSuggestion[]> {
  const { data: allClasses, error } = await supabase
    .from("classes")
    .select("id, name, level")
    .eq("school_id", schoolId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  if (!allClasses) return [];

  if (!currentLevel) return allClasses;

  const idx = CLASS_LEVELS.findIndex((l) => l.value === currentLevel);
  const nextLevel = idx >= 0 && idx < CLASS_LEVELS.length - 1 ? CLASS_LEVELS[idx + 1].value : null;
  if (!nextLevel) return allClasses;

  const suggested = allClasses.filter((c) => c.level === nextLevel);
  return suggested.length > 0 ? suggested : allClasses;
}

export async function fetchSubjects(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase.from("subjects").select("id, name").order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function promoteStudent(input: {
  school_id: string;
  student_id: string;
  from_class_id: string | null;
  to_class_id: string;
  decision: "promoted" | "repeated";
  academic_session_id: string;
  promoted_by: string;
}): Promise<void> {
  const { error: logError } = await supabase.from("promotions").insert(input);
  if (logError) throw new Error(logError.message);

  const { error: updateError } = await supabase
    .from("students")
    .update({ class_id: input.to_class_id })
    .eq("id", input.student_id);
  if (updateError) throw new Error(updateError.message);

  logAuditEvent({
    school_id: input.school_id,
    actor_id: input.promoted_by,
    action: input.decision === "promoted" ? "student.promoted" : "student.repeated",
    entity_type: "student",
    entity_id: input.student_id,
    details: { from_class_id: input.from_class_id, to_class_id: input.to_class_id },
  });
}

export async function addCarryover(
  input: {
    school_id: string;
    student_id: string;
    subject_id: string;
    carryover_class_id: string;
    academic_session_id: string;
  },
  actorId: string
): Promise<void> {
  const { error } = await supabase.from("student_subject_carryovers").upsert(input, {
    onConflict: "student_id,subject_id,academic_session_id",
  });
  if (error) throw new Error(error.message);
  logAuditEvent({
    school_id: input.school_id,
    actor_id: actorId,
    action: "student.carryover_added",
    entity_type: "student",
    entity_id: input.student_id,
    details: { subject_id: input.subject_id, carryover_class_id: input.carryover_class_id },
  });
}

export async function fetchCarryovers(
  studentId: string,
  academicSessionId: string
): Promise<{ id: string; subject: { name: string } | null }[]> {
  const { data, error } = await supabase
    .from("student_subject_carryovers")
    .select("id, subject:subjects(name)")
    .eq("student_id", studentId)
    .eq("academic_session_id", academicSessionId);
  if (error) throw new Error(error.message);
  return (data as unknown as { id: string; subject: { name: string } | null }[]) ?? [];
}

export async function removeCarryover(id: string, schoolId: string, actorId: string): Promise<void> {
  const { error } = await supabase.from("student_subject_carryovers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "student.carryover_removed",
    entity_type: "student_subject_carryover",
    entity_id: id,
  });
}
