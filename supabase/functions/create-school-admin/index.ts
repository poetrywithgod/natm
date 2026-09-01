import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Despite the function's name (kept as-is to avoid a redeploy/rename dance),
// this now invites any staff role on Super Admin's behalf, not just
// School Admins -- role defaults to "school_admin" so the existing
// SchoolDetail "Invite Admin" call keeps working unchanged.
const VALID_ROLES = ["school_admin", "class_teacher", "shadow_teacher", "finance_manager"] as const;
type StaffRole = (typeof VALID_ROLES)[number];

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
      .select("role")
      .eq("id", user.id)
      .single();
    if (profileError || !callerProfile || callerProfile.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Forbidden — super_admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { school_id, full_name, email, role } = body as {
      school_id?: string;
      full_name?: string;
      email?: string;
      role?: StaffRole;
    };
    if (!school_id || !full_name || !email) {
      return new Response(JSON.stringify({ error: "school_id, full_name, and email are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resolvedRole: StaffRole = role ?? "school_admin";
    if (!VALID_ROLES.includes(resolvedRole)) {
      return new Response(
        JSON.stringify({ error: `role must be one of: ${VALID_ROLES.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: school, error: schoolError } = await adminClient
      .from("schools")
      .select("id")
      .eq("id", school_id)
      .single();
    if (schoolError || !school) {
      return new Response(JSON.stringify({ error: "School not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appUrl = (Deno.env.get("APP_URL") ?? "https://natm-staff-puce.vercel.app").replace(/\/$/, "");
    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appUrl}/reset-password`,
    });
    if (inviteError || !invited.user) {
      const raw = inviteError?.message ?? "Invite failed";
      const alreadyRegistered = /already.*(registered|exist)/i.test(raw);
      const message = alreadyRegistered
        ? "A staff account with this email already exists in the system. If they used to work somewhere in NATM, check that school's Staff Management for a deactivated account instead of inviting again."
        : raw;
      return new Response(JSON.stringify({ error: message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: upsertError } = await adminClient.from("profiles").upsert(
      { id: invited.user.id, school_id, role: resolvedRole, full_name },
      { onConflict: "id" }
    );
    if (upsertError) {
      return new Response(JSON.stringify({ error: upsertError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await adminClient.from("audit_logs").insert({
      school_id,
      actor_id: user.id,
      action: `${resolvedRole}.invited`,
      entity_type: "staff",
      entity_id: invited.user.id,
      details: { full_name, email, role: resolvedRole },
    });

    return new Response(JSON.stringify({ success: true, id: invited.user.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
