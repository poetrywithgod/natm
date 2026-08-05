import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// A ~100-year ban is Supabase's practical equivalent of an indefinite ban;
// "none" is the special value that lifts a ban.
const INDEFINITE_BAN = "876000h";

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
    const { staff_id, action } = body as { staff_id?: string; action?: "deactivate" | "reactivate" };

    if (!staff_id || !action || !["deactivate", "reactivate"].includes(action)) {
      return new Response(JSON.stringify({ error: "staff_id and a valid action are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: target, error: targetError } = await adminClient
      .from("profiles")
      .select("id, role, school_id, full_name")
      .eq("id", staff_id)
      .single();

    if (targetError || !target) {
      return new Response(JSON.stringify({ error: "Staff member not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (target.school_id !== callerProfile.school_id) {
      return new Response(JSON.stringify({ error: "Forbidden — different school" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "deactivate") {
      // Server-side duty check — defense in depth alongside the UI's own check.
      const reasons: string[] = [];

      if (target.role === "class_teacher") {
        const { data: ownedClasses } = await adminClient
          .from("classes")
          .select("name")
          .eq("class_teacher_id", staff_id);
        if (ownedClasses && ownedClasses.length > 0) {
          const classList = ownedClasses.map((c) => c.name).join(", ");
          const plural = ownedClasses.length > 1 ? "these classes" : "this class";
          reasons.push(
            `${target.full_name} is still the class teacher for ${classList}. Go to the Classes page and choose a new class teacher for ${plural}, then come back and try again.`
          );
        }
      }

      if (target.role === "shadow_teacher") {
        const { count } = await adminClient
          .from("shadow_teacher_assignments")
          .select("id", { count: "exact", head: true })
          .eq("shadow_teacher_id", staff_id)
          .eq("is_active", true);
        if (count && count > 0) {
          const studentWord = count === 1 ? "student" : "students";
          reasons.push(
            `${target.full_name} is still supporting ${count} ${studentWord} as their Shadow Teacher. Please assign a different Shadow Teacher to ${count === 1 ? "this student" : "these students"} first, then come back and try again.`
          );
        }
      }

      if (reasons.length > 0) {
        return new Response(JSON.stringify({ error: "Cannot deactivate yet", reasons }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: banError } = await adminClient.auth.admin.updateUserById(staff_id, {
        ban_duration: INDEFINITE_BAN,
      });
      if (banError) {
        return new Response(JSON.stringify({ error: banError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await adminClient
        .from("profiles")
        .update({ is_active: false, deactivated_at: new Date().toISOString() })
        .eq("id", staff_id);
      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient.from("audit_logs").insert({
        school_id: callerProfile.school_id,
        actor_id: user.id,
        action: "staff.deactivated",
        entity_type: "staff",
        entity_id: staff_id,
        details: { full_name: target.full_name },
      });
    } else {
      const { error: unbanError } = await adminClient.auth.admin.updateUserById(staff_id, {
        ban_duration: "none",
      });
      if (unbanError) {
        return new Response(JSON.stringify({ error: unbanError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await adminClient
        .from("profiles")
        .update({ is_active: true, deactivated_at: null })
        .eq("id", staff_id);
      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient.from("audit_logs").insert({
        school_id: callerProfile.school_id,
        actor_id: user.id,
        action: "staff.reactivated",
        entity_type: "staff",
        entity_id: staff_id,
        details: { full_name: target.full_name },
      });
    }

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
