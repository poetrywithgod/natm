import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const QUESTIONS_PER_QUIZ = 10;

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

    // Client scoped to the caller's own JWT -- verifies who they are and
    // that they're a class_teacher, never used to write privileged data.
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

    if (profileError || !callerProfile || callerProfile.role !== "class_teacher") {
      return jsonResponse({ error: "Forbidden -- class_teacher only" }, 403);
    }

    const body = await req.json();
    const { lesson_id, difficulty } = body as { lesson_id?: string; difficulty?: string };

    if (!lesson_id || !difficulty) {
      return jsonResponse({ error: "lesson_id and difficulty are required" }, 400);
    }
    if (!["easy", "normal", "hard"].includes(difficulty)) {
      return jsonResponse({ error: "difficulty must be easy, normal, or hard" }, 400);
    }

    // Service-role client -- only ever used server-side.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: lesson, error: lessonError } = await adminClient
      .from("lessons")
      .select("id, school_id, extracted_text, title")
      .eq("id", lesson_id)
      .single();

    if (lessonError || !lesson) return jsonResponse({ error: "Lesson not found" }, 404);
    if (!lesson.extracted_text || lesson.extracted_text.trim().length < 50) {
      return jsonResponse(
        { error: "This lesson doesn't have enough extracted text to generate a quiz from." },
        400
      );
    }
    if (lesson.school_id !== callerProfile.school_id) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    // Create the quiz row up front (status: generating) so the client can
    // show progress immediately, then fill in questions once Claude responds.
    const { data: quiz, error: quizInsertError } = await adminClient
      .from("quizzes")
      .insert({
        lesson_id,
        school_id: lesson.school_id,
        difficulty,
        status: "generating",
        created_by: user.id,
      })
      .select()
      .single();

    if (quizInsertError) return jsonResponse({ error: quizInsertError.message }, 500);

    const difficultyGuidance: Record<string, string> = {
      easy: "straightforward recall of explicitly stated facts from the text",
      normal: "understanding and application of concepts covered in the text",
      hard: "deeper reasoning, comparison, or applying the concepts to a new scenario",
    };

    const prompt = `You are generating a quiz for a school pupil based on the following lesson content.

Lesson title: ${lesson.title}

Lesson content:
"""
${lesson.extracted_text.slice(0, 12000)}
"""

Generate exactly ${QUESTIONS_PER_QUIZ} objective questions at "${difficulty}" difficulty (${difficultyGuidance[difficulty]}). Use a mix of multiple_choice and fill_in_blank question types. Each question must be answerable directly from the lesson content above -- do not introduce outside facts.

Respond with ONLY a JSON array (no markdown, no prose, no code fences) where each item has exactly this shape:
{
  "question_type": "multiple_choice" | "fill_in_blank",
  "question_text": string,
  "options": string[] | null,   // exactly 4 options for multiple_choice, null for fill_in_blank
  "correct_answer": string,     // must exactly match one of the options for multiple_choice
  "marks": number                // 1 for easy, 2 for normal, 3 for hard
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
      await adminClient
        .from("quizzes")
        .update({ status: "failed", error_message: `AI request failed: ${errText.slice(0, 500)}` })
        .eq("id", quiz.id);
      return jsonResponse({ error: "Quiz generation failed", quiz_id: quiz.id }, 502);
    }

    const anthropicData = await anthropicRes.json();
    const rawText = anthropicData.content?.[0]?.text ?? "";

    let questions: {
      question_type: string;
      question_text: string;
      options: string[] | null;
      correct_answer: string;
      marks: number;
    }[];

    try {
      // Claude may still wrap output in a code fence despite instructions --
      // strip it defensively before parsing.
      const cleaned = rawText.trim().replace(/^```json\s*|^```\s*|```$/g, "");
      questions = JSON.parse(cleaned);
      if (!Array.isArray(questions) || questions.length === 0) throw new Error("Empty question list");
    } catch (parseErr) {
      await adminClient
        .from("quizzes")
        .update({
          status: "failed",
          error_message: `Failed to parse AI response: ${
            parseErr instanceof Error ? parseErr.message : "unknown error"
          }`,
        })
        .eq("id", quiz.id);
      return jsonResponse({ error: "Quiz generation failed", quiz_id: quiz.id }, 502);
    }

    const rows = questions.map((q, i) => ({
      quiz_id: quiz.id,
      question_type: q.question_type,
      question_text: q.question_text,
      options: q.options,
      correct_answer: q.correct_answer,
      marks: q.marks,
      order_index: i,
    }));

    const { error: questionsInsertError } = await adminClient.from("quiz_questions").insert(rows);
    if (questionsInsertError) {
      await adminClient
        .from("quizzes")
        .update({ status: "failed", error_message: questionsInsertError.message })
        .eq("id", quiz.id);
      return jsonResponse({ error: "Failed to save questions", quiz_id: quiz.id }, 500);
    }

    await adminClient.from("quizzes").update({ status: "ready" }).eq("id", quiz.id);

    await adminClient.from("audit_logs").insert({
      school_id: lesson.school_id,
      actor_id: user.id,
      action: "quiz.generated",
      entity_type: "lesson",
      entity_id: lesson_id,
      details: { quiz_id: quiz.id, difficulty, question_count: rows.length },
    });

    return jsonResponse({ success: true, quiz_id: quiz.id }, 200);
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
