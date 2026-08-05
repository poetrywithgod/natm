import { supabase } from "../../lib/supabase";
import { logAuditEvent } from "../audit/api";

const PHOTO_BUCKET = "staff-photos";
const SIGNED_URL_TTL_SECONDS = 3600;

// Storage object keys reject many punctuation characters (e.g. "~"), which
// commonly appear in phone/camera/WhatsApp-downloaded file names. Strip
// anything unsafe before building the upload path.
function sanitizeFileName(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  const base = dotIndex > 0 ? name.slice(0, dotIndex) : name;
  const ext = dotIndex > 0 ? name.slice(dotIndex) : "";
  const safeBase = base.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, "");
  return `${safeBase}${safeExt}`;
}

export async function fetchSchoolName(schoolId: string): Promise<string | null> {
  const { data, error } = await supabase.from("schools").select("name").eq("id", schoolId).single();
  if (error) return null;
  return data.name;
}

export async function updateOwnName(
  profileId: string,
  fullName: string,
  schoolId: string | null,
  actorId: string
): Promise<void> {
  const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", profileId);
  if (error) throw new Error(error.message);
  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "profile.name_updated",
    entity_type: "profile",
    entity_id: profileId,
    details: { full_name: fullName },
  });
}

export async function uploadOwnPhoto(
  schoolId: string | null,
  profileId: string,
  file: File,
  actorId: string
): Promise<string> {
  const path = `${profileId}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
    upsert: true,
  });
  if (uploadError) throw new Error(uploadError.message);
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ photo_url: path })
    .eq("id", profileId);
  if (updateError) throw new Error(updateError.message);
  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "profile.photo_updated",
    entity_type: "profile",
    entity_id: profileId,
  });
  return path;
}

export async function getSignedPhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data.signedUrl;
}

export class IncorrectPasswordError extends Error {}

export async function changeOwnPassword(
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  // Supabase's updateUser doesn't verify the caller's current password on
  // its own - re-authenticate first to prove they know it, matching the
  // change-password UX standard (old password + new password).
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (verifyError) throw new IncorrectPasswordError("Current password is incorrect.");

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}
