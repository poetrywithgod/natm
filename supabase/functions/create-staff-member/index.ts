import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    if (profileError || !callerProfile || callerProfile.role !== "school_admin") {
      return new Response(JSON.stringify({ error: "Forbidden — school_admin only" }), {
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

    if (!["class_teacher", "shadow_teacher", "finance_manager"].includes(role)) {
      return new Response(JSON.stringify({ error: "role must be class_teacher, shadow_teacher, or finance_manager" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service-role client — only ever used server-side, never exposed to the browser.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const appUrl = Deno.env.get("APP_URL");
    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      appUrl ? { redirectTo: `${appUrl}/reset-password` } : undefined
    );
    if (inviteError || !invited.user) {
      const raw = inviteError?.message ?? "Invite failed";
      // Supabase Auth rejects inviting an email that's already a confirmed
      // user. The most common way that happens here: someone tried to
      // permanently delete a staff member earlier, but the delete failed
      // (blocked by historical records like attendance or logged work --
      // see delete-staff-member) and the auth account never actually went
      // away, even though it may have been deactivated. Give a pointer to
      // the fix instead of the raw, easy-to-misread Auth error.
      const alreadyRegistered = /already.*(registered|exist)/i.test(raw);
      const message = alreadyRegistered
        ? "A staff account with this email already exists in the system. If they used to work here, check \"Show deactivated staff\" and reactivate them instead of inviting again -- if Delete was tried on them before, it likely didn't fully complete because of historical records tied to their account."
        : raw;
      return new Response(JSON.stringify({ error: message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert rather than insert: inviteUserByEmail is idempotent and
    // returns the existing auth user if this email was already invited
    // before, so a plain insert would collide on the profiles primary key
    // for a retried invite. Upsert makes retries safe either way.
    const { error: insertError } = await adminClient.from("profiles").upsert(
      {
        id: invited.user.id,
        school_id: callerProfile.school_id,
        role,
        full_name,
      },
      { onConflict: "id" }
    );

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await adminClient.from("audit_logs").insert({
      school_id: callerProfile.school_id,
      actor_id: user.id,
      action: "staff.invited",
      entity_type: "staff",
      entity_id: invited.user.id,
      details: { full_name, email, role },
    });

    return new Response(JSON.stringify({ success: true, id: invited.user.id }), {
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
