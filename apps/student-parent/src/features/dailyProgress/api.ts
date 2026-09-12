import { supabase } from "../../lib/supabase";
import type { SectionsData } from "@natm/shared-types";

export interface DailyRecordRow {
  date: string;
  sections: SectionsData;
}

// Trailing window is capped at ~9 weeks: enough for a "this week vs last
// week" delta plus a readable 60-day trend line, without pulling a
// growing student's entire history into the browser on every visit.
export async function fetchStudentObservations(studentId: string, days = 63): Promise<DailyRecordRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from("daily_teacher_observations")
    .select("date, sections")
    .eq("student_id", studentId)
    .gte("date", since.toISOString().slice(0, 10))
    .order("date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DailyRecordRow[];
}

export async function fetchStudentShadowRecords(studentId: string, days = 63): Promise<DailyRecordRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from("shadow_teacher_daily_records")
    .select("date, sections")
    .eq("student_id", studentId)
    .gte("date", since.toISOString().slice(0, 10))
    .order("date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DailyRecordRow[];
}

// subjects is a small global table (shared with Curriculum) -- fetched
// once to resolve the subject IDs stored in each day's Subject
// Performance ratings back to display names.
export async function fetchSubjectNameMap(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("subjects").select("id, name");
  if (error) throw new Error(error.message);
  const map: Record<string, string> = {};
  for (const s of data ?? []) map[s.id] = s.name;
  return map;
}
