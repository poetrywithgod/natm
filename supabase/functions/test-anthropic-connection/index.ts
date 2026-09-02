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

// The only integration on the system_integrations board with a real,
// automatable check -- Remita needs a merchant account to ping, SMTP
// delivery can't be confirmed without actually receiving an email, but
// the Anthropic key + credit balance can be verified with one cheap
// call. Same model/endpoint as generate-iep-recommendation, just
// max_tokens: 1 -- this is a connectivity check, not a real generation.
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
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (callerProfile?.role !== "super_admin") {
      return jsonResponse({ error: "Forbidden — super_admin only" }, 403);
    }

    let status: "working" | "blocked";
    let notes: string;

    if (!anthropicKey) {
      status = "blocked";
      notes = "ANTHROPIC_API_KEY is not set as a project secret.";
    } else {
      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }],
        }),
      });

      if (anthropicRes.ok) {
        status = "working";
        notes = `Verified working as of ${new Date().toISOString()}.`;
      } else {
        status = "blocked";
        const errText = await anthropicRes.text();
        try {
          const parsed = JSON.parse(errText);
          notes = typeof parsed?.error?.message === "string" ? parsed.error.message : `Anthropic API returned ${anthropicRes.status}.`;
        } catch {
          notes = `Anthropic API returned ${anthropicRes.status}.`;
        }
      }
    }

    const now = new Date().toISOString();
    const { error: updateError } = await adminClient
      .from("system_integrations")
      .update({ status, notes, last_checked_at: now, updated_at: now })
      .eq("id", "anthropic");
    if (updateError) return jsonResponse({ error: updateError.message }, 500);

    return jsonResponse({ status, notes, last_checked_at: now }, 200);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
