import { supabase } from "../../lib/supabase";
import { CLASS_LEVEL_LABELS, type ClassLevel } from "@natm/shared-types";

export type { ClassLevel };
export { CLASS_LEVEL_LABELS };

export interface CurriculumDocView {
  id: string;
  subject_name: string;
  level: ClassLevel;
  term_number: number;
  pdf_url: string | null;
  pdf_filename: string | null;
}

// Same shape as apps/staff's fetchCurriculumForClassTeacher/
// fetchCurriculumForShadowTeacher -- student's own class, only the
// subjects assigned to it, only the current term. Changes automatically
// when the school advances to the next term.
export async function fetchCurriculumForStudent(profileId: string, schoolId: string): Promise<CurriculumDocView[]> {
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("class_id")
    .eq("profile_id", profileId)
    .single();
  if (studentError || !student.class_id) return [];

  const { data: cls, error: classError } = await supabase
    .from("classes")
    .select("level")
    .eq("id", student.class_id)
    .single();
  if (classError || !cls.level) return [];

  const { data: session } = await supabase
    .from("academic_sessions")
    .select("id")
    .eq("school_id", schoolId)
    .eq("is_current", true)
    .maybeSingle();
  if (!session) return [];
  const { data: term } = await supabase
    .from("terms")
    .select("term_number")
    .eq("session_id", session.id)
    .eq("is_current", true)
    .maybeSingle();
  if (!term) return [];

  const { data: classSubjects, error: subjectsError } = await supabase
    .from("class_subjects")
    .select("subject_id")
    .eq("class_id", student.class_id);
  if (subjectsError) throw new Error(subjectsError.message);
  const subjectIds = (classSubjects ?? []).map((cs) => cs.subject_id);
  if (subjectIds.length === 0) return [];

  const { data, error } = await supabase
    .from("curriculum_documents")
    .select("id, level, term_number, pdf_url, pdf_filename, subjects(name)")
    .eq("level", cls.level)
    .eq("term_number", term.term_number)
    .in("subject_id", subjectIds)
    .not("pdf_url", "is", null);
  if (error) throw new Error(error.message);

  return (data ?? []).map((d) => ({
    id: d.id,
    subject_name: (d.subjects as unknown as { name: string } | null)?.name ?? "Unknown subject",
    level: d.level,
    term_number: d.term_number,
    pdf_url: d.pdf_url,
    pdf_filename: d.pdf_filename,
  }));
}
