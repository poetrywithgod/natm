import { supabase } from "../../lib/supabase";
import { sinceDateISO, DEFAULT_PROGRESS_RANGE_DAYS, type SectionsData } from "@natm/shared-types";

export interface DailyRecordRow {
  date: string;
  sections: SectionsData;
}

// Re-exported for existing callers -- the actual definitions now live in
// @natm/shared-types since the Admin/Shadow Teacher Daily Log tab (staff
// app) needs the exact same presets.
export { PROGRESS_RANGE_OPTIONS, DEFAULT_PROGRESS_RANGE_DAYS, type ProgressRangeOption } from "@natm/shared-types";

export async function fetchStudentObservations(studentId: string, days: number | null = DEFAULT_PROGRESS_RANGE_DAYS): Promise<DailyRecordRow[]> {
  let query = supabase
    .from("daily_teacher_observations")
    .select("date, sections")
    .eq("student_id", studentId);
  const since = sinceDateISO(days);
  if (since) query = query.gte("date", since);
  const { data, error } = await query.order("date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DailyRecordRow[];
}

export async function fetchStudentShadowRecords(studentId: string, days: number | null = DEFAULT_PROGRESS_RANGE_DAYS): Promise<DailyRecordRow[]> {
  let query = supabase
    .from("shadow_teacher_daily_records")
    .select("date, sections")
    .eq("student_id", studentId);
  const since = sinceDateISO(days);
  if (since) query = query.gte("date", since);
  const { data, error } = await query.order("date", { ascending: true });
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
