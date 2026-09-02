import { supabase } from "../../lib/supabase";

const PHOTO_BUCKET = "staff-photos";
const SIGNED_URL_TTL_SECONDS = 3600;

// Storage object keys reject many punctuation characters (e.g. "~"), which
// commonly appear in phone/camera-downloaded file names. Strip anything
// unsafe before building the upload path -- same helper as the staff app.
function sanitizeFileName(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  const base = dotIndex > 0 ? name.slice(0, dotIndex) : name;
  const ext = dotIndex > 0 ? name.slice(dotIndex) : "";
  const safeBase = base.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, "");
  return `${safeBase}${safeExt}`;
}

// Reuses the same staff-photos bucket as the staff app (its RLS is a
// blanket "any authenticated user" policy, not scoped by role or
// school_id, so a super_admin account can use it too -- see
// supabase/migrations/20260803010000_staff_photos_storage.sql). Super
// admins have no school_id, so there's no audit_logs entry here the way
// the staff app logs its own profile edits -- those entries are always
// school-scoped, and this account isn't attached to one.
export async function updateOwnName(profileId: string, fullName: string): Promise<void> {
  const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", profileId);
  if (error) throw new Error(error.message);
}

export async function uploadOwnPhoto(profileId: string, file: File): Promise<string> {
  const path = `${profileId}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
    upsert: true,
  });
  if (uploadError) throw new Error(uploadError.message);
  const { error: updateError } = await supabase.from("profiles").update({ photo_url: path }).eq("id", profileId);
  if (updateError) throw new Error(updateError.message);
  return path;
}

export async function getSignedPhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data.signedUrl;
}

export class IncorrectPasswordError extends Error {}

export async function changeOwnPassword(email: string, currentPassword: string, newPassword: string): Promise<void> {
  // Supabase's updateUser doesn't verify the caller's current password on
  // its own -- re-authenticate first to prove they know it, matching the
  // change-password UX standard (old password + new password), same
  // pattern as the staff app.
  const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
  if (verifyError) throw new IncorrectPasswordError("Current password is incorrect.");

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}
