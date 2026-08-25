import { supabase } from "../../lib/supabase";

export interface LinkedParent {
  id: string;
  full_name: string;
}

export interface CreateParentAccountResult {
  email: string;
  temporary_password: string;
  linked_student_name: string;
}

export async function fetchLinkedParents(studentId: string): Promise<LinkedParent[]> {
  const { data, error } = await supabase
    .from("parent_student_links")
    .select("profiles(id, full_name)")
    .eq("student_id", studentId);
  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => {
      const parent = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return parent ? { id: parent.id, full_name: parent.full_name } : null;
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
  studentId: string
): Promise<CreateParentAccountResult> {
  const { data, error } = await supabase.functions.invoke("create-parent", {
    body: { email, full_name: fullName, student_id: studentId },
  });
  if (error) throw new Error(await extractFunctionErrorMessage(error, "Failed to create parent account."));
  if (data?.error) throw new Error(data.error);
  return data as CreateParentAccountResult;
}
