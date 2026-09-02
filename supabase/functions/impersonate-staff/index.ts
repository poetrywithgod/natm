import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const STAFF_ROLES = ["school_admin", "class_teacher", "shadow_teacher", "finance_manager"];

// Generates a real, single-use Supabase magic link into the staff app as
// the target staff member -- this is Supabase's actual supported
// mechanism for admin-initiated sign-in (there's no separate "impersonate"
// API); it does not read, store, or transmit the target's password, and
// the link is one-time-use and short-lived per Supabase's own OTP expiry.
// redirect_to points at /login specifically, not "/" -- the staff app's
// bare "/" route unconditionally goes to /admin, which would 403 a
// class_teacher or shadow_teacher; /login is wrapped in RedirectIfAuthed,
// which sends a signed-in user to their own role's home page instead.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const appUrl = (Deno.env.get("APP_URL") ?? "https://natm-staff-puce.vercel.app").replace(/\/$/, "");

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerProfile } = await adminClient.from("profiles").select("role").eq("id", user.id).single();
    if (callerProfile?.role !== "super_admin") {
      return jsonResponse({ error: "Forbidden — super_admin only" }, 403);
    }

    const body = await req.json();
    const { staff_id } = body as { staff_id?: string };
    if (!staff_id) return jsonResponse({ error: "staff_id is required" }, 400);

    const { data: target, error: targetError } = await adminClient
      .from("profiles")
      .select("id, school_id, role, full_name, is_active")
      .eq("id", staff_id)
      .single();
    if (targetError || !target) return jsonResponse({ error: "Staff member not found" }, 404);
    if (!STAFF_ROLES.includes(target.role)) {
      return jsonResponse({ error: "Can only view as staff (School Admin, Class Teacher, Shadow Teacher, Finance Manager)" }, 400);
    }
    if (!target.is_active) {
      return jsonResponse({ error: "Can't view as a deactivated staff member" }, 400);
    }

    const { data: targetUser, error: getUserError } = await adminClient.auth.admin.getUserById(staff_id);
    if (getUserError || !targetUser?.user?.email) {
      return jsonResponse({ error: "Couldn't resolve that staff member's account" }, 404);
    }

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: targetUser.user.email,
      options: { redirectTo: `${appUrl}/login` },
    });
    if (linkError || !linkData?.properties?.action_link) {
      return jsonResponse({ error: linkError?.message ?? "Failed to generate sign-in link" }, 500);
    }

    // Logged as its own clearly-labeled action so it's never mistaken for
    // something the target staff member did themselves.
    await adminClient.from("audit_logs").insert({
      school_id: target.school_id,
      actor_id: user.id,
      action: "staff.impersonated",
      entity_type: "staff",
      entity_id: staff_id,
      details: { target_full_name: target.full_name, target_role: target.role },
    });

    return jsonResponse({ action_link: linkData.properties.action_link }, 200);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
