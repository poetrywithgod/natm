import { supabase } from "../../lib/supabase";
import { classLevelRank } from "../classes/api";

const PARENT_PHOTO_BUCKET = "parent-photos";
const SIGNED_URL_TTL_SECONDS = 3600;

export interface LinkedParent {
  id: string;
  full_name: string;
  relationship: string | null;
}

export interface ParentChild {
  student_id: string;
  student_name: string;
  unique_student_id: string | null;
  class_id: string | null;
  class_name: string | null;
  relationship: string | null;
}

export interface ParentProfile {
  id: string;
  full_name: string;
  photo_url: string | null;
  phone: string | null;
  address: string | null;
  children: ParentChild[];
}

export interface ParentListItem {
  id: string;
  full_name: string;
  photo_url: string | null;
  children: ParentChild[];
}

export interface ParentClassGroup {
  classId: string;
  className: string;
  parents: ParentListItem[];
}

interface LinkedStudentRow {
  id: string;
  full_name: string;
  unique_student_id: string | null;
  class_id: string | null;
  school_id: string;
  classes: { id: string; name: string; level: string | null } | { id: string; name: string; level: string | null }[] | null;
}

function firstOf<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : (value ?? undefined);
}

// Every parent/guardian in the school, grouped by their child's class in
// class-level progression order (Creche -> SS3); a parent with children in
// more than one class appears once per relevant class group. Children with
// no class yet are grouped under "No Class (Pending Assessment)" at the end.
export async function fetchParentsGroupedByClass(schoolId: string): Promise<ParentClassGroup[]> {
  const { data, error } = await supabase
    .from("parent_student_links")
    .select(
      "relationship, profiles(id, full_name, photo_url), students!inner(id, full_name, unique_student_id, class_id, school_id, classes(id, name, level))"
    )
    .eq("students.school_id", schoolId);
  if (error) throw new Error(error.message);

  const groupOrder: string[] = [];
  const groups = new Map<string, { className: string; level: string | null; parents: Map<string, ParentListItem> }>();

  for (const row of (data ?? []) as {
    relationship: string | null;
    profiles: { id: string; full_name: string; photo_url: string | null } | { id: string; full_name: string; photo_url: string | null }[] | null;
    students: LinkedStudentRow | LinkedStudentRow[] | null;
  }[]) {
    const parent = firstOf(row.profiles);
    const student = firstOf(row.students);
    if (!parent || !student) continue;
    const cls = firstOf(student.classes);
    const classKey = cls?.id ?? "unassigned";
    const className = cls?.name ?? "No Class (Pending Assessment)";

    let group = groups.get(classKey);
    if (!group) {
      group = { className, level: cls?.level ?? null, parents: new Map() };
      groups.set(classKey, group);
      groupOrder.push(classKey);
    }

    let parentItem = group.parents.get(parent.id);
    if (!parentItem) {
      parentItem = { id: parent.id, full_name: parent.full_name, photo_url: parent.photo_url, children: [] };
      group.parents.set(parent.id, parentItem);
    }
    parentItem.children.push({
      student_id: student.id,
      student_name: student.full_name,
      unique_student_id: student.unique_student_id,
      class_id: student.class_id,
      class_name: cls?.name ?? null,
      relationship: row.relationship,
    });
  }

  const result: (ParentClassGroup & { level: string | null })[] = groupOrder.map((classId) => {
    const g = groups.get(classId)!;
    return {
      classId,
      className: g.className,
      level: g.level,
      parents: Array.from(g.parents.values()).sort((a, b) => a.full_name.localeCompare(b.full_name)),
    };
  });

  result.sort((a, b) => classLevelRank(a.level) - classLevelRank(b.level) || a.className.localeCompare(b.className));

  return result.map(({ classId, className, parents }) => ({ classId, className, parents }));
}

// Single parent's full profile + every child linked to them at this school
// (scoped via students.school_id so a stray/guessed id from another school
// can't be viewed here), for the Parent Profile detail page.
export async function fetchParentProfile(parentId: string, schoolId: string): Promise<ParentProfile | null> {
  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, photo_url, phone, address")
    .eq("id", parentId)
    .eq("role", "parent")
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);
  if (!profileRow) return null;

  const { data: linkRows, error: linkError } = await supabase
    .from("parent_student_links")
    .select(
      "relationship, students!inner(id, full_name, unique_student_id, class_id, school_id, classes(id, name, level))"
    )
    .eq("parent_id", parentId)
    .eq("students.school_id", schoolId);
  if (linkError) throw new Error(linkError.message);

  const children: ParentChild[] = ((linkRows ?? []) as { relationship: string | null; students: LinkedStudentRow | LinkedStudentRow[] | null }[])
    .map((row) => {
      const student = firstOf(row.students);
      if (!student) return null;
      const cls = firstOf(student.classes);
      return {
        student_id: student.id,
        student_name: student.full_name,
        unique_student_id: student.unique_student_id,
        class_id: student.class_id,
        class_name: cls?.name ?? null,
        relationship: row.relationship,
      };
    })
    .filter((c): c is ParentChild => c !== null)
    .sort((a, b) => a.student_name.localeCompare(b.student_name));

  return { ...profileRow, children };
}

export async function getSignedParentPhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(PARENT_PHOTO_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data.signedUrl;
}

export interface CreateParentAccountResult {
  id: string;
  email: string;
  linked_student_name: string;
  outcome: "created" | "linked_existing" | "already_linked";
  temporary_password?: string;
  password_email_sent?: boolean;
}

export async function fetchLinkedParents(studentId: string): Promise<LinkedParent[]> {
  const { data, error } = await supabase
    .from("parent_student_links")
    .select("relationship, profiles(id, full_name)")
    .eq("student_id", studentId);
  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => {
      const parent = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return parent ? { id: parent.id, full_name: parent.full_name, relationship: row.relationship } : null;
    })
    .filter((p): p is LinkedParent => p !== null);
}

// supabase.functions.invoke() doesn't surface an Edge Function's actual JSON
// error body on a non-2xx status -- the real message lives in error.context,
// the raw Response, and has to be read out separately. Same fix as
// generateRecommendation in features/assessments/api.ts.
async function extractFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: Response })?.context;
  if (context && typeof context.json === "function") {
    try {
      const body = await context.clone().json();
      if (typeof body?.error === "string") return body.error;
    } catch {
      try {
        const text = await context.clone().text();
        if (text) return text;
      } catch {
        // fall through to fallback
      }
    }
  }
  return (error as { message?: string })?.message ?? fallback;
}

// Creates a full auth account (auto-generated password) + profile
// (role: parent) + a parent_student_links row, all via the create-parent
// Edge Function (needs the service_role key server-side, and its own audit
// log entry covers this action -- no separate client-side logging needed).
export async function createParentAccount(
  email: string,
  fullName: string,
  studentId: string,
  relationship?: string
): Promise<CreateParentAccountResult> {
  const { data, error } = await supabase.functions.invoke("create-parent", {
    body: { email, full_name: fullName, student_id: studentId, relationship },
  });
  if (error) throw new Error(await extractFunctionErrorMessage(error, "Failed to create parent account."));
  if (data?.error) throw new Error(data.error);
  return data as CreateParentAccountResult;
}
