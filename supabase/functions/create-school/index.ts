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
    const { name, contact_email, admin_name, admin_email } = body as {
      name?: string;
      contact_email?: string | null;
      admin_name?: string;
      admin_email?: string;
    };
    if (!name || !name.trim()) {
      return new Response(JSON.stringify({ error: "School name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Either provide both admin fields or neither -- a half-filled admin
    // invite would otherwise silently create a school with no way in.
    if ((admin_name && !admin_email) || (admin_email && !admin_name)) {
      return new Response(
        JSON.stringify({ error: "Provide both an admin name and email, or leave both blank" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: school, error: schoolError } = await adminClient
      .from("schools")
      .insert({ name: name.trim(), contact_email: contact_email || null })
      .select()
      .single();
    if (schoolError) {
      return new Response(JSON.stringify({ error: schoolError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await adminClient.from("audit_logs").insert({
      school_id: school.id,
      actor_id: user.id,
      action: "school.created",
      entity_type: "school",
      entity_id: school.id,
      details: { name: school.name },
    });

    let adminInvite: { id: string; email: string } | null = null;
    let adminInviteError: string | null = null;

    if (admin_name && admin_email) {
      // STAFF_APP_URL should be set as a Supabase secret, but if it's ever
      // unset, fall back to the real deployed staff app URL rather than
      // letting Supabase Auth's dashboard "Site URL" take over (defaults
      // to http://localhost:3000 on a fresh project) -- School Admins are
      // staff-app users, same redirect target as create-staff-member.
      const appUrl = (Deno.env.get("APP_URL") ?? "https://natm-staff-puce.vercel.app").replace(/\/$/, "");
      const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(admin_email, {
        redirectTo: `${appUrl}/reset-password`,
      });

      if (inviteError || !invited.user) {
        const raw = inviteError?.message ?? "Invite failed";
        const alreadyRegistered = /already.*(registered|exist)/i.test(raw);
        adminInviteError = alreadyRegistered
          ? "A staff account with this email already exists in the system. The school was created, but you'll need to add its School Admin separately once that's sorted out."
          : `The school was created, but inviting the School Admin failed: ${raw}`;
      } else {
        const { error: upsertError } = await adminClient.from("profiles").upsert(
          { id: invited.user.id, school_id: school.id, role: "school_admin", full_name: admin_name },
          { onConflict: "id" }
        );
        if (upsertError) {
          adminInviteError = `The school was created, but linking the School Admin profile failed: ${upsertError.message}`;
        } else {
          adminInvite = { id: invited.user.id, email: admin_email };
          await adminClient.from("audit_logs").insert({
            school_id: school.id,
            actor_id: user.id,
            action: "school_admin.invited",
            entity_type: "staff",
            entity_id: invited.user.id,
            details: { full_name: admin_name, email: admin_email },
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, school, admin_invite: adminInvite, admin_invite_error: adminInviteError }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
