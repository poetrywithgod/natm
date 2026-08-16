import { supabase } from "../../lib/supabase";

const STUDENT_PHOTO_BUCKET = "student-photos";
const SIGNED_URL_TTL_SECONDS = 3600;

export interface StudentRecord {
  id: string;
  class_id: string | null;
  full_name: string;
  unique_student_id: string;
  photo_url: string | null;
}

export async function fetchOwnStudentRecord(profileId: string): Promise<StudentRecord | null> {
  const { data, error } = await supabase
    .from("students")
    .select("id, class_id, full_name, unique_student_id, photo_url")
    .eq("profile_id", profileId)
    .single();
  if (error) return null;
  return data as StudentRecord;
}

export async function getSignedStudentPhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(STUDENT_PHOTO_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data.signedUrl;
}
