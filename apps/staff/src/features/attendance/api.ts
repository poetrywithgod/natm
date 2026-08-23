import { supabase } from "../../lib/supabase";
import { logAuditEvent } from "../audit/api";

export type AttendanceStatus = "present" | "absent" | "late";

export interface MyClass {
  id: string;
  name: string;
}

export interface ClassStudent {
  id: string;
  full_name: string;
  unique_student_id: string | null;
}

export interface AttendanceRecord {
  student_id: string;
  status: AttendanceStatus;
}

// Finds the single class this class_teacher is assigned to (a class
// has at most one class_teacher_id, per the existing schema).
export async function fetchMyClass(teacherId: string): Promise<MyClass | null> {
  const { data, error } = await supabase
    .from("classes")
    .select("id, name")
    .eq("class_teacher_id", teacherId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchClassStudents(classId: string): Promise<ClassStudent[]> {
  const { data, error } = await supabase
    .from("students")
    .select("id, full_name, unique_student_id")
    .eq("class_id", classId)
    .order("full_name", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchAttendanceForDate(
  classId: string,
  date: string
): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from("attendance")
    .select("student_id, status")
    .eq("class_id", classId)
    .eq("date", date);
  if (error) throw new Error(error.message);
  return data;
}

// Bulk upsert — one row per student for the given date. Conflict target
// matches the existing unique(student_id, date) constraint on attendance.
export async function saveAttendance(
  classId: string,
  termId: string,
  date: string,
  markedBy: string,
  entries: { studentId: string; status: AttendanceStatus }[],
  schoolId: string
): Promise<void> {
  const rows = entries.map((e) => ({
    student_id: e.studentId,
    class_id: classId,
    term_id: termId,
    date,
    status: e.status,
    marked_by: markedBy,
  }));
  const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "student_id,date" });
  if (error) throw new Error(error.message);
  logAuditEvent({
    school_id: schoolId,
    actor_id: markedBy,
    action: "attendance.marked",
    entity_type: "class",
    entity_id: classId,
    details: { date, student_count: entries.length },
  });
}
