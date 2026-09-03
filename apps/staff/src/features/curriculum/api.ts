import { supabase } from "../../lib/supabase";
import type { Database } from "@natm/supabase";

export type ClassLevel = Database["public"]["Enums"]["class_level"];

export const CLASS_LEVEL_LABELS: Record<string, string> = {
  creche: "Creche",
  pre_nursery: "Pre-Nursery",
  nursery_1: "Nursery 1",
  nursery_2: "Nursery 2",
  kg_1: "KG 1",
  kg_2: "KG 2",
  primary_1: "Primary 1",
  primary_2: "Primary 2",
  primary_3: "Primary 3",
  primary_4: "Primary 4",
  primary_5: "Primary 5",
  primary_6: "Primary 6",
  jss_1: "JSS 1",
  jss_2: "JSS 2",
  jss_3: "JSS 3",
  ss_1: "SS 1",
  ss_2: "SS 2",
  ss_3: "SS 3",
};

export interface CurriculumDocView {
  id: string;
  subject_name: string;
  level: ClassLevel;
  term_number: number;
  pdf_url: string | null;
  pdf_filename: string | null;
}

async function fetchCurrentTermNumber(schoolId: string): Promise<number | null> {
  const { data: session } = await supabase
    .from("academic_sessions")
    .select("id")
    .eq("school_id", schoolId)
    .eq("is_current", true)
    .maybeSingle();
  if (!session) return null;

  const { data: term } = await supabase
    .from("terms")
    .select("term_number")
    .eq("session_id", session.id)
    .eq("is_current", true)
    .maybeSingle();
  return term?.term_number ?? null;
}

async function fetchDocsForLevelsAndSubjects(
  levels: ClassLevel[],
  subjectIds: string[] | null,
  termNumber: number | null
): Promise<CurriculumDocView[]> {
  if (levels.length === 0) return [];
  let query = supabase
    .from("curriculum_documents")
    .select("id, level, term_number, pdf_url, pdf_filename, subjects(name)")
    .in("level", levels)
    .not("pdf_url", "is", null);
  if (subjectIds) query = query.in("subject_id", subjectIds);
  if (termNumber !== null) query = query.eq("term_number", termNumber);

  const { data, error } = await query;
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

// School Admin sees everything relevant to their school -- every term,
// every subject, for any class level actually in use among their
// school's classes. No current-term restriction: they need to plan
// ahead and review past terms, unlike teachers/students who only care
// about what's being taught right now.
export async function fetchCurriculumForSchoolAdmin(schoolId: string): Promise<CurriculumDocView[]> {
  const { data: classes, error } = await supabase
    .from("classes")
    .select("level")
    .eq("school_id", schoolId)
    .not("level", "is", null);
  if (error) throw new Error(error.message);
  const levels = [...new Set((classes ?? []).map((c) => c.level as ClassLevel))];
  return fetchDocsForLevelsAndSubjects(levels, null, null);
}

// Class Teacher owns exactly one class -- sees that class's level, only
// the subjects assigned to it (class_subjects), only the current term.
export async function fetchCurriculumForClassTeacher(
  classTeacherId: string,
  schoolId: string
): Promise<CurriculumDocView[]> {
  const { data: cls, error } = await supabase
    .from("classes")
    .select("id, level")
    .eq("school_id", schoolId)
    .eq("class_teacher_id", classTeacherId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!cls || !cls.level) return [];

  const [{ data: classSubjects }, termNumber] = await Promise.all([
    supabase.from("class_subjects").select("subject_id").eq("class_id", cls.id),
    fetchCurrentTermNumber(schoolId),
  ]);
  const subjectIds = (classSubjects ?? []).map((cs) => cs.subject_id);
  if (subjectIds.length === 0 || termNumber === null) return [];

  return fetchDocsForLevelsAndSubjects([cls.level], subjectIds, termNumber);
}

// Shadow Teacher's assigned students can span multiple classes (even
// multiple levels) -- gathers every distinct (level, subjects) pair
// across all of them, current term only, same as Class Teacher.
export async function fetchCurriculumForShadowTeacher(
  shadowTeacherId: string,
  schoolId: string
): Promise<CurriculumDocView[]> {
  const { data: assignments, error } = await supabase
    .from("shadow_teacher_assignments")
    .select("student_id")
    .eq("shadow_teacher_id", shadowTeacherId)
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  const studentIds = (assignments ?? []).map((a) => a.student_id);
  if (studentIds.length === 0) return [];

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("class_id")
    .in("id", studentIds)
    .not("class_id", "is", null);
  if (studentsError) throw new Error(studentsError.message);
  const classIds = [...new Set((students ?? []).map((s) => s.class_id as string))];
  if (classIds.length === 0) return [];

  const [{ data: classes }, { data: classSubjects }, termNumber] = await Promise.all([
    supabase.from("classes").select("id, level").in("id", classIds).not("level", "is", null),
    supabase.from("class_subjects").select("subject_id").in("class_id", classIds),
    fetchCurrentTermNumber(schoolId),
  ]);
  const levels = [...new Set((classes ?? []).map((c) => c.level as ClassLevel))];
  const subjectIds = [...new Set((classSubjects ?? []).map((cs) => cs.subject_id))];
  if (levels.length === 0 || subjectIds.length === 0 || termNumber === null) return [];

  return fetchDocsForLevelsAndSubjects(levels, subjectIds, termNumber);
}
