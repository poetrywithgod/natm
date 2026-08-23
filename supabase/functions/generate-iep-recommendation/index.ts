import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLASS_LEVELS = [
  "primary_1", "primary_2", "primary_3", "primary_4", "primary_5", "primary_6",
  "jss_1", "jss_2", "jss_3",
  "ss_1", "ss_2", "ss_3",
];

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;

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
      .select("role, school_id")
      .eq("id", user.id)
      .single();

    if (profileError || !callerProfile || callerProfile.role !== "school_admin") {
      return jsonResponse({ error: "Forbidden -- school_admin only" }, 403);
    }

    const body = await req.json();
    const { episode_id } = body as { episode_id?: string };
    if (!episode_id) return jsonResponse({ error: "episode_id is required" }, 400);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: episode, error: episodeError } = await adminClient
      .from("assessment_episodes")
      .select("id, school_id, student_id, status")
      .eq("id", episode_id)
      .single();

    if (episodeError || !episode) return jsonResponse({ error: "Episode not found" }, 404);
    if (episode.school_id !== callerProfile.school_id) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    if (!["form2_submitted", "ai_suggested"].includes(episode.status)) {
      return jsonResponse(
        { error: `Cannot generate a recommendation while episode status is "${episode.status}". Form 2 must be submitted first.` },
        400
      );
    }

    const { data: form1, error: form1Error } = await adminClient
      .from("form1_submissions")
      .select("part_b")
      .eq("episode_id", episode_id)
      .single();
    if (form1Error || !form1) return jsonResponse({ error: "Form 1 submission not found" }, 404);

    const { data: form2, error: form2Error } = await adminClient
      .from("form2_submissions")
      .select("domains, protocol_notes")
      .eq("episode_id", episode_id)
      .single();
    if (form2Error || !form2) return jsonResponse({ error: "Form 2 submission not found" }, 404);

    const { data: subjects, error: subjectsError } = await adminClient
      .from("subjects")
      .select("id, name");
    if (subjectsError) return jsonResponse({ error: subjectsError.message }, 500);
    if (!subjects || subjects.length === 0) {
      return jsonResponse({ error: "No subjects exist yet -- curriculum must be authored before recommendations can be generated." }, 400);
    }

    const { data: curriculum } = await adminClient
      .from("curriculum_documents")
      .select("subject_id, level, term_number, domain_purpose, ai_recommendation_rules");

    const subjectNameById = new Map(subjects.map((s) => [s.id, s.name]));

    const curriculumGuidance = (curriculum ?? [])
      .filter((c) => c.ai_recommendation_rules || c.domain_purpose)
      .map((c) => {
        const name = subjectNameById.get(c.subject_id) ?? c.subject_id;
        return `Subject: ${name} | Level: ${c.level} | Term: ${c.term_number}\nDomain purpose: ${c.domain_purpose ?? "—"}\nAI recommendation rules: ${c.ai_recommendation_rules ?? "—"}`;
      })
      .join("\n\n");

    const prompt = `You are an educational placement assistant for NATM, a special-education platform. Based on a child's intake assessment (Form 1, Part B functional domains) and an in-person observation (Form 2, 12 dual-scored domains), recommend an initial class level and subject list.

Form 1 Part B -- functional domain ratings (0-4 scale, or N/A), self/family-reported at intake:
${JSON.stringify(form1.part_b, null, 2).slice(0, 8000)}

Form 2 -- structured observation, 12 domains each dual-scored on Functional Capacity (0-4, what the child can currently do) and Support Intensity (0-4, how much support it takes), plus observer confidence:
${JSON.stringify(form2.domains, null, 2).slice(0, 8000)}

Form 2 -- observation protocol notes and snapshot summary:
${JSON.stringify(form2.protocol_notes, null, 2).slice(0, 3000)}

Available subjects (choose only from this list, referencing by id):
${subjects.map((s) => `- ${s.id}: ${s.name}`).join("\n")}

${curriculumGuidance ? `Curriculum guidance available for some subject/level/term combinations:\n${curriculumGuidance}\n` : "No curriculum documents are loaded yet -- base your subject choices on general age/functional-level appropriateness."}

Recommend:
1. A single class_level from exactly this set: ${CLASS_LEVELS.join(", ")}
2. A list of subjects this child should be enrolled in, each with a short rationale grounded in the specific domain scores above (not generic).

Respond with ONLY a JSON object (no markdown, no prose, no code fences) in exactly this shape:
{
  "suggested_level": "<one of the class_level values above>",
  "suggested_subjects": [
    { "subject_id": "<uuid from the list above>", "subject_name": "<name>", "rationale": "<1-2 sentences, grounded in specific domain evidence>" }
  ],
  "summary": "<2-3 sentence overall rationale for the level and the subject set as a whole>"
}`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      let friendlyMessage = "The AI recommendation service is temporarily unavailable. Please try again shortly.";
      try {
        const parsed = JSON.parse(errText);
        if (typeof parsed?.error?.message === "string") {
          friendlyMessage = parsed.error.message;
        }
      } catch {
        // errText wasn't JSON -- keep the generic fallback above
      }
      return jsonResponse({ error: friendlyMessage }, 502);
    }

    const anthropicData = await anthropicRes.json();
    const rawText = anthropicData.content?.[0]?.text ?? "";

    let parsed: {
      suggested_level: string;
      suggested_subjects: { subject_id: string; subject_name: string; rationale: string }[];
      summary: string;
    };

    try {
      const cleaned = rawText.trim().replace(/^```json\s*|^```\s*|```$/g, "");
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      return jsonResponse(
        { error: `Failed to parse AI response: ${parseErr instanceof Error ? parseErr.message : "unknown error"}` },
        502
      );
    }

    if (!CLASS_LEVELS.includes(parsed.suggested_level)) {
      return jsonResponse({ error: `AI returned an invalid class level: ${parsed.suggested_level}` }, 502);
    }
    if (!Array.isArray(parsed.suggested_subjects) || parsed.suggested_subjects.length === 0) {
      return jsonResponse({ error: "AI returned no suggested subjects" }, 502);
    }
    const validSubjectIds = new Set(subjects.map((s) => s.id));
    const invalidSubject = parsed.suggested_subjects.find((s) => !validSubjectIds.has(s.subject_id));
    if (invalidSubject) {
      return jsonResponse({ error: `AI returned an unknown subject_id: ${invalidSubject.subject_id}` }, 502);
    }

    const { error: updateError } = await adminClient
      .from("assessment_episodes")
      .update({
        suggested_subjects: { subjects: parsed.suggested_subjects, summary: parsed.summary },
        suggested_level: parsed.suggested_level,
        ai_suggested_at: new Date().toISOString(),
        status: "ai_suggested",
      })
      .eq("id", episode_id);

    if (updateError) return jsonResponse({ error: updateError.message }, 500);

    await adminClient.from("audit_logs").insert({
      school_id: episode.school_id,
      actor_id: user.id,
      action: "iep.ai_recommendation_generated",
      entity_type: "assessment_episode",
      entity_id: episode_id,
      details: { suggested_level: parsed.suggested_level, subject_count: parsed.suggested_subjects.length },
    });

    return jsonResponse({ success: true, episode_id }, 200);
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
