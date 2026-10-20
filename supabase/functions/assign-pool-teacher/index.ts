import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Super Admin only. Assigns a teacher from the NATM teacher pool to a
// homeschool family (making them that tenant's homeschool_teacher), or
// ends that assignment.
//
//   { action: "assign",   pool_id, school_id }
//   { action: "unassign", pool_id }
//
// Assign: first time, invites the teacher by email and creates their
// profile; later times, reuses their existing login and moves it to the
// new family. Unassign: removes them from the family's classes and
// shadow assignments, then deactivates their login until the next
// assignment. History they wrote stays with the family.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INDEFINITE_BAN = "876000h";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

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
    if (userError || !user) return json({ error: "Invalid session" }, 401);

    const { data: callerProfile } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (callerProfile?.role !== "super_admin") return json({ error: "Forbidden — super_admin only" }, 403);

    const { action, pool_id, school_id } = (await req.json()) as {
      action?: "assign" | "unassign";
      pool_id?: string;
      school_id?: string;
    };
    if (!pool_id || !action || !["assign", "unassign"].includes(action)) {
      return json({ error: "pool_id and a valid action are required" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: pool } = await admin
      .from("teacher_pool")
      .select("id, full_name, email, status, profile_id, assigned_school_id")
      .eq("id", pool_id)
      .maybeSingle();
    if (!pool) return json({ error: "Pool teacher not found" }, 404);

    if (action === "assign") {
      if (!school_id) return json({ error: "school_id is required to assign" }, 400);
      if (pool.status !== "available") {
        return json({ error: `${pool.full_name} is not available (status: ${pool.status}).` }, 409);
      }

      const { data: school } = await admin
        .from("schools")
        .select("id, name, school_type, is_active")
        .eq("id", school_id)
        .maybeSingle();
      if (!school) return json({ error: "School not found" }, 404);
      if (school.school_type !== "homeschool") {
        return json({ error: "Pool teachers can only be assigned to homeschool families." }, 400);
      }

      const { count: existing } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("school_id", school_id)
        .eq("role", "homeschool_teacher")
        .eq("is_active", true);
      if (existing && existing > 0) {
        return json(
          { error: `${school.name} already has an active homeschool teacher. Unassign or deactivate them first.` },
          409
        );
      }

      let profileId = pool.profile_id;
      if (profileId) {
        // Returning teacher: reuse their login and move it to this family.
        const { error: unbanError } = await admin.auth.admin.updateUserById(profileId, { ban_duration: "none" });
        if (unbanError) return json({ error: unbanError.message }, 400);
        const { error: moveError } = await admin
          .from("profiles")
          .update({ school_id, role: "homeschool_teacher", full_name: pool.full_name, is_active: true, deactivated_at: null })
          .eq("id", profileId);
        if (moveError) return json({ error: moveError.message }, 400);
      } else {
        const appUrl = (Deno.env.get("APP_URL") ?? "https://natm-staff-puce.vercel.app").replace(/\/$/, "");
        const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(pool.email, {
          redirectTo: `${appUrl}/reset-password`,
        });
        if (inviteError || !invited.user) {
          const raw = inviteError?.message ?? "Invite failed";
          const already = /already.*(registered|exist)/i.test(raw);
          return json(
            {
              error: already
                ? "An account with this email already exists in the system. Use a different email for this teacher, or remove the old account first."
                : raw,
            },
            400
          );
        }
        profileId = invited.user.id;
        const { error: insertError } = await admin.from("profiles").upsert(
          { id: profileId, school_id, role: "homeschool_teacher", full_name: pool.full_name },
          { onConflict: "id" }
        );
        if (insertError) return json({ error: insertError.message }, 400);
      }

      const { error: poolError } = await admin
        .from("teacher_pool")
        .update({
          status: "assigned",
          profile_id: profileId,
          assigned_school_id: school_id,
          assigned_at: new Date().toISOString(),
        })
        .eq("id", pool_id);
      if (poolError) return json({ error: poolError.message }, 400);

      await admin.from("audit_logs").insert({
        school_id,
        actor_id: user.id,
        action: "pool_teacher.assigned",
        entity_type: "staff",
        entity_id: profileId,
        details: { full_name: pool.full_name, pool_id },
      });
      return json({ success: true, profile_id: profileId });
    }

    // unassign
    if (pool.status !== "assigned" || !pool.profile_id || !pool.assigned_school_id) {
      return json({ error: `${pool.full_name} is not currently assigned.` }, 409);
    }
    const schoolId = pool.assigned_school_id;
    const profileId = pool.profile_id;

    // The teacher keeps no seat in the family's classes or on their children.
    const { error: classError } = await admin
      .from("classes")
      .update({ class_teacher_id: null })
      .eq("school_id", schoolId)
      .eq("class_teacher_id", profileId);
    if (classError) return json({ error: classError.message }, 400);

    const { data: kids } = await admin.from("students").select("id").eq("school_id", schoolId);
    const kidIds = (kids ?? []).map((k) => k.id);
    if (kidIds.length > 0) {
      const { error: shadowError } = await admin
        .from("shadow_teacher_assignments")
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq("shadow_teacher_id", profileId)
        .eq("is_active", true)
        .in("student_id", kidIds);
      if (shadowError) return json({ error: shadowError.message }, 400);
    }

    const { error: banError } = await admin.auth.admin.updateUserById(profileId, {
      ban_duration: INDEFINITE_BAN,
    });
    if (banError) return json({ error: banError.message }, 400);
    const { error: profileError } = await admin
      .from("profiles")
      .update({ is_active: false, deactivated_at: new Date().toISOString() })
      .eq("id", profileId);
    if (profileError) return json({ error: profileError.message }, 400);

    const { error: poolError } = await admin
      .from("teacher_pool")
      .update({ status: "available", assigned_school_id: null, assigned_at: null })
      .eq("id", pool_id);
    if (poolError) return json({ error: poolError.message }, 400);

    await admin.from("audit_logs").insert({
      school_id: schoolId,
      actor_id: user.id,
      action: "pool_teacher.unassigned",
      entity_type: "staff",
      entity_id: profileId,
      details: { full_name: pool.full_name, pool_id },
    });
    return json({ success: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
