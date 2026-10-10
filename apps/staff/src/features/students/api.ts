import { supabase } from "../../lib/supabase";
import { logAuditEvent } from "../audit/api";

export interface Student {
  id: string;
  school_id: string;
  class_id: string | null;
  full_name: string;
  unique_student_id: string | null;
  photo_url: string | null; // storage path, not a public URL — bucket is private
  profile_id: string | null; // the student's own login (shared with the family), if any
  created_at: string;
  phone: string | null; // student-editable, from Student Settings > Profile
  address: string | null; // student-editable, from Student Settings > Profile
  bio: string | null; // student-editable, from Student Settings > Profile
  emergency_contact_name: string | null; // student-editable, from Student Settings > Profile
  emergency_contact_phone: string | null; // student-editable, from Student Settings > Profile
  emergency_contact_phone_alt: string | null; // student-editable, from Student Settings > Profile
}

export interface ClassOption {
  id: string;
  name: string;
  level: string | null;
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

export async function fetchStudentById(studentId: string): Promise<Student | null> {
  const { data, error } = await supabase.from("students").select("*").eq("id", studentId).single();
  if (error) return null;
  return data;
}

export async function fetchClassOptions(schoolId: string): Promise<ClassOption[]> {
  const { data, error } = await supabase
    .from("classes")
    .select("id, name, level")
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
  classId: string | null,
  actorId: string
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
  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "student.created",
    entity_type: "student",
    entity_id: data.id,
    details: { full_name: fullName, class_id: classId },
  });
  return data;
}

export async function assignStudentClass(
  studentId: string,
  classId: string | null,
  schoolId: string,
  actorId: string
): Promise<void> {
  const { error } = await supabase.from("students").update({ class_id: classId }).eq("id", studentId);
  if (error) throw new Error(error.message);
  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "student.class_assigned",
    entity_type: "student",
    entity_id: studentId,
    details: { class_id: classId },
  });
}

export async function renameStudent(
  studentId: string,
  fullName: string,
  schoolId: string,
  actorId: string
): Promise<void> {
  const { error } = await supabase.from("students").update({ full_name: fullName }).eq("id", studentId);
  if (error) throw new Error(error.message);
  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "student.renamed",
    entity_type: "student",
    entity_id: studentId,
    details: { full_name: fullName },
  });
}

export async function uploadStudentPhoto(
  schoolId: string,
  studentId: string,
  file: File,
  actorId: string
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
  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "student.photo_uploaded",
    entity_type: "student",
    entity_id: studentId,
  });
}

export async function getSignedPhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data.signedUrl;
}

export interface CreateStudentAccountResult {
  id: string;
  email: string;
  temporary_password: string;
  unique_student_id: string;
}

// Creates a full auth account (auto-generated password) + profile +
// student record in one call, via the create-student Edge Function
// (needs the service_role key server-side, which the client never has).
export async function createStudentAccount(
  email: string,
  fullName: string,
  classId: string | null
): Promise<CreateStudentAccountResult> {
  const { data, error } = await supabase.functions.invoke("create-student", {
    body: { email, full_name: fullName, class_id: classId },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as CreateStudentAccountResult;
}

export interface StudentGuardian {
  parent_id: string;
  full_name: string;
  relationship: string | null;
  phone: string | null;
  address: string | null;
  photo_url: string | null;
  email: string | null;
}

// Guardian details for one student. Server-enforced: the RPC only returns
// rows for the school admin, the child's class teacher, or an active shadow
// teacher assigned to the child.
export async function fetchStudentGuardians(studentId: string): Promise<StudentGuardian[]> {
  // The generated DB types predate this RPC, so the call is loosely typed.
  const rpc = supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: StudentGuardian[] | null; error: { message: string } | null }>;
  const { data, error } = await rpc.call(supabase, "get_student_guardians", { target_student_id: studentId });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface FamilyAdmissionInput {
  child: { full_name: string; class_id: string | null };
  guardian: {
    email: string;
    full_name: string;
    relationship: string;
    phone?: string;
    address?: string;
  };
}

export interface FamilyAdmissionResult {
  success: boolean;
  outcome: "created" | "linked_existing";
  student_id: string;
  unique_student_id: string;
  parent_id: string;
  guardian_email: string;
  temporary_password: string | null; // null when an existing family account was reused (sibling)
  password_email_sent: boolean;
}

// Admits a child AND their guardian together (one shared family email) via
// the create-family-admission Edge Function.
export async function createFamilyAdmission(input: FamilyAdmissionInput): Promise<FamilyAdmissionResult> {
  const { data, error } = await supabase.functions.invoke("create-family-admission", { body: input });
  if (error) {
    // Edge Function errors carry the JSON body in error.context
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const body = await ctx.json();
        if (body?.error) throw new Error(body.error);
      } catch (e) {
        if (e instanceof Error && e.message !== "Unexpected end of JSON input") throw e;
      }
    }
    throw new Error(error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data as FamilyAdmissionResult;
}
