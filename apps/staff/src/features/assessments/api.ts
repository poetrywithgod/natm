import { supabase } from "../../lib/supabase";

export interface IntakeQueueItem {
  episodeId: string;
  studentId: string;
  studentName: string;
  uniqueStudentId: string;
  episodeNumber: number;
  status: string;
  submittedAt: string | null;
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
      "id, episode_number, status, form1_submitted_at, form1_approved_at, student_id, students(full_name, unique_student_id)"
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
  };
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
