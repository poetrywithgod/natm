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
    const { staff_id } = body as { staff_id?: string };

    if (!staff_id) {
      return new Response(JSON.stringify({ error: "staff_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Safety check: the target profile must belong to the caller's own school.
    const { data: targetProfile, error: targetError } = await adminClient
      .from("profiles")
      .select("school_id")
      .eq("id", staff_id)
      .single();

    if (targetError || !targetProfile) {
      return new Response(JSON.stringify({ error: "Staff member not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (targetProfile.school_id !== callerProfile.school_id) {
      return new Response(JSON.stringify({ error: "Forbidden — different school" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deleting the auth user cascades to profiles (on delete cascade),
    // so no separate profile delete is needed. If this staff member has
    // historical records (attendance marked, activities logged, work
    // assigned, etc.) other tables reference their profile without
    // cascading, deliberately, so those records survive -- the delete
    // then fails at the database level. Surface a clear message instead
    // of the generic one so the admin knows to deactivate instead.
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(staff_id);
    if (deleteError) {
      const isFkBlock = /database error deleting user/i.test(deleteError.message ?? "");
      const message = isFkBlock
        ? "This staff member has historical records (attendance, activities, or other data) linked to their account, so they can't be permanently deleted. Use Deactivate instead to remove their access while preserving school records."
        : deleteError.message;
      return new Response(JSON.stringify({ error: message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await adminClient.from("audit_logs").insert({
      school_id: callerProfile.school_id,
      actor_id: user.id,
      action: "staff.deleted",
      entity_type: "staff",
      entity_id: staff_id,
    });

    return new Response(JSON.stringify({ success: true }), {
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
