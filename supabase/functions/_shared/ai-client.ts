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
  // Currently unused by both providers -- kept for future use. Neither
  // Anthropic nor Gemini's OpenAI-compatible path is used with a strict
  // JSON-schema mode here (see generateWithGemini for why); callers must
  // keep instructing "respond with ONLY JSON" in the prompt and parsing
  // defensively (stripping code fences) either way.
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

async function generateWithGemini(prompt: string, maxTokens: number, _jsonMode: boolean): Promise<AIGenerateResult> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  // Overridable in case a specific Gemini model needs to be pinned later
  // (free-tier model availability shifts fairly often).
  const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";

  // Google is migrating Google AI Studio keys from the classic "standard"
  // format (AIzaSy...) to a Bearer-token "authorization key" format
  // (AQ....). The old generateContent REST path (?key=...) rejects AQ.
  // keys on most accounts as of mid-2026. Google's OpenAI-compatible
  // endpoint accepts a Bearer token for BOTH key formats, so we call that
  // instead -- this works regardless of which format a given account was
  // issued.
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
      // Deliberately no response_format override: the quiz-generation
      // prompt expects a raw JSON array at the top level, which OpenAI-
      // style "json_object" mode is not guaranteed to preserve. Both
      // callers already instruct "respond with ONLY JSON" in the prompt
      // and parse defensively (stripping code fences), matching the
      // Anthropic path's behavior exactly.
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `Gemini request failed with status ${res.status}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  return { text };
}
