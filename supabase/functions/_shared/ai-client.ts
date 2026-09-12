// Provider-agnostic text generation for every AI feature in NATM (quiz
// generation, IEP recommendations, and anything added later). Switching
// providers is a Supabase secret change, never a code change:
//
//   AI_PROVIDER=gemini   + GEMINI_API_KEY=...     -> free, no card required
//   AI_PROVIDER=anthropic (default if unset) + ANTHROPIC_API_KEY=...
//
// Use Gemini while ANTHROPIC_API_KEY has no credit (e.g. testing before
// the Nigerian-card billing issue is resolved), then flip AI_PROVIDER
// back to "anthropic" for production -- no redeploy of the calling
// functions needed, just a secret update.

export interface AIGenerateResult {
  text: string;
}

export interface AIGenerateOptions {
  maxTokens?: number;
  // When true, asks the provider to constrain output to valid JSON where
  // the provider supports it (Gemini). Anthropic has no equivalent flag
  // at this simple call shape, so callers must keep instructing "respond
  // with ONLY JSON" in the prompt either way, and keep parsing
  // defensively (strip code fences) since neither provider guarantees
  // clean output on every call.
  jsonMode?: boolean;
}

export async function generateAIText(prompt: string, opts: AIGenerateOptions = {}): Promise<AIGenerateResult> {
  const provider = (Deno.env.get("AI_PROVIDER") ?? "anthropic").toLowerCase();
  const maxTokens = opts.maxTokens ?? 4000;

  if (provider === "gemini") {
    return generateWithGemini(prompt, maxTokens, opts.jsonMode ?? false);
  }
  if (provider !== "anthropic") {
    throw new Error(`Unknown AI_PROVIDER "${provider}" -- expected "anthropic" or "gemini"`);
  }
  return generateWithAnthropic(prompt, maxTokens);
}

async function generateWithAnthropic(prompt: string, maxTokens: number): Promise<AIGenerateResult> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `Anthropic request failed with status ${res.status}`);
  }

  const data = await res.json();
  return { text: data.content?.[0]?.text ?? "" };
}

async function generateWithGemini(prompt: string, maxTokens: number, jsonMode: boolean): Promise<AIGenerateResult> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  // Overridable in case a specific Gemini model needs to be pinned later
  // (free-tier model availability shifts fairly often).
  const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          ...(jsonMode ? { responseMimeType: "application/json" } : {}),
        },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `Gemini request failed with status ${res.status}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new Error("Gemini response was cut off at the token limit -- try a shorter input or raise maxTokens.");
  }
  const text = candidate?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  return { text };
}
