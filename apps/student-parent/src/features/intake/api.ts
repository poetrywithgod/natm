import { supabase } from "../../lib/supabase";
import { advanceOnboardingStatus } from "../profile/api";

export interface DraftEpisode {
  episodeId: string;
  form1Id: string;
  partA: Record<string, unknown>;
  partB: Record<string, unknown>;
  consents: Record<string, unknown>;
}

export async function getOrCreateDraftEpisode(
  schoolId: string,
  studentId: string
): Promise<DraftEpisode> {
  const { data: existing, error: existingError } = await supabase
    .from("assessment_episodes")
    .select("id, form1_submissions(id, part_a, part_b, consents)")
    .eq("student_id", studentId)
    .eq("status", "form1_draft")
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  if (existing) {
    const form1 = existing.form1_submissions as unknown as
      | { id: string; part_a: Record<string, unknown>; part_b: Record<string, unknown>; consents: Record<string, unknown> }
      | { id: string; part_a: Record<string, unknown>; part_b: Record<string, unknown>; consents: Record<string, unknown> }[]
      | null;
    const row = Array.isArray(form1) ? form1[0] : form1;
    if (row) {
      return {
        episodeId: existing.id,
        form1Id: row.id,
        partA: row.part_a ?? {},
        partB: row.part_b ?? {},
        consents: row.consents ?? {},
      };
    }
  }

  const { count, error: countError } = await supabase
    .from("assessment_episodes")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId);
  if (countError) throw new Error(countError.message);

  const { data: episode, error: episodeError } = await supabase
    .from("assessment_episodes")
    .insert({
      school_id: schoolId,
      student_id: studentId,
      episode_number: (count ?? 0) + 1,
      status: "form1_draft",
    })
    .select("id")
    .single();
  if (episodeError) throw new Error(episodeError.message);

  const { data: form1, error: form1Error } = await supabase
    .from("form1_submissions")
    .insert({
      episode_id: episode.id,
      school_id: schoolId,
      student_id: studentId,
    })
    .select("id")
    .single();
  if (form1Error) throw new Error(form1Error.message);

  return { episodeId: episode.id, form1Id: form1.id, partA: {}, partB: {}, consents: {} };
}

export async function saveFormDraft(
  form1Id: string,
  section: "part_a" | "part_b" | "consents",
  data: Record<string, unknown>
): Promise<void> {
  const { data: current, error: fetchError } = await supabase
    .from("form1_submissions")
    .select(section)
    .eq("id", form1Id)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  const currentRecord = current as unknown as Record<
    string,
    Record<string, unknown> | null
  >;

  const merged = {
    ...(currentRecord[section] ?? {}),
    ...data,
  };

  const updatedAt = new Date().toISOString();

  if (section === "part_a") {
    const { error } = await supabase
      .from("form1_submissions")
      .update({ part_a: merged, updated_at: updatedAt })
      .eq("id", form1Id);

    if (error) throw new Error(error.message);
  } else if (section === "part_b") {
    const { error } = await supabase
      .from("form1_submissions")
      .update({ part_b: merged, updated_at: updatedAt })
      .eq("id", form1Id);

    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("form1_submissions")
      .update({ consents: merged, updated_at: updatedAt })
      .eq("id", form1Id);

    if (error) throw new Error(error.message);
  }
}

export async function submitForm1(
  form1Id: string,
  episodeId: string,
  submittedBy: string,
  studentId: string
): Promise<void> {
  const now = new Date().toISOString();

  const { error: form1Error } = await supabase
    .from("form1_submissions")
    .update({ submitted_at: now, submitted_by: submittedBy })
    .eq("id", form1Id);
  if (form1Error) throw new Error(form1Error.message);

  const { error: episodeError } = await supabase
    .from("assessment_episodes")
    .update({ status: "form1_submitted", form1_submitted_at: now })
    .eq("id", episodeId);
  if (episodeError) throw new Error(episodeError.message);

  // Keep the coarse-grained students.onboarding_status (used by the
  // route gate) in sync with the more granular episode status.
  await advanceOnboardingStatus(studentId, "pending_review");
}
