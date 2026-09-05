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

// Requests a one-time Cloudflare Stream direct-upload URL so the browser can
// upload the video file straight to Cloudflare -- the file itself never
// passes through this function or Supabase storage, only this short-lived
// URL + video UID do. See apps/staff/src/features/lessons/api.ts for the
// client side of this (uploadVideoFile posts the file to the returned
// uploadURL, then createVideoLesson saves the returned uid as video_id).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const cloudflareAccountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
    const cloudflareApiToken = Deno.env.get("CLOUDFLARE_API_TOKEN");

    if (!cloudflareAccountId || !cloudflareApiToken) {
      return jsonResponse(
        { error: "Video upload isn't configured yet -- ask your Super Admin to finish Cloudflare setup." },
        503
      );
    }

    // Client scoped to the caller's own JWT -- verifies who they are and
    // that they're a class_teacher, same pattern as generate-quiz.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: "Invalid session" }, 401);

    const { data: callerProfile, error: profileError } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !callerProfile || callerProfile.role !== "class_teacher") {
      return jsonResponse({ error: "Forbidden -- class_teacher only" }, 403);
    }

    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/stream/direct_upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cloudflareApiToken}`,
          "Content-Type": "application/json",
        },
        // 1 hour cap -- generous for a classroom lesson recording, short
        // enough to keep runaway/mistaken uploads from racking up storage.
        body: JSON.stringify({ maxDurationSeconds: 3600 }),
      }
    );

    const cfBody = await cfResponse.json();
    if (!cfResponse.ok || !cfBody.success) {
      const message = cfBody?.errors?.[0]?.message || "Cloudflare rejected the upload request";
      return jsonResponse({ error: message }, 502);
    }

    return jsonResponse(
      { uploadURL: cfBody.result.uploadURL, uid: cfBody.result.uid },
      200
    );
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
