import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function isDuplicateKeyError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "23505" || (error.message ?? "").toLowerCase().includes("duplicate key");
}

function isEmailAlreadyRegisteredError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "email_exists") return true;
  return (error.message ?? "").toLowerCase().includes("already been registered");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile, error: profileError } = await callerClient
      .from("profiles")
      .select("role, school_id")
      .eq("id", user.id)
      .single();

    if (profileError || !callerProfile || callerProfile.role !== "school_admin") {
      return new Response(JSON.stringify({ error: "Forbidden — school_admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { email, full_name, class_id } = body as {
      email?: string;
      full_name?: string;
      class_id?: string | null;
    };

    // class_id is intentionally optional at admission -- the child's
    // class/level is determined later, once the AI-assisted assessment
    // pipeline (intake form + on-site observation) suggests subjects and
    // level, and the school admin approves. Admission just needs identity.
    if (!email || !full_name) {
      return new Response(JSON.stringify({ error: "email and full_name are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

    async function insertStudentRow(profileId: string) {
      // unique_student_id is auto-generated server-side by a trigger
      // (per-school atomic counter) -- we never supply it, matching the
      // existing createStudent() pattern in features/students/api.ts.
      return adminClient
        .from("students")
        .insert({
          school_id: callerProfile.school_id,
          class_id: class_id ?? null,
          profile_id: profileId,
          full_name,
        })
        .select("id, unique_student_id")
        .single();
    }

    async function logCreated(profileId: string, uniqueStudentId: string, outcome: string) {
      await adminClient.from("audit_logs").insert({
        school_id: callerProfile.school_id,
        actor_id: user.id,
        action: "student.created",
        entity_type: "student",
        entity_id: profileId,
        details: { full_name, email, unique_student_id: uniqueStudentId, outcome },
      });
    }

    const temporaryPassword = generatePassword();
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
    });

    if (createError || !created.user) {
      if (!isEmailAlreadyRegisteredError(createError)) {
        return new Response(JSON.stringify({ error: createError?.message ?? "Account creation failed" }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      // ---------- Email already has an auth account somewhere in the system ----------
      // Unlike parents (who legitimately have multiple children), a student
      // account is 1:1 -- so "already registered" here means either a
      // genuine duplicate admission attempt, or an auth user orphaned by an
      // earlier attempt that failed partway through (no rollback existed
      // before this fix). Tell them apart by what's actually in `profiles`.
      let existingUser;
      {
        const perPage = 1000;
        existingUser = null as null | { id: string; email?: string };
        for (let page = 1; page <= 20; page++) {
          const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
          if (error) throw new Error(error.message);
          const match = data.users.find((u) => u.email?.toLowerCase() === email.trim().toLowerCase());
          if (match) {
            existingUser = match;
            break;
          }
          if (data.users.length < perPage) break;
        }
      }
      if (!existingUser) {
        return new Response(JSON.stringify({ error: createError!.message }), { status: 400, headers: jsonHeaders });
      }

      const { data: existingProfile, error: existingProfileError } = await adminClient
        .from("profiles")
        .select("id, role, school_id, full_name")
        .eq("id", existingUser.id)
        .maybeSingle();
      if (existingProfileError) {
        return new Response(JSON.stringify({ error: existingProfileError.message }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      if (existingProfile) {
        // A complete profile already exists for this email -- check whether
        // it's actually a finished student enrollment (genuine duplicate)
        // or a profile orphaned before the `students` row was ever created.
        if (existingProfile.role !== "student") {
          return new Response(
            JSON.stringify({ error: "This email is already registered as a different type of account." }),
            { status: 400, headers: jsonHeaders }
          );
        }
        const { data: existingStudentRow } = await adminClient
          .from("students")
          .select("id, unique_student_id, school_id")
          .eq("profile_id", existingProfile.id)
          .maybeSingle();
        if (existingStudentRow) {
          return new Response(
            JSON.stringify({
              error:
                existingStudentRow.school_id === callerProfile.school_id
                  ? `A student with this email is already enrolled (${existingStudentRow.unique_student_id}).`
                  : "This email is already registered as a student at a different school.",
            }),
            { status: 400, headers: jsonHeaders }
          );
        }
        // Profile exists but the students row never got created -- this
        // account was never actually usable (no student record = nothing
        // to log into meaningfully), so finish it properly: fresh password
        // included, same as a normal new creation.
        const { error: recoverPasswordError2 } = await adminClient.auth.admin.updateUserById(existingProfile.id, {
          password: temporaryPassword,
        });
        if (recoverPasswordError2) {
          return new Response(JSON.stringify({ error: recoverPasswordError2.message }), {
            status: 400,
            headers: jsonHeaders,
          });
        }
        const { data: studentRow, error: studentInsertError } = await insertStudentRow(existingProfile.id);
        if (studentInsertError || !studentRow) {
          return new Response(
            JSON.stringify({ error: studentInsertError?.message ?? "Student record creation failed" }),
            { status: 400, headers: jsonHeaders }
          );
        }
        await logCreated(existingProfile.id, studentRow.unique_student_id, "recovered_orphaned_profile");
        return new Response(
          JSON.stringify({
            success: true,
            id: existingProfile.id,
            email,
            temporary_password: temporaryPassword,
            unique_student_id: studentRow.unique_student_id,
            outcome: "created",
          }),
          { status: 200, headers: jsonHeaders }
        );
      }

      // Orphaned auth user with no profile at all -- finish setup from
      // scratch, including a fresh password (whatever was generated on the
      // failed attempt was never delivered to anyone).
      const { error: recoverPasswordError } = await adminClient.auth.admin.updateUserById(existingUser.id, {
        password: temporaryPassword,
      });
      if (recoverPasswordError) {
        return new Response(JSON.stringify({ error: recoverPasswordError.message }), {
          status: 400,
          headers: jsonHeaders,
        });
      }
      const { error: recoverProfileError } = await adminClient.from("profiles").insert({
        id: existingUser.id,
        school_id: callerProfile.school_id,
        role: "student",
        full_name,
      });
      if (recoverProfileError) {
        return new Response(JSON.stringify({ error: recoverProfileError.message }), {
          status: 400,
          headers: jsonHeaders,
        });
      }
      const { data: studentRow, error: studentInsertError } = await insertStudentRow(existingUser.id);
      if (studentInsertError || !studentRow) {
        await adminClient.from("profiles").delete().eq("id", existingUser.id);
        return new Response(
          JSON.stringify({ error: studentInsertError?.message ?? "Student record creation failed" }),
          { status: 400, headers: jsonHeaders }
        );
      }
      await logCreated(existingUser.id, studentRow.unique_student_id, "recovered_orphaned_account");
      return new Response(
        JSON.stringify({
          success: true,
          id: existingUser.id,
          email,
          temporary_password: temporaryPassword,
          unique_student_id: studentRow.unique_student_id,
          outcome: "created",
        }),
        { status: 200, headers: jsonHeaders }
      );
    }

    // ---------- Brand-new account: roll back the auth user (and profile,
    // if that got created) on either later failure, so a retry with the
    // same email isn't permanently stuck the way this used to leave things. ----------
    const { error: profileInsertError } = await adminClient.from("profiles").insert({
      id: created.user.id,
      school_id: callerProfile.school_id,
      role: "student",
      full_name,
    });
    if (profileInsertError) {
      if (!isDuplicateKeyError(profileInsertError)) {
        await adminClient.auth.admin.deleteUser(created.user.id);
      }
      return new Response(JSON.stringify({ error: profileInsertError.message }), { status: 400, headers: jsonHeaders });
    }

    const { data: studentRow, error: studentInsertError } = await insertStudentRow(created.user.id);
    if (studentInsertError || !studentRow) {
      await adminClient.from("profiles").delete().eq("id", created.user.id);
      await adminClient.auth.admin.deleteUser(created.user.id);
      return new Response(
        JSON.stringify({ error: studentInsertError?.message ?? "Student record creation failed" }),
        { status: 400, headers: jsonHeaders }
      );
    }
    const uniqueStudentId = studentRow.unique_student_id;

    await logCreated(created.user.id, uniqueStudentId, "created");

    return new Response(
      JSON.stringify({
        success: true,
        id: created.user.id,
        email,
        temporary_password: temporaryPassword,
        unique_student_id: uniqueStudentId,
        outcome: "created",
      }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
