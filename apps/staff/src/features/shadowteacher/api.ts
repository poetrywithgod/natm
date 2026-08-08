import { supabase } from "../../lib/supabase";

export interface MyStudent {
  id: string;
  full_name: string;
  photo_url: string | null;
  class_id: string | null;
  class_name: string | null;
}

export async function fetchMyStudents(shadowTeacherId: string): Promise<MyStudent[]> {
  const { data, error } = await supabase
    .from("shadow_teacher_assignments")
    .select("student:students(id, full_name, photo_url, class_id, class:classes(name))")
    .eq("shadow_teacher_id", shadowTeacherId)
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  return (data as any[])
    .map((row) => row.student)
    .filter(Boolean)
    .map((s: any) => ({
      id: s.id,
      full_name: s.full_name,
      photo_url: s.photo_url,
      class_id: s.class_id,
      class_name: s.class?.name ?? null,
    }));
}

export interface StudentInfo {
  id: string;
  full_name: string;
  photo_url: string | null;
  class_id: string | null;
  class_name: string | null;
}

export async function fetchStudentInfo(studentId: string): Promise<StudentInfo | null> {
  const { data, error } = await supabase
    .from("students")
    .select("id, full_name, photo_url, class_id, class:classes(name)")
    .eq("id", studentId)
    .single();
  if (error) return null;
  const s = data as any;
  return {
    id: s.id,
    full_name: s.full_name,
    photo_url: s.photo_url,
    class_id: s.class_id,
    class_name: s.class?.name ?? null,
  };
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  total: number;
  recent: { date: string; status: string }[];
}

export async function fetchStudentAttendance(studentId: string): Promise<AttendanceSummary> {
  const { data, error } = await supabase
    .from("attendance")
    .select("date, status")
    .eq("student_id", studentId)
    .order("date", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { date: string; status: string }[];
  const summary: AttendanceSummary = { present: 0, absent: 0, late: 0, total: rows.length, recent: rows.slice(0, 10) };
  for (const r of rows) {
    if (r.status === "present") summary.present++;
    else if (r.status === "absent") summary.absent++;
    else if (r.status === "late") summary.late++;
  }
  return summary;
}

export interface OfferedSubject {
  id: string;
  name: string;
}

export async function fetchOfferedSubjects(classId: string): Promise<OfferedSubject[]> {
  const { data, error } = await supabase
    .from("class_subjects")
    .select("subject:subjects(id, name)")
    .eq("class_id", classId);
  if (error) throw new Error(error.message);
  return (data as any[]).map((row) => row.subject).filter(Boolean);
}

export interface SubjectProgress {
  subject_id: string;
  subject_name: string;
  average_score: number;
  quarter_number: number;
  year: number;
}

// Latest finalized quarter's score per subject, for the Subject Progress bars.
export async function fetchSubjectProgress(studentId: string): Promise<SubjectProgress[]> {
  const { data, error } = await supabase
    .from("quarterly_subject_scores")
    .select("subject_id, average_score, quarter_number, year, subject:subjects(name)")
    .eq("student_id", studentId)
    .order("year", { ascending: false })
    .order("quarter_number", { ascending: false });
  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  const result: SubjectProgress[] = [];
  for (const row of data as any[]) {
    if (seen.has(row.subject_id)) continue;
    seen.add(row.subject_id);
    result.push({
      subject_id: row.subject_id,
      subject_name: row.subject?.name ?? "Unknown subject",
      average_score: row.average_score,
      quarter_number: row.quarter_number,
      year: row.year,
    });
  }
  return result;
}

export interface ActivityFeedItem {
  id: string;
  date: string;
  topic: string;
  notes: string | null;
  subject_name: string;
  reinforcement: { id: string; note: string; created_at: string } | null;
}

export async function fetchActivityFeed(classId: string, studentId: string): Promise<ActivityFeedItem[]> {
  const { data, error } = await supabase
    .from("class_activities")
    .select(
      "id, date, topic, notes, subject:subjects(name), reinforcements:activity_reinforcements(id, note, created_at, student_id)"
    )
    .eq("class_id", classId)
    .order("date", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);

  return (data as any[]).map((row) => {
    const reinforcement = (row.reinforcements as any[])?.find((r) => r.student_id === studentId) ?? null;
    return {
      id: row.id,
      date: row.date,
      topic: row.topic,
      notes: row.notes,
      subject_name: row.subject?.name ?? "Unknown subject",
      reinforcement: reinforcement
        ? { id: reinforcement.id, note: reinforcement.note, created_at: reinforcement.created_at }
        : null,
    };
  });
}

export async function saveReinforcementNote(
  classActivityId: string,
  studentId: string,
  shadowTeacherId: string,
  note: string
): Promise<void> {
  const { error } = await supabase.from("activity_reinforcements").upsert(
    {
      class_activity_id: classActivityId,
      student_id: studentId,
      shadow_teacher_id: shadowTeacherId,
      note,
    },
    { onConflict: "class_activity_id,student_id" }
  );
  if (error) throw new Error(error.message);
}

export interface SubjectAverage {
  subject_name: string;
  average_score: number;
}

// Averages every quarterly_subject_scores row across the given students,
// grouped by subject -- used for the Dashboard overview chart.
export async function fetchSubjectAverages(studentIds: string[]): Promise<SubjectAverage[]> {
  if (studentIds.length === 0) return [];
  const { data, error } = await supabase
    .from("quarterly_subject_scores")
    .select("average_score, subject:subjects(name)")
    .in("student_id", studentIds);
  if (error) throw new Error(error.message);

  const totals = new Map<string, { sum: number; count: number }>();
  for (const row of data as any[]) {
    const name = row.subject?.name ?? "Unknown subject";
    const entry = totals.get(name) ?? { sum: 0, count: 0 };
    entry.sum += row.average_score;
    entry.count += 1;
    totals.set(name, entry);
  }

  return Array.from(totals.entries()).map(([subject_name, { sum, count }]) => ({
    subject_name,
    average_score: sum / count,
  }));
}
