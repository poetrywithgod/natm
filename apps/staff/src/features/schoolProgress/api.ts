import { supabase } from "../../lib/supabase";
import type { SectionsData } from "@natm/shared-types";

// Raw rows for the School Admin's school-wide "most improved / needs
// attention" widget. Deliberately unjoined (no student/class names) --
// the dashboard already has the student roster loaded separately, so this
// stays a light, single-purpose query.
export async function fetchSchoolObservationsSince(
  schoolId: string,
  sinceDateISO: string
): Promise<{ student_id: string; date: string; sections: SectionsData }[]> {
  const { data, error } = await supabase
    .from("daily_teacher_observations")
    .select("student_id, date, sections")
    .eq("school_id", schoolId)
    .gte("date", sinceDateISO);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as { student_id: string; date: string; sections: SectionsData }[];
}
