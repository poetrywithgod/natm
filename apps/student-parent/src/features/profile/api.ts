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
  class_name: string | null;
  full_name: string;
  unique_student_id: string | null;
  photo_url: string | null;
  onboarding_status: OnboardingStatus;
}

export async function fetchOwnStudentRecord(profileId: string): Promise<StudentRecord | null> {
  const { data, error } = await supabase
    .from("students")
    .select("id, class_id, full_name, unique_student_id, photo_url, onboarding_status, classes(name)")
    .eq("profile_id", profileId)
    .single();
  if (error) return null;

  const classInfo = Array.isArray(data.classes) ? data.classes[0] : data.classes;
  return {
    id: data.id,
    class_id: data.class_id,
    class_name: classInfo?.name ?? null,
    full_name: data.full_name,
    unique_student_id: data.unique_student_id,
    photo_url: data.photo_url,
    onboarding_status: data.onboarding_status,
  };
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

export async function uploadOwnStudentPhoto(studentId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${studentId}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(STUDENT_PHOTO_BUCKET)
    .upload(path, file, { upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { error: updateError } = await supabase
    .from("students")
    .update({ photo_url: path })
    .eq("id", studentId);
  if (updateError) throw new Error(updateError.message);

  return path;
}

export class IncorrectPasswordError extends Error {}

// Supabase's updateUser doesn't verify the caller's current password on its
// own -- re-authenticate first to prove they know it, matching the
// change-password UX standard (old password + new password). Same pattern
// as changeOwnPassword in the Staff app's features/profile/api.ts.
export async function changeOwnPassword(
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (verifyError) throw new IncorrectPasswordError("Current password is incorrect.");

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}
