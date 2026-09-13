import { supabase } from "../../lib/supabase";
import { logAuditEvent } from "../audit/api";
import type { ClassLevel } from "@natm/shared-types";

export interface Subject {
  id: string;
  name: string;
  created_at: string;
}

export interface ClassSubject {
  id: string;
  class_id: string;
  subject_id: string;
  subject: Subject;
}

// Subjects are global (not school-scoped) — shared across every tenant,
// same as the underlying subjects table used by Curriculum.
export async function fetchAllSubjects(): Promise<Subject[]> {
  const { data, error } = await supabase.from("subjects").select("*").order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

// Subjects a Super Admin has restricted to a given level via
// subject_levels (currently just the 8 Early Years subjects, mapped to
// Creche-KG2). Returns [] for any level nobody's restricted yet
// (Primary/Secondary today) -- callers should fall back to the full
// fetchAllSubjects list in that case, so this is additive rather than a
// behaviour change for levels that haven't been configured.
export async function fetchSubjectsForLevel(level: ClassLevel): Promise<Subject[]> {
  const { data, error } = await supabase
    .from("subject_levels")
    .select("subject:subjects(*)")
    .eq("level", level);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as { subject: Subject }[])
    .map((r) => r.subject)
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Creates the subject if it doesn't already exist by that exact name,
// otherwise returns the existing row. Subjects are global, so this can
// collide across schools deliberately (e.g. two schools both add "Math").
export async function findOrCreateSubject(name: string): Promise<Subject> {
  const trimmed = name.trim();
  const { data: existing, error: findError } = await supabase
    .from("subjects")
    .select("*")
    .ilike("name", trimmed)
    .maybeSingle();
  if (findError) throw new Error(findError.message);
  if (existing) return existing;

  const { data: created, error: createError } = await supabase
    .from("subjects")
    .insert({ name: trimmed })
    .select()
    .single();
  if (createError) throw new Error(createError.message);
  return created;
}

export async function fetchClassSubjects(classId: string): Promise<ClassSubject[]> {
  const { data, error } = await supabase
    .from("class_subjects")
    .select("id, class_id, subject_id, subject:subjects(*)")
    .eq("class_id", classId);
  if (error) throw new Error(error.message);
  return (data as unknown as ClassSubject[]).sort((a, b) => a.subject.name.localeCompare(b.subject.name));
}

export async function assignSubjectToClass(
  classId: string,
  subjectId: string,
  schoolId: string,
  actorId: string
): Promise<void> {
  const { error } = await supabase.from("class_subjects").insert({ class_id: classId, subject_id: subjectId });
  if (error) throw new Error(error.message);
  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "class.subject_added",
    entity_type: "class",
    entity_id: classId,
    details: { subject_id: subjectId },
  });
}

export async function removeSubjectFromClass(
  classSubjectId: string,
  classId: string,
  subjectId: string,
  schoolId: string,
  actorId: string
): Promise<void> {
  const { error } = await supabase.from("class_subjects").delete().eq("id", classSubjectId);
  if (error) throw new Error(error.message);
  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "class.subject_removed",
    entity_type: "class",
    entity_id: classId,
    details: { subject_id: subjectId },
  });
}
