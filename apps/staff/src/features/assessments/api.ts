import { supabase } from "../../lib/supabase";
import { logAuditEvent } from "../audit/api";
import type { Database, Json } from "@natm/supabase";

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
  classAssignedAt: string | null;
  shadowTeacherAssignedAt: string | null;
  currentClassId: string | null;
  currentClassName: string | null;
  currentShadowTeacherId: string | null;
  currentShadowTeacherName: string | null;
}

export interface ClassOption {
  id: string;
  name: string;
  level: string | null;
}

export interface ShadowTeacherOption {
  id: string;
  full_name: string;
  activeStudentCount: number;
}

export async function fetchIntakeQueue(schoolId: string): Promise<IntakeQueueItem[]> {
  // Deliberately NOT filtered to a single status: an admin needs to navigate
  // back into any episode regardless of stage (e.g. to continue Form 2 after
  // approving Form 1, or to revisit a completed one for Assign Class/Shadow
  // Teacher) -- narrowing this to "pending review only" was the original
  // design but left no way back into an episode once it moved past that
  // status, since every stage transition in this file navigates back here.
  const { data, error } = await supabase
    .from("assessment_episodes")
    .select(
      "id, episode_number, status, form1_submitted_at, created_at, student_id, students(full_name, unique_student_id)"
    )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });
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
      "id, episode_number, status, form1_submitted_at, form1_approved_at, student_id, suggested_subjects, suggested_level, approved_subjects, approved_level, class_assigned_at, shadow_teacher_assigned_at, students(full_name, unique_student_id, class_id, classes(name))"
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
  const currentClass = student ? (Array.isArray(student.classes) ? student.classes[0] : student.classes) : null;

  let currentShadowTeacherId: string | null = null;
  let currentShadowTeacherName: string | null = null;
  const { data: activeAssignment } = await supabase
    .from("shadow_teacher_assignments")
    .select("shadow_teacher_id, profiles(full_name)")
    .eq("student_id", episode.student_id)
    .eq("is_active", true)
    .maybeSingle();
  if (activeAssignment) {
    currentShadowTeacherId = activeAssignment.shadow_teacher_id;
    const teacherProfile = Array.isArray(activeAssignment.profiles)
      ? activeAssignment.profiles[0]
      : activeAssignment.profiles;
    currentShadowTeacherName = teacherProfile?.full_name ?? null;
  }

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
    partA: (form1.part_a ?? {}) as Record<string, unknown>,
    partB: (form1.part_b ?? {}) as Record<string, unknown>,
    consents: (form1.consents ?? {}) as Record<string, unknown>,
    suggestedSubjects: suggested?.subjects ?? [],
    suggestedSummary: suggested?.summary ?? null,
    suggestedLevel: episode.suggested_level,
    approvedSubjects: approved,
    approvedLevel: episode.approved_level,
    classAssignedAt: episode.class_assigned_at,
    shadowTeacherAssignedAt: episode.shadow_teacher_assigned_at,
    currentClassId: student?.class_id ?? null,
    currentClassName: currentClass?.name ?? null,
    currentShadowTeacherId,
    currentShadowTeacherName,
  };
}

export async function fetchClassOptions(schoolId: string): Promise<ClassOption[]> {
  const { data, error } = await supabase
    .from("classes")
    .select("id, name, level")
    .eq("school_id", schoolId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchShadowTeacherOptions(schoolId: string): Promise<ShadowTeacherOption[]> {
  const { data: teachers, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("school_id", schoolId)
    .eq("role", "shadow_teacher")
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  if (error) throw new Error(error.message);
  if (!teachers || teachers.length === 0) return [];

  // Caseload = count of currently-active shadow_teacher_assignments rows per
  // teacher. Shadow teacher -> students is deliberately uncapped and many-to-one
  // (unlike class teachers, who get one class each) -- this is purely a display
  // aid so admin can balance new assignments, not an enforced limit.
  const teacherIds = teachers.map((t) => t.id);
  const { data: assignments, error: assignError } = await supabase
    .from("shadow_teacher_assignments")
    .select("shadow_teacher_id")
    .eq("is_active", true)
    .in("shadow_teacher_id", teacherIds);
  if (assignError) throw new Error(assignError.message);

  const counts = new Map<string, number>();
  for (const a of assignments ?? []) {
    counts.set(a.shadow_teacher_id, (counts.get(a.shadow_teacher_id) ?? 0) + 1);
  }

  return teachers.map((t) => ({
    id: t.id,
    full_name: t.full_name,
    activeStudentCount: counts.get(t.id) ?? 0,
  }));
}

export async function assignClass(
  episodeId: string,
  studentId: string,
  classId: string,
  schoolId: string,
  assignedBy: string
): Promise<void> {
  const now = new Date().toISOString();

  const { error: studentError } = await supabase
    .from("students")
    .update({ class_id: classId })
    .eq("id", studentId);
  if (studentError) throw new Error(studentError.message);

  const { error: episodeError } = await supabase
    .from("assessment_episodes")
    .update({ class_assigned_at: now, class_assigned_by: assignedBy })
    .eq("id", episodeId)
    .eq("status", "completed");
  if (episodeError) throw new Error(episodeError.message);

  await logAuditEvent({
    school_id: schoolId,
    actor_id: assignedBy,
    action: "iep.class_assigned",
    entity_type: "assessment_episode",
    entity_id: episodeId,
    details: { student_id: studentId, class_id: classId },
  });
}

export async function assignShadowTeacher(
  episodeId: string,
  studentId: string,
  shadowTeacherId: string,
  schoolId: string,
  assignedBy: string
): Promise<void> {
  const now = new Date().toISOString();

  // Only one active shadow teacher per student (DB-enforced unique index) --
  // deactivate any existing active assignment before inserting the new one.
  const { error: deactivateError } = await supabase
    .from("shadow_teacher_assignments")
    .update({ is_active: false, ended_at: now })
    .eq("student_id", studentId)
    .eq("is_active", true);
  if (deactivateError) throw new Error(deactivateError.message);

  const { error: insertError } = await supabase
    .from("shadow_teacher_assignments")
    .insert({ student_id: studentId, shadow_teacher_id: shadowTeacherId, is_active: true });
  if (insertError) throw new Error(insertError.message);

  const { error: episodeError } = await supabase
    .from("assessment_episodes")
    .update({ shadow_teacher_assigned_at: now, shadow_teacher_assigned_by: assignedBy })
    .eq("id", episodeId)
    .eq("status", "completed");
  if (episodeError) throw new Error(episodeError.message);

  await logAuditEvent({
    school_id: schoolId,
    actor_id: assignedBy,
    action: "iep.shadow_teacher_assigned",
    entity_type: "assessment_episode",
    entity_id: episodeId,
    details: { student_id: studentId, shadow_teacher_id: shadowTeacherId },
  });
}

// supabase.functions.invoke() doesn't surface an Edge Function's actual JSON
// error body when it returns a non-2xx status -- error.message is just the
// generic "Edge Function returned a non-2xx status code". The real message
// (e.g. "AI request failed: ...") lives in error.context, the raw Response,
// and has to be read out separately.
async function extractFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: Response })?.context;
  if (context && typeof context.json === "function") {
    try {
      const body = await context.clone().json();
      if (typeof body?.error === "string") return body.error;
    } catch {
      try {
        const text = await context.clone().text();
        if (text) return text;
      } catch {
        // fall through to fallback
      }
    }
  }
  return (error as { message?: string })?.message ?? fallback;
}

export async function generateRecommendation(
  episodeId: string,
  schoolId: string,
  actorId: string
): Promise<void> {
  const { data, error } = await supabase.functions.invoke("generate-iep-recommendation", {
    body: { episode_id: episodeId },
  });
  if (error) throw new Error(await extractFunctionErrorMessage(error, "Failed to generate recommendation."));
  if (data?.error) throw new Error(data.error);

  await logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "iep.recommendation_generated",
    entity_type: "assessment_episode",
    entity_id: episodeId,
  });
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
      approved_subjects: approvedSubjects as unknown as Json,
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

  await logAuditEvent({
    school_id: schoolId,
    actor_id: approvedBy,
    action: "iep.recommendation_approved",
    entity_type: "assessment_episode",
    entity_id: episodeId,
    details: { approved_level: approvedLevel, subject_count: approvedSubjects.length },
  });
}

export async function approveForm1(episodeId: string, approvedBy: string, schoolId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("assessment_episodes")
    .update({ status: "form1_approved", form1_approved_at: now, form1_approved_by: approvedBy })
    .eq("id", episodeId)
    .eq("status", "form1_submitted");
  if (error) throw new Error(error.message);

  await logAuditEvent({
    school_id: schoolId,
    actor_id: approvedBy,
    action: "iep.form1_approved",
    entity_type: "assessment_episode",
    entity_id: episodeId,
  });
}
