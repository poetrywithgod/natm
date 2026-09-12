import { supabase } from "../../lib/supabase";
import type { SectionsData } from "@natm/shared-types";

export interface DailyRecordRow {
  date: string;
  sections: SectionsData;
}

export interface ProgressRangeOption {
  label: string;
  // Trailing days to fetch. `null` means all-time (no lower bound at all --
  // a student's entire logged journey, however far back it goes).
  days: number | null;
}

// Journey range presets shown on the Parent/Student Progress page. "All"
// intentionally has no cap: a student's daily log is only ever as long as
// their own enrolment, so there's no real risk of pulling in an
// unreasonably large result set the way there would be for, say, a
// school-wide query.
export const PROGRESS_RANGE_OPTIONS: ProgressRangeOption[] = [
  { label: "1M", days: 30 },
  { label: "2M", days: 60 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "All", days: null },
];

export const DEFAULT_PROGRESS_RANGE_DAYS: number | null = 90;

function sinceDateISO(days: number | null): string | null {
  if (days === null) return null;
  const since = new Date();
  since.setDate(since.getDate() - days);
  return since.toISOString().slice(0, 10);
}

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
