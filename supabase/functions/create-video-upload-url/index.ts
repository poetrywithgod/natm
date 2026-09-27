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

// Requests a one-time Mux direct-upload URL so the browser can upload the
// video file straight to Mux via TUS -- the file itself never passes
// through this function or Supabase storage, only this short-lived URL +
// upload id do. See apps/staff/src/features/lessons/api.ts for the client
// side (uploadVideoFile TUS-uploads to the returned uploadURL, then
// pollVideoUploadStatus polls get-video-upload-status for the resulting
// playback id, which createVideoLesson saves as video_id).
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
      return jsonResponse(
        { error: "Video upload isn't configured yet -- ask your Super Admin to finish Mux setup." },
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

    const muxAuth = `Basic ${btoa(`${muxTokenId}:${muxTokenSecret}`)}`;
    const muxResponse = await fetch("https://api.mux.com/video/v1/uploads", {
      method: "POST",
      headers: {
        Authorization: muxAuth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cors_origin: "*",
        new_asset_settings: { playback_policy: ["public"] },
      }),
    });

    const muxBody = await muxResponse.json();
    if (!muxResponse.ok) {
      const message = muxBody?.error?.messages?.[0] || "Mux rejected the upload request";
      return jsonResponse({ error: message }, 502);
    }

    return jsonResponse(
      { uploadURL: muxBody.data.url, uploadId: muxBody.data.id },
      200
    );
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
