import { supabase } from "../../lib/supabase";
import { sinceDateISO } from "@natm/shared-types";
import type { DailyTeacherObservation } from "../observations/api";
import type { ShadowTeacherDailyRecord } from "../shadowRecords/api";

// Full-row, range-bounded fetches for the Daily Log tab (Admin + Shadow
// Teacher Student Detail). Unlike fetchObservationHistory/
// fetchShadowRecordHistory (capped at a recent count, used elsewhere for
// short recent-history lists), these are windowed by date so they can
// answer "show me this student's whole journey" -- 1/2/3/6 months, 1
// year, or all-time -- the same range vocabulary the Parent/Student
// Progress page uses.
export async function fetchObservationsForRange(
  studentId: string,
  days: number | null
): Promise<DailyTeacherObservation[]> {
  let query = supabase.from("daily_teacher_observations").select("*").eq("student_id", studentId);
  const since = sinceDateISO(days);
  if (since) query = query.gte("date", since);
  const { data, error } = await query.order("date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DailyTeacherObservation[];
}

export async function fetchShadowRecordsForRange(
  studentId: string,
  days: number | null
): Promise<ShadowTeacherDailyRecord[]> {
  let query = supabase.from("shadow_teacher_daily_records").select("*").eq("student_id", studentId);
  const since = sinceDateISO(days);
  if (since) query = query.gte("date", since);
  const { data, error } = await query.order("date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ShadowTeacherDailyRecord[];
}

// subjects is a small global table (shared with Curriculum) -- fetched
// once to resolve the subject IDs stored in each day's Subject
// Performance ratings back to display names. Mirrors the student-parent
// app's fetchSubjectNameMap.
export async function fetchSubjectNameMap(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("subjects").select("id, name");
  if (error) throw new Error(error.message);
  const map: Record<string, string> = {};
  for (const s of data ?? []) map[s.id] = s.name;
  return map;
}
