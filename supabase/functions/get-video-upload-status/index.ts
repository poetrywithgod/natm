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

// After a TUS upload finishes, Mux still needs a moment to turn it into an
// asset and assign a playback id. The client (pollVideoUploadStatus in
// apps/staff/src/features/lessons/api.ts) calls this every couple of
// seconds until playbackId comes back non-null (or uploadStatus/assetStatus
// signals a failure).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const muxTokenId = Deno.env.get("MUX_TOKEN_ID");
    const muxTokenSecret = Deno.env.get("MUX_TOKEN_SECRET");

    if (!muxTokenId || !muxTokenSecret) {
      return jsonResponse({ error: "Video upload isn't configured yet." }, 503);
    }

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

    const body = await req.json();
    const { uploadId } = body as { uploadId?: string };
    if (!uploadId) return jsonResponse({ error: "uploadId is required" }, 400);

    const muxAuth = `Basic ${btoa(`${muxTokenId}:${muxTokenSecret}`)}`;

    const uploadResponse = await fetch(`https://api.mux.com/video/v1/uploads/${uploadId}`, {
      headers: { Authorization: muxAuth },
    });
    const uploadBody = await uploadResponse.json();
    if (!uploadResponse.ok) {
      return jsonResponse({ error: uploadBody?.error?.messages?.[0] || "Mux upload lookup failed" }, 502);
    }

    const uploadStatus = uploadBody.data.status as string;
    const assetId = uploadBody.data.asset_id as string | undefined;

    if (uploadStatus === "errored" || uploadStatus === "cancelled" || uploadStatus === "timed_out") {
      return jsonResponse({ uploadStatus, assetStatus: null, playbackId: null }, 200);
    }

    if (!assetId) {
      // Still waiting for Mux to turn the upload into an asset.
      return jsonResponse({ uploadStatus, assetStatus: null, playbackId: null }, 200);
    }

    const assetResponse = await fetch(`https://api.mux.com/video/v1/assets/${assetId}`, {
      headers: { Authorization: muxAuth },
    });
    const assetBody = await assetResponse.json();
    if (!assetResponse.ok) {
      return jsonResponse({ error: assetBody?.error?.messages?.[0] || "Mux asset lookup failed" }, 502);
    }

    const assetStatus = assetBody.data.status as string;
    const playbackId = assetBody.data.playback_ids?.[0]?.id ?? null;

    return jsonResponse({ uploadStatus, assetStatus, playbackId }, 200);
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
