import { supabase } from "../../lib/supabase";
import { logAuditEvent } from "../audit/api";
import type { Database } from "@natm/supabase";

type ClassLevel = Database["public"]["Enums"]["class_level"];

export const CLASS_LEVELS = [
  { value: "primary_1", label: "Primary 1" },
  { value: "primary_2", label: "Primary 2" },
  { value: "primary_3", label: "Primary 3" },
  { value: "primary_4", label: "Primary 4" },
  { value: "primary_5", label: "Primary 5" },
  { value: "primary_6", label: "Primary 6" },
  { value: "jss_1", label: "JSS 1" },
  { value: "jss_2", label: "JSS 2" },
  { value: "jss_3", label: "JSS 3" },
  { value: "ss_1", label: "SS 1" },
  { value: "ss_2", label: "SS 2" },
  { value: "ss_3", label: "SS 3" },
] as const;

export interface SchoolClass {
  id: string;
  school_id: string;
  name: string;
  class_teacher_id: string | null;
  level: string | null;
  created_at: string;
}

export interface ClassTeacherOption {
  id: string;
  full_name: string;
}

export async function fetchClasses(schoolId: string): Promise<SchoolClass[]> {
  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .eq("school_id", schoolId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchClassTeacherOptions(schoolId: string): Promise<ClassTeacherOption[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("school_id", schoolId)
    .eq("role", "class_teacher")
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function createClass(
  schoolId: string,
  name: string,
  level: string | null,
  actorId: string
): Promise<SchoolClass> {
  const { data, error } = await supabase
    .from("classes")
    .insert({ school_id: schoolId, name, level: level as ClassLevel | null })
    .select()
    .single();
  if (error) throw new Error(error.message);
  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "class.created",
    entity_type: "class",
    entity_id: data.id,
    details: { name, level },
  });
  return data;
}

// null clears the assignment (class_teacher_id references profiles with on delete set null,
// so this mirrors that same "unassigned" state deliberately).
export async function assignClassTeacher(
  classId: string,
  teacherId: string | null,
  schoolId: string,
  actorId: string
): Promise<void> {
  const { error } = await supabase
    .from("classes")
    .update({ class_teacher_id: teacherId })
    .eq("id", classId);
  if (error) throw new Error(error.message);
  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "class.teacher_assigned",
    entity_type: "class",
    entity_id: classId,
    details: { teacher_id: teacherId },
  });
}

export async function assignClassLevel(
  classId: string,
  level: string | null,
  schoolId: string,
  actorId: string
): Promise<void> {
  const { error } = await supabase.from("classes").update({ level: level as ClassLevel | null }).eq("id", classId);
  if (error) throw new Error(error.message);
  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "class.level_changed",
    entity_type: "class",
    entity_id: classId,
    details: { level },
  });
}

export async function renameClass(
  classId: string,
  name: string,
  schoolId: string,
  actorId: string
): Promise<void> {
  const { error } = await supabase
    .from("classes")
    .update({ name })
    .eq("id", classId);
  if (error) throw new Error(error.message);
  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "class.renamed",
    entity_type: "class",
    entity_id: classId,
    details: { name },
  });
}

// Blocks deletion if any students are still assigned to the class --
// deleting would cascade to that class's timetable, lessons, class
// work, class subjects, and fee types (all "on delete cascade" against
// classes), which is fine for an accidental/empty class but would
// silently wipe real academic data for a class students are actually
// in. Reassign or promote students out first.
export async function deleteClass(classId: string, schoolId: string, actorId: string): Promise<void> {
  const { count, error: countError } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId);
  if (countError) throw new Error(countError.message);
  if (count && count > 0) {
    throw new Error(
      `${count} student${count === 1 ? " is" : "s are"} still assigned to this class. Reassign or promote them out before deleting.`
    );
  }

  const { data: cls, error: fetchError } = await supabase
    .from("classes")
    .select("name")
    .eq("id", classId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const { error } = await supabase.from("classes").delete().eq("id", classId);
  if (error) throw new Error(error.message);
  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "class.deleted",
    entity_type: "class",
    entity_id: classId,
    details: { name: cls.name },
  });
}
