import { supabase } from "../../lib/supabase";

const STUDENT_PHOTO_BUCKET = "student-photos";
const SIGNED_URL_TTL_SECONDS = 3600;

export type OnboardingStatus =
  | "pending_password_reset"
  | "pending_intake_form"
  | "pending_review"
  | "approved";

export interface StudentRecord {
  id: string;
  class_id: string | null;
  full_name: string;
  unique_student_id: string;
  photo_url: string | null;
  onboarding_status: OnboardingStatus;
}

export async function fetchOwnStudentRecord(profileId: string): Promise<StudentRecord | null> {
  const { data, error } = await supabase
    .from("students")
    .select("id, class_id, full_name, unique_student_id, photo_url, onboarding_status")
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

export async function advanceOnboardingStatus(
  studentId: string,
  status: OnboardingStatus
): Promise<void> {
  const { error } = await supabase
    .from("students")
    .update({ onboarding_status: status })
    .eq("id", studentId);
  if (error) throw new Error(error.message);
}
