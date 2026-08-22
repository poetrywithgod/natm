import { supabase } from "../../lib/supabase";
import type { Database } from "@natm/supabase";

type ClassLevel = Database["public"]["Enums"]["class_level"];

export interface IntakeQueueItem {
  episodeId: string;
  studentId: string;
  studentName: string;
  uniqueStudentId: string;
  episodeNumber: number;
  status: string;
  submittedAt: string | null;
}

export interface SuggestedSubject {
  subject_id: string;
  subject_name: string;
  rationale: string;
}

export interface EpisodeDetail {
  episodeId: string;
  studentId: string;
  studentName: string;
  uniqueStudentId: string;
  episodeNumber: number;
  status: string;
  form1SubmittedAt: string | null;
  form1ApprovedAt: string | null;
  partA: Record<string, unknown>;
  partB: Record<string, unknown>;
  consents: Record<string, unknown>;
  suggestedSubjects: SuggestedSubject[];
  suggestedSummary: string | null;
  suggestedLevel: string | null;
  approvedSubjects: SuggestedSubject[] | null;
  approvedLevel: string | null;
}

export async function fetchIntakeQueue(schoolId: string): Promise<IntakeQueueItem[]> {
  const { data, error } = await supabase
    .from("assessment_episodes")
    .select("id, episode_number, status, form1_submitted_at, student_id, students(full_name, unique_student_id)")
    .eq("school_id", schoolId)
    .eq("status", "form1_submitted")
    .order("form1_submitted_at", { ascending: true });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const student = Array.isArray(row.students) ? row.students[0] : row.students;
    return {
      episodeId: row.id,
      studentId: row.student_id,
      studentName: student?.full_name ?? "Unknown",
      uniqueStudentId: student?.unique_student_id ?? "—",
      episodeNumber: row.episode_number,
      status: row.status,
      submittedAt: row.form1_submitted_at,
    };
  });
}

export async function fetchEpisodeDetail(episodeId: string): Promise<EpisodeDetail> {
  const { data: episode, error: episodeError } = await supabase
    .from("assessment_episodes")
    .select(
      "id, episode_number, status, form1_submitted_at, form1_approved_at, student_id, suggested_subjects, suggested_level, approved_subjects, approved_level, students(full_name, unique_student_id)"
    )
    .eq("id", episodeId)
    .single();
  if (episodeError) throw new Error(episodeError.message);

  const { data: form1, error: form1Error } = await supabase
    .from("form1_submissions")
    .select("part_a, part_b, consents")
    .eq("episode_id", episodeId)
    .single();
  if (form1Error) throw new Error(form1Error.message);

  const student = Array.isArray(episode.students) ? episode.students[0] : episode.students;

  const suggested = episode.suggested_subjects as { subjects?: SuggestedSubject[]; summary?: string } | null;
  const approved = episode.approved_subjects as SuggestedSubject[] | null;

  return {
    episodeId: episode.id,
    studentId: episode.student_id,
    studentName: student?.full_name ?? "Unknown",
    uniqueStudentId: student?.unique_student_id ?? "—",
    episodeNumber: episode.episode_number,
    status: episode.status,
    form1SubmittedAt: episode.form1_submitted_at,
    form1ApprovedAt: episode.form1_approved_at,
    partA: form1.part_a ?? {},
    partB: form1.part_b ?? {},
    consents: form1.consents ?? {},
    suggestedSubjects: suggested?.subjects ?? [],
    suggestedSummary: suggested?.summary ?? null,
    suggestedLevel: episode.suggested_level,
    approvedSubjects: approved,
    approvedLevel: episode.approved_level,
  };
}

export async function generateRecommendation(episodeId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("generate-iep-recommendation", {
    body: { episode_id: episodeId },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
}

export async function approveRecommendation(
  episodeId: string,
  studentId: string,
  schoolId: string,
  approvedSubjects: SuggestedSubject[],
  approvedLevel: ClassLevel,
  approvedBy: string
): Promise<void> {
  const now = new Date().toISOString();

  const { error: episodeError } = await supabase
    .from("assessment_episodes")
    .update({
      approved_subjects: approvedSubjects,
      approved_level: approvedLevel as ClassLevel,
      status: "completed",
      completed_at: now,
      completed_by: approvedBy,
    })
    .eq("id", episodeId)
    .eq("status", "ai_suggested");
  if (episodeError) throw new Error(episodeError.message);

  const rows = approvedSubjects.map((s) => ({
    student_id: studentId,
    subject_id: s.subject_id,
    school_id: schoolId,
    assessment_episode_id: episodeId,
    assigned_by: approvedBy,
  }));

  const { error: subjectsError } = await supabase
    .from("student_subjects")
    .upsert(rows, { onConflict: "student_id,subject_id" });
  if (subjectsError) throw new Error(subjectsError.message);
}

export async function approveForm1(episodeId: string, approvedBy: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("assessment_episodes")
    .update({ status: "form1_approved", form1_approved_at: now, form1_approved_by: approvedBy })
    .eq("id", episodeId)
    .eq("status", "form1_submitted");
  if (error) throw new Error(error.message);
}
