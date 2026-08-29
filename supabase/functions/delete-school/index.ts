import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Deleting a school cascades to essentially everything under it (classes,
// students, staff profiles, fees, messages, the lot -- see initial_schema.sql's
// "on delete cascade" chains). That's fine for a school created by mistake
// with nothing real in it yet, and catastrophic for anything else. This
// blocks the delete entirely if the school has any students or any staff
// beyond a School Admin with no real activity -- same defensive philosophy
// as apps/staff's deleteClass(). Deactivating (schools.is_active) is the
// right tool for a school that's actually been used and needs to go away;
// this is only for cleaning up an accidental/empty one.
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
    const { school_id } = body as { school_id?: string };
    if (!school_id) {
      return new Response(JSON.stringify({ error: "school_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const [{ count: studentCount }, { count: staffCount }, { data: school }] = await Promise.all([
      adminClient.from("students").select("id", { count: "exact", head: true }).eq("school_id", school_id),
      adminClient.from("profiles").select("id", { count: "exact", head: true }).eq("school_id", school_id),
      adminClient.from("schools").select("name").eq("id", school_id).single(),
    ]);

    if ((studentCount ?? 0) > 0 || (staffCount ?? 0) > 0) {
      return new Response(
        JSON.stringify({
          error: `This school has ${studentCount ?? 0} student(s) and ${staffCount ?? 0} staff account(s). Deactivate it instead of deleting, or remove all students and staff first.`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: deleteError } = await adminClient.from("schools").delete().eq("id", school_id);
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // school_id cascades on audit_logs too, so this can't log against the
    // now-deleted school -- log against no school_id isn't possible either
    // (not-null column), so this is intentionally the one action in the
    // app that leaves no audit trail row of its own. Acceptable here since
    // the guard above means only empty, never-really-used schools qualify.
    console.log(`Super admin ${user.id} deleted empty school ${school_id} (${school?.name ?? "unknown"})`);

    return new Response(JSON.stringify({ success: true }), {
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
