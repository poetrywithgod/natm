import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateTemporaryPassword } from "../_shared/temporaryPassword.ts";

// Super Admin only. Creates the family's own parent login for a homeschool
// tenant, so the family can sign in to the parent app and request a teacher
// from the NATM teacher pool before any teacher exists. When the assigned
// teacher later admits a child using the same email, that child is linked to
// this same login.
//
//   { school_id, full_name, email, phone? }
// Returns { success, id, email, temporary_password } -- shown once to Super
// Admin to hand to the family; the parent must change it on first sign-in.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { data: callerProfile } = await callerClient.from("profiles").select("role").eq("id", user.id).single();
    if (callerProfile?.role !== "super_admin") return json({ error: "Forbidden — super_admin only" }, 403);

    const { school_id, full_name, email, phone } = (await req.json()) as {
      school_id?: string;
      full_name?: string;
      email?: string;
      phone?: string;
    };
    if (!school_id || !full_name?.trim() || !email?.trim()) {
      return json({ error: "school_id, full_name and email are required" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: school } = await admin
      .from("schools")
      .select("id, school_type")
      .eq("id", school_id)
      .maybeSingle();
    if (!school) return json({ error: "School not found" }, 404);
    if (school.school_type !== "homeschool") {
      return json({ error: "A family login can only be added to a homeschool tenant." }, 400);
    }

    const password = generateTemporaryPassword();
    const cleanEmail = email.trim().toLowerCase();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
    });
    if (createError || !created?.user) {
      const raw = createError?.message ?? "Account creation failed";
      const taken = createError?.code === "email_exists" || /already.*(registered|exist)/i.test(raw);
      return json(
        {
          error: taken
            ? "An account with this email already exists in the system. Use a different email for the family login."
            : raw,
        },
        400
      );
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: created.user.id,
      school_id,
      role: "parent",
      full_name: full_name.trim(),
      phone: phone?.trim() || null,
      must_change_password: true,
    });
    if (profileError) {
      // Don't leave a login with no profile behind.
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: profileError.message }, 400);
    }

    await admin.from("audit_logs").insert({
      school_id,
      actor_id: user.id,
      action: "parent.created",
      entity_type: "profile",
      entity_id: created.user.id,
      details: { full_name: full_name.trim(), email: cleanEmail, outcome: "family_contact" },
    });

    return json({ success: true, id: created.user.id, email: cleanEmail, temporary_password: password });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
