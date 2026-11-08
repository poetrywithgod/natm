import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateTemporaryPassword } from "../_shared/temporaryPassword.ts";

function isEmailAlreadyRegisteredError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "email_exists") return true;
  return (error.message ?? "").toLowerCase().includes("already been registered");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Client scoped to the caller's own JWT — used only to verify who they
    // are and that they're actually a school_admin, never to write data.
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

    if (profileError || !callerProfile || !["school_admin", "homeschool_teacher"].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: "Forbidden — school_admin or homeschool_teacher only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { email, full_name, role } = body as {
      email?: string;
      full_name?: string;
      role?: string;
    };

    if (!email || !full_name || !role) {
      return new Response(JSON.stringify({ error: "email, full_name, and role are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // A homeschool teacher can add further teachers to their own family
    // tenant (assignment then splits by class/subject), but homeschool
    // tenants have no internal fees, so no Finance Manager.
    const allowedRoles =
      callerProfile.role === "homeschool_teacher"
        ? ["class_teacher", "shadow_teacher"]
        : ["class_teacher", "shadow_teacher", "finance_manager"];
    if (!allowedRoles.includes(role)) {
      return new Response(JSON.stringify({ error: `role must be one of: ${allowedRoles.join(", ")}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service-role client — only ever used server-side, never exposed to the browser.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // The admin hands the staff member a generated temporary password
    // (shown once on the admin's screen, never stored or emailed). The
    // profile is flagged must_change_password so the staff app forces a
    // new password at first sign-in; the DB clears the flag server-side
    // only once the password has really changed (see
    // 20260930000000_profiles_security_hardening.sql).
    const temporaryPassword = generateTemporaryPassword();
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
    });
    if (createError || !created.user) {
      // Supabase Auth rejects an email that's already a user. The most
      // common way that happens here: someone tried to permanently delete
      // a staff member earlier, but the delete failed (blocked by
      // historical records like attendance or logged work -- see
      // delete-staff-member) and the auth account never actually went
      // away, even though it may have been deactivated. Give a pointer to
      // the fix instead of the raw, easy-to-misread Auth error.
      const message = isEmailAlreadyRegisteredError(createError)
        ? "A staff account with this email already exists in the system. If they used to work here, check \"Show deactivated staff\" and reactivate them instead of adding them again -- if Delete was tried on them before, it likely didn't fully complete because of historical records tied to their account."
        : (createError?.message ?? "Account creation failed");
      return new Response(JSON.stringify({ error: message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // createUser only succeeds for a brand-new auth user, so a plain
    // insert is safe here. If it fails, roll the auth user back: leaving
    // it behind would make a retry hit "already registered" with nothing
    // actually linked to the account.
    const { error: insertError } = await adminClient.from("profiles").insert({
      id: created.user.id,
      school_id: callerProfile.school_id,
      role,
      full_name,
      must_change_password: true,
    });

    if (insertError) {
      await adminClient.auth.admin.deleteUser(created.user.id);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The temporary password is deliberately NOT logged.
    await adminClient.from("audit_logs").insert({
      school_id: callerProfile.school_id,
      actor_id: user.id,
      action: "staff.created",
      entity_type: "staff",
      entity_id: created.user.id,
      details: { full_name, email, role },
    });

    return new Response(JSON.stringify({ success: true, id: created.user.id, temporary_password: temporaryPassword }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
