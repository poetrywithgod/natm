import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateAIText } from "../_shared/ai-client.ts";

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
// whichever AI provider is active (AI_PROVIDER secret -- "anthropic" or
// "gemini") can be verified with one cheap call via the same
// _shared/ai-client.ts used by quiz generation and IEP recommendations.
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
    const provider = (Deno.env.get("AI_PROVIDER") ?? "anthropic").toLowerCase();

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

    try {
      await generateAIText("ping", { maxTokens: 1 });
      status = "working";
      notes = `Verified working via ${provider} as of ${new Date().toISOString()}.`;
    } catch (err) {
      status = "blocked";
      const message = err instanceof Error ? err.message : String(err);
      try {
        const parsed = JSON.parse(message);
        notes = typeof parsed?.error?.message === "string" ? `[${provider}] ${parsed.error.message}` : `[${provider}] ${message.slice(0, 300)}`;
      } catch {
        notes = `[${provider}] ${message.slice(0, 300)}`;
      }
    }

    const now = new Date().toISOString();
    const { error: updateError } = await adminClient
      .from("system_integrations")
      .update({ status, notes, last_checked_at: now, updated_at: now })
      .eq("id", "ai_provider");
    if (updateError) return jsonResponse({ error: updateError.message }, 500);

    return jsonResponse({ status, notes, last_checked_at: now, provider }, 200);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
