import { supabase } from "../../lib/supabase";

const PARENT_PHOTO_BUCKET = "parent-photos";
const SIGNED_URL_TTL_SECONDS = 3600;

export interface OwnParentProfile {
  id: string;
  full_name: string;
  photo_url: string | null;
  phone: string | null;
  address: string | null;
}

export async function fetchOwnParentProfile(profileId: string): Promise<OwnParentProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, photo_url, phone, address")
    .eq("id", profileId)
    .single();
  if (error) return null;
  return data as OwnParentProfile;
}

export async function updateOwnName(profileId: string, fullName: string): Promise<void> {
  const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", profileId);
  if (error) throw new Error(error.message);
}

export interface ParentContactDetails {
  phone: string;
  address: string;
}

export async function updateOwnContactDetails(profileId: string, details: ParentContactDetails): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ phone: details.phone || null, address: details.address || null })
    .eq("id", profileId);
  if (error) throw new Error(error.message);
}

export async function uploadOwnParentPhoto(profileId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${profileId}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(PARENT_PHOTO_BUCKET)
    .upload(path, file, { upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { error: updateError } = await supabase.from("profiles").update({ photo_url: path }).eq("id", profileId);
  if (updateError) throw new Error(updateError.message);

  return path;
}

export async function getSignedParentPhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(PARENT_PHOTO_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data.signedUrl;
}

export interface LinkedChildLite {
  link_id: string;
  student_id: string;
  full_name: string;
  relationship: string | null;
}

export async function fetchLinkedChildrenWithRelationship(parentId: string): Promise<LinkedChildLite[]> {
  const { data, error } = await supabase
    .from("parent_student_links")
    .select("id, relationship, students(id, full_name)")
    .eq("parent_id", parentId);
  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => {
      const student = Array.isArray(row.students) ? row.students[0] : row.students;
      return student
        ? { link_id: row.id, student_id: student.id, full_name: student.full_name, relationship: row.relationship }
        : null;
    })
    .filter((c): c is LinkedChildLite => c !== null);
}

export async function updateRelationship(linkId: string, relationship: string): Promise<void> {
  const { error } = await supabase
    .from("parent_student_links")
    .update({ relationship: relationship || null })
    .eq("id", linkId);
  if (error) throw new Error(error.message);
}

export class IncorrectPasswordError extends Error {}

// Same pattern as changeOwnPassword in the Student and Staff profile
// APIs: re-authenticate with the current password first (updateUser alone
// doesn't verify it), then update.
export async function changeOwnPassword(
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
  if (verifyError) throw new IncorrectPasswordError("Current password is incorrect.");

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}
