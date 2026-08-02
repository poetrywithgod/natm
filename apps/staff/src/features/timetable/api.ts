import { supabase } from "../../lib/supabase";

export type TimetablePeriod = {
  id: string;
  school_id: string;
  period_number: number;
  label: string;
  start_time: string;
  end_time: string;
};

export type TimetableEntry = {
  id: string;
  school_id: string;
  class_id: string;
  day_of_week: number; // 1=Mon .. 5=Fri
  period_id: string;
  subject_id: string;
  teacher_id: string;
  subject?: { id: string; name: string };
  teacher?: { id: string; full_name: string };
};

export const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
] as const;

export async function fetchPeriods(schoolId: string): Promise<TimetablePeriod[]> {
  const { data, error } = await supabase
    .from("timetable_periods")
    .select("*")
    .eq("school_id", schoolId)
    .order("period_number", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createPeriod(input: {
  school_id: string;
  period_number: number;
  label: string;
  start_time: string;
  end_time: string;
}): Promise<TimetablePeriod> {
  const { data, error } = await supabase
    .from("timetable_periods")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePeriod(
  id: string,
  input: Partial<Pick<TimetablePeriod, "label" | "start_time" | "end_time" | "period_number">>
): Promise<void> {
  const { error } = await supabase.from("timetable_periods").update(input).eq("id", id);
  if (error) throw error;
}

export async function deletePeriod(id: string): Promise<void> {
  const { error } = await supabase.from("timetable_periods").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchTimetableEntries(classId: string): Promise<TimetableEntry[]> {
  const { data, error } = await supabase
    .from("timetable_entries")
    .select("*, subject:subjects(id, name), teacher:profiles(id, full_name)")
    .eq("class_id", classId);
  if (error) throw error;
  return (data as unknown as TimetableEntry[]) ?? [];
}

export async function upsertTimetableEntry(input: {
  school_id: string;
  class_id: string;
  day_of_week: number;
  period_id: string;
  subject_id: string;
  teacher_id: string;
}): Promise<void> {
  const { error } = await supabase
    .from("timetable_entries")
    .upsert(input, { onConflict: "class_id,day_of_week,period_id" });
  if (error) throw error;
}

export async function deleteTimetableEntry(id: string): Promise<void> {
  const { error } = await supabase.from("timetable_entries").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchSubjects(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase.from("subjects").select("id, name").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function fetchClassTeachers(schoolId: string): Promise<{ id: string; full_name: string }[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("school_id", schoolId)
    .eq("role", "class_teacher")
    .eq("is_active", true)
    .order("full_name");
  if (error) throw error;
  return data ?? [];
}
