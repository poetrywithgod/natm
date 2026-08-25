import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { email, full_name, student_id } = body as {
      email?: string;
      full_name?: string;
      student_id?: string;
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

    const temporaryPassword = generatePassword();
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
    });
    if (createError || !created.user) {
      return new Response(JSON.stringify({ error: createError?.message ?? "Account creation failed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: profileInsertError } = await adminClient.from("profiles").insert({
      id: created.user.id,
      school_id: callerProfile.school_id,
      role: "parent",
      full_name,
    });
    if (profileInsertError) {
      return new Response(JSON.stringify({ error: profileInsertError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: linkError } = await adminClient.from("parent_student_links").insert({
      parent_id: created.user.id,
      student_id: studentRow.id,
    });
    if (linkError) {
      return new Response(JSON.stringify({ error: linkError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await adminClient.from("audit_logs").insert({
      school_id: callerProfile.school_id,
      actor_id: user.id,
      action: "parent.created",
      entity_type: "profile",
      entity_id: created.user.id,
      details: { full_name, email, linked_student_id: studentRow.id, linked_student_name: studentRow.full_name },
    });

    return new Response(
      JSON.stringify({
        success: true,
        id: created.user.id,
        email,
        temporary_password: temporaryPassword,
        linked_student_name: studentRow.full_name,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
