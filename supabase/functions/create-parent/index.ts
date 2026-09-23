import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// GoTrue's admin API has no "get user by email" lookup, only paginated
// listUsers() -- so on the (rare) "already registered" path we page through
// looking for the match. Capped well above any realistic user count for
// this app today; if that cap is ever hit, this returns null and the caller
// surfaces the original "already registered" error rather than hanging.
async function findAuthUserByEmail(adminClient: SupabaseClient, email: string) {
  const target = email.trim().toLowerCase();
  const perPage = 1000;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const match = data.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match;
    if (data.users.length < perPage) break;
  }
  return null;
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
    const { email, full_name, student_id, relationship } = body as {
      email?: string;
      full_name?: string;
      student_id?: string;
      relationship?: string;
    };

    if (!email || !full_name || !student_id) {
      return new Response(
        JSON.stringify({ error: "email, full_name, and student_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Confirm the student belongs to the caller's school before linking --
    // otherwise a school_admin could link a parent to another school's child.
    const { data: studentRow, error: studentLookupError } = await adminClient
      .from("students")
      .select("id, school_id, full_name")
      .eq("id", student_id)
      .single();
    if (studentLookupError || !studentRow) {
      return new Response(JSON.stringify({ error: "Student not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (studentRow.school_id !== callerProfile.school_id) {
      return new Response(JSON.stringify({ error: "Forbidden — student belongs to a different school" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

    async function insertLink(parentId: string) {
      const { error } = await adminClient
        .from("parent_student_links")
        .insert({ parent_id: parentId, student_id: studentRow.id, relationship: relationship || null });
      if (error && !isDuplicateKeyError(error)) throw new Error(error.message);
      return { alreadyLinked: !!error };
    }

    async function logCreated(parentId: string, outcome: string) {
      await adminClient.from("audit_logs").insert({
        school_id: callerProfile.school_id,
        actor_id: user.id,
        action: "parent.created",
        entity_type: "profile",
        entity_id: parentId,
        details: {
          full_name,
          email,
          linked_student_id: studentRow.id,
          linked_student_name: studentRow.full_name,
          outcome,
        },
      });
    }

    // ---------- Try creating a brand-new account first ----------
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

      // ---------- Email already has an auth account: find it and reuse it ----------
      const existingUser = await findAuthUserByEmail(adminClient, email);
      if (!existingUser) {
        // Shouldn't happen (createUser just told us it's taken), but don't hang.
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
        // A real, complete account already exists for this email.
        if (existingProfile.role !== "parent") {
          return new Response(
            JSON.stringify({ error: "This email is already registered as a different type of account." }),
            { status: 400, headers: jsonHeaders }
          );
        }
        if (existingProfile.school_id !== callerProfile.school_id) {
          return new Response(
            JSON.stringify({ error: "This email is already registered as a parent at a different school." }),
            { status: 400, headers: jsonHeaders }
          );
        }

        const { alreadyLinked } = await insertLink(existingProfile.id);
        if (!alreadyLinked) await logCreated(existingProfile.id, "linked_existing");

        return new Response(
          JSON.stringify({
            success: true,
            id: existingProfile.id,
            email,
            linked_student_name: studentRow.full_name,
            outcome: alreadyLinked ? "already_linked" : "linked_existing",
          }),
          { status: 200, headers: jsonHeaders }
        );
      }

      // Orphaned auth user (an earlier attempt got this far and failed before
      // the profile row was written) -- finish setting it up now instead of
      // staying stuck forever, since createUser() will keep refusing this
      // email otherwise. Reset the password since whatever was generated on
      // the failed attempt was never delivered to anyone.
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
        role: "parent",
        full_name,
        must_change_password: true,
      });
      if (recoverProfileError) {
        return new Response(JSON.stringify({ error: recoverProfileError.message }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      await insertLink(existingUser.id);
      await logCreated(existingUser.id, "recovered_orphaned_account");

      const appUrlRecover = (
        Deno.env.get("STUDENT_PARENT_APP_URL") ?? "https://natm-student-parent.vercel.app"
      ).replace(/\/$/, "");
      const { error: resetEmailErrorRecover } = await adminClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${appUrlRecover}/reset-password`,
      });

      return new Response(
        JSON.stringify({
          success: true,
          id: existingUser.id,
          email,
          temporary_password: temporaryPassword,
          linked_student_name: studentRow.full_name,
          password_email_sent: !resetEmailErrorRecover,
          outcome: "created",
        }),
        { status: 200, headers: jsonHeaders }
      );
    }

    // ---------- Brand-new account: create profile + link, rolling back the
    // auth user on either failure so a retry with the same email isn't
    // permanently stuck the way this used to leave things. ----------
    const { error: profileInsertError } = await adminClient.from("profiles").insert({
      id: created.user.id,
      school_id: callerProfile.school_id,
      role: "parent",
      full_name,
      must_change_password: true,
    });
    if (profileInsertError) {
      await adminClient.auth.admin.deleteUser(created.user.id);
      return new Response(JSON.stringify({ error: profileInsertError.message }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    try {
      await insertLink(created.user.id);
    } catch (linkErr) {
      await adminClient.from("profiles").delete().eq("id", created.user.id);
      await adminClient.auth.admin.deleteUser(created.user.id);
      return new Response(
        JSON.stringify({ error: linkErr instanceof Error ? linkErr.message : "Failed to link parent" }),
        { status: 400, headers: jsonHeaders }
      );
    }

    await logCreated(created.user.id, "created");

    // Send the parent a real password-recovery email so they set their
    // own password without ever needing the admin-generated temporary
    // one below -- same mechanism the "Forgot password?" flow on the
    // login screen already uses (Supabase Auth's built-in recovery
    // email), so it's subject to the same known rate limit on Supabase's
    // default/free email sending (custom SMTP deferred until a real
    // domain is registered). STUDENT_PARENT_APP_URL should be set as a
    // Supabase secret to the deployed student-parent app's URL, but if
    // it's ever unset, fall back to the known production URL rather than
    // skipping the email (as before) or letting Supabase Auth's dashboard
    // "Site URL" take over, which defaults to http://localhost:3000 on a
    // fresh project.
    const appUrl = (Deno.env.get("STUDENT_PARENT_APP_URL") ?? "https://natm-student-parent.vercel.app").replace(
      /\/$/,
      ""
    );
    const { error: resetEmailError } = await adminClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/reset-password`,
    });
    if (resetEmailError) {
      console.error("Failed to send parent password-recovery email:", resetEmailError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        id: created.user.id,
        email,
        temporary_password: temporaryPassword,
        linked_student_name: studentRow.full_name,
        password_email_sent: !resetEmailError,
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

