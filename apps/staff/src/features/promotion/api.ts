import { supabase } from "../../lib/supabase";
import { CLASS_LEVELS } from "../classes/api";
import { logAuditEvent } from "../audit/api";
import {
  CLASS_TEACHER_OBSERVATION_SECTIONS,
  termCompositeScore,
  type DailyRecordLike,
} from "@natm/shared-types";

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

// Students already actioned this session -- shown as a badge on the
// Promotion page so admin doesn't lose track partway through a class,
// but re-submission isn't blocked (promotions is an append-only history
// table, same audit-trail philosophy as the rest of this schema, so a
// correction just adds another row rather than needing an update path).
export async function fetchPromotionsForSession(
  schoolId: string,
  academicSessionId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("promotions")
    .select("student_id")
    .eq("school_id", schoolId)
    .eq("academic_session_id", academicSessionId);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.student_id));
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

// The current term's number and end date, for the homeschool Promotion page
// to say whether the term is over yet.
export async function fetchCurrentTermInfo(
  schoolId: string
): Promise<{ termNumber: number; endDate: string | null } | null> {
  const { data: session } = await supabase
    .from("academic_sessions")
    .select("id")
    .eq("school_id", schoolId)
    .eq("is_current", true)
    .maybeSingle();
  if (!session) return null;
  const { data: term } = await supabase
    .from("terms")
    .select("term_number, end_date")
    .eq("session_id", session.id)
    .eq("is_current", true)
    .maybeSingle();
  if (!term) return null;
  return { termNumber: term.term_number, endDate: term.end_date };
}

// Term score per student in one query (instead of one per child), using the
// same composite the school Promotion review shows. Students with no
// observations this term are simply absent from the result.
export async function fetchTermScores(
  studentIds: string[],
  termNumber: number
): Promise<Record<string, number>> {
  if (studentIds.length === 0) return {};
  const { data, error } = await supabase
    .from("daily_teacher_observations")
    .select("*")
    .in("student_id", studentIds)
    .eq("term_number", termNumber);
  if (error) throw new Error(error.message);
  const byStudent = new Map<string, DailyRecordLike[]>();
  for (const row of (data ?? []) as unknown as (DailyRecordLike & { student_id: string })[]) {
    if (!byStudent.has(row.student_id)) byStudent.set(row.student_id, []);
    byStudent.get(row.student_id)!.push(row);
  }
  const scores: Record<string, number> = {};
  for (const [id, rows] of byStudent) {
    const score = termCompositeScore(CLASS_TEACHER_OBSERVATION_SECTIONS, rows);
    if (score !== null) scores[id] = score;
  }
  return scores;
}
