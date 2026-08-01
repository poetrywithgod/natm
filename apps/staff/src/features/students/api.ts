import { supabase } from "../../lib/supabase";

export interface Student {
  id: string;
  school_id: string;
  class_id: string | null;
  full_name: string;
  unique_student_id: string;
  photo_url: string | null; // storage path, not a public URL — bucket is private
  created_at: string;
}

export interface ClassOption {
  id: string;
  name: string;
}

const PHOTO_BUCKET = "student-photos";
const SIGNED_URL_TTL_SECONDS = 3600;

export async function fetchStudents(schoolId: string): Promise<Student[]> {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("school_id", schoolId)
    .order("full_name", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchClassOptions(schoolId: string): Promise<ClassOption[]> {
  const { data, error } = await supabase
    .from("classes")
    .select("id, name")
    .eq("school_id", schoolId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

// unique_student_id is auto-generated server-side by a trigger (per-school
// atomic counter) — the app never supplies it.
export async function createStudent(
  schoolId: string,
  fullName: string,
  classId: string | null
): Promise<Student> {
  const { data, error } = await supabase
    .from("students")
    .insert({
      school_id: schoolId,
      full_name: fullName,
      class_id: classId,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function assignStudentClass(studentId: string, classId: string | null): Promise<void> {
  const { error } = await supabase.from("students").update({ class_id: classId }).eq("id", studentId);
  if (error) throw new Error(error.message);
}

export async function renameStudent(studentId: string, fullName: string): Promise<void> {
  const { error } = await supabase.from("students").update({ full_name: fullName }).eq("id", studentId);
  if (error) throw new Error(error.message);
}

export async function uploadStudentPhoto(
  schoolId: string,
  studentId: string,
  file: File
): Promise<void> {
  const path = `${schoolId}/${studentId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
    upsert: true,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { error: updateError } = await supabase
    .from("students")
    .update({ photo_url: path })
    .eq("id", studentId);
  if (updateError) throw new Error(updateError.message);
}

export async function getSignedPhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data.signedUrl;
}
