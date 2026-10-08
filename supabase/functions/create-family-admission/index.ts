import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateTemporaryPassword } from "../_shared/temporaryPassword.ts";

// Admits a child TOGETHER with the guardian who owns the family login.
//
//  * New guardian email  -> one parent-role auth account (random temporary
//    password, forced reset on first login), the child (no student login),
//    and the parent_student_links row.
//  * Guardian email already belongs to a parent at this school (sibling) ->
//    the child is added and linked to that existing family account; nothing
//    about the account or its password changes.
//
// Any failure part-way rolls back everything this call created.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function isEmailAlreadyRegisteredError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "email_exists") return true;
  return (error.message ?? "").toLowerCase().includes("already been registered");
}

async function findAuthUserByEmail(adminClient: SupabaseClient, email: string) {
  const perPage = 1000;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < perPage) break;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond(401, { error: "Missing authorization" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) return respond(401, { error: "Invalid session" });

    const { data: callerProfile, error: profileError } = await callerClient
      .from("profiles")
      .select("role, school_id")
      .eq("id", user.id)
      .single();
    if (profileError || !callerProfile || callerProfile.role !== "school_admin") {
      return respond(403, { error: "Forbidden — school_admin only" });
    }

    const body = await req.json();
    const child = (body.child ?? {}) as { full_name?: string; class_id?: string | null };
    const guardian = (body.guardian ?? {}) as {
      email?: string;
      full_name?: string;
      relationship?: string;
      phone?: string;
      address?: string;
    };

    const childName = child.full_name?.trim();
    const guardianName = guardian.full_name?.trim();
    const relationship = guardian.relationship?.trim();
    const email = guardian.email?.trim().toLowerCase();
    if (!childName) return respond(400, { error: "The child's full name is required." });
    if (!guardianName || !relationship || !email) {
      return respond(400, { error: "A guardian is required: name, relationship and email." });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return respond(400, { error: "Enter a valid guardian email address." });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const schoolId = callerProfile.school_id as string;

    // Everything this call creates, so a failure can undo exactly that.
    const created = { authUserId: null as string | null, profileId: null as string | null, studentId: null as string | null };
    async function rollback() {
      if (created.studentId) await adminClient.from("students").delete().eq("id", created.studentId);
      if (created.profileId) await adminClient.from("profiles").delete().eq("id", created.profileId);
      if (created.authUserId) await adminClient.auth.admin.deleteUser(created.authUserId);
    }
    async function fail(status: number, message: string) {
      await rollback();
      return respond(status, { error: message });
    }

    // Optional class must belong to this school.
    if (child.class_id) {
      const { data: cls } = await adminClient.from("classes").select("id, school_id").eq("id", child.class_id).maybeSingle();
      if (!cls || cls.school_id !== schoolId) return respond(400, { error: "That class doesn't belong to this school." });
    }

    // ---------- Decide which guardian account this family uses ----------
    let parentId: string | null = null;
    let temporaryPassword: string | null = null;
    let outcome: "created" | "linked_existing" = "created";

    const password = generateTemporaryPassword();
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (!createError && newUser?.user) {
      created.authUserId = newUser.user.id;
      const { error: parentProfileError } = await adminClient.from("profiles").insert({
        id: newUser.user.id,
        school_id: schoolId,
        role: "parent",
        full_name: guardianName,
        phone: guardian.phone?.trim() || null,
        address: guardian.address?.trim() || null,
        must_change_password: true,
      });
      if (parentProfileError) return fail(400, parentProfileError.message);
      created.profileId = newUser.user.id;
      parentId = newUser.user.id;
      temporaryPassword = password;
    } else if (isEmailAlreadyRegisteredError(createError)) {
      const existing = await findAuthUserByEmail(adminClient, email);
      if (!existing) return respond(400, { error: createError?.message ?? "Account creation failed" });

      const { data: existingProfile, error: lookupError } = await adminClient
        .from("profiles")
        .select("id, role, school_id")
        .eq("id", existing.id)
        .maybeSingle();
      if (lookupError) return respond(400, { error: lookupError.message });

      if (existingProfile) {
        if (existingProfile.role === "student") {
          return respond(400, {
            error:
              "This email belongs to an existing student login. Convert that family to a shared family login first, then add the new child.",
          });
        }
        if (existingProfile.role !== "parent") {
          return respond(400, { error: "This email is already registered as a different type of account." });
        }
        if (existingProfile.school_id !== schoolId) {
          return respond(400, { error: "This email is already registered as a parent at a different school." });
        }
        parentId = existingProfile.id; // sibling: reuse, leave the account untouched
        outcome = "linked_existing";
      } else {
        // Auth user left behind by an earlier failed attempt (no profile): finish it.
        const { error: pwError } = await adminClient.auth.admin.updateUserById(existing.id, { password });
        if (pwError) return respond(400, { error: pwError.message });
        const { error: recoverError } = await adminClient.from("profiles").insert({
          id: existing.id,
          school_id: schoolId,
          role: "parent",
          full_name: guardianName,
          phone: guardian.phone?.trim() || null,
          address: guardian.address?.trim() || null,
          must_change_password: true,
        });
        if (recoverError) return respond(400, { error: recoverError.message });
        created.profileId = existing.id; // rollback removes the profile but keeps the pre-existing auth user
        parentId = existing.id;
        temporaryPassword = password;
      }
    } else {
      return respond(400, { error: createError?.message ?? "Account creation failed" });
    }

    // ---------- Same guardian re-adding the same child name? ----------
    if (outcome === "linked_existing" && parentId) {
      const { data: links } = await adminClient
        .from("parent_student_links")
        .select("students(full_name)")
        .eq("parent_id", parentId);
      const dup = (links ?? []).some((l: { students: { full_name: string } | { full_name: string }[] | null }) => {
        const s = Array.isArray(l.students) ? l.students[0] : l.students;
        return s?.full_name?.trim().toLowerCase() === childName.toLowerCase();
      });
      if (dup) return respond(400, { error: `${childName} is already enrolled under this guardian's email.` });
    }

    // ---------- The child (no student login) + the link ----------
    // Onboarding starts at the intake form: the guardian sets their own
    // password on the parent side, so the child-level password step is skipped.
    const { data: student, error: studentError } = await adminClient
      .from("students")
      .insert({
        school_id: schoolId,
        class_id: child.class_id ?? null,
        profile_id: null,
        full_name: childName,
        onboarding_status: "pending_intake_form",
      })
      .select("id, unique_student_id")
      .single();
    if (studentError || !student) return fail(400, studentError?.message ?? "Student record creation failed");
    created.studentId = student.id;

    const { error: linkError } = await adminClient
      .from("parent_student_links")
      .insert({ parent_id: parentId, student_id: student.id, relationship });
    if (linkError) return fail(400, linkError.message);

    // ---------- Audit (best effort) ----------
    await adminClient.from("audit_logs").insert({
      school_id: schoolId,
      actor_id: user.id,
      action: "student.created",
      entity_type: "student",
      entity_id: student.id,
      details: {
        full_name: childName,
        unique_student_id: student.unique_student_id,
        guardian_email: email,
        guardian_outcome: outcome,
        via: "family_admission",
      },
    });
    if (outcome === "created") {
      await adminClient.from("audit_logs").insert({
        school_id: schoolId,
        actor_id: user.id,
        action: "parent.created",
        entity_type: "profile",
        entity_id: parentId,
        details: { full_name: guardianName, email, linked_student_id: student.id, outcome: "created" },
      });
    }

    // ---------- Recovery email so the guardian sets their own password ----------
    let passwordEmailSent = false;
    if (outcome === "created") {
      const appUrl = (Deno.env.get("STUDENT_PARENT_APP_URL") ?? "https://natm-student-parent.vercel.app").replace(/\/$/, "");
      const { error: resetError } = await adminClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${appUrl}/reset-password`,
      });
      if (resetError) console.error("Failed to send guardian password-recovery email:", resetError.message);
      passwordEmailSent = !resetError;
    }

    return respond(200, {
      success: true,
      outcome,
      student_id: student.id,
      unique_student_id: student.unique_student_id,
      parent_id: parentId,
      guardian_email: email,
      temporary_password: temporaryPassword, // null when an existing family account was reused
      password_email_sent: passwordEmailSent,
    });
  } catch (e) {
    return respond(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
