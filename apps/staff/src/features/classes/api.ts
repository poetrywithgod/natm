import { supabase } from "../../lib/supabase";

export interface SchoolClass {
  id: string;
  school_id: string;
  name: string;
  class_teacher_id: string | null;
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
    .order("full_name", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function createClass(schoolId: string, name: string): Promise<SchoolClass> {
  const { data, error } = await supabase
    .from("classes")
    .insert({ school_id: schoolId, name })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// null clears the assignment (class_teacher_id references profiles with on delete set null,
// so this mirrors that same "unassigned" state deliberately).
export async function assignClassTeacher(classId: string, teacherId: string | null): Promise<void> {
  const { error } = await supabase
    .from("classes")
    .update({ class_teacher_id: teacherId })
    .eq("id", classId);
  if (error) throw new Error(error.message);
}

export async function renameClass(classId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from("classes")
    .update({ name })
    .eq("id", classId);
  if (error) throw new Error(error.message);
}
