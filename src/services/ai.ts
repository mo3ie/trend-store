// Unified AI text completion. Picks the cheapest configured provider so the
// whole app (ad-copy, AI targeting, the reply bot) can run on a near-zero-cost
// open model instead of Claude:
//   1. Groq   (GROQ_API_KEY)   — free/near-zero, OpenAI-compatible, Llama 3.3 70B
//   2. Gemini (GEMINI_API_KEY) — generous free tier, Gemini Flash
//   3. Claude (ANTHROPIC_API_KEY) — original fallback
// Returns the model's text, or throws. `hasAI()` reports whether any provider is
// configured (callers 503 / fall back when not).

type Provider = "groq" | "gemini" | "anthropic";

function pickProvider(): { provider: Provider; key: string } | null {
  const groq = (process.env.GROQ_API_KEY || "").trim();
  if (groq) return { provider: "groq", key: groq };
  const gemini = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
  if (gemini) return { provider: "gemini", key: gemini };
  const anthropic = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (anthropic) return { provider: "anthropic", key: anthropic };
  return null;
}

export function hasAI(): boolean {
  return pickProvider() !== null;
}

export interface AIParams {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}

export async function aiComplete(params: AIParams): Promise<string> {
  const chosen = pickProvider();
  if (!chosen) throw new Error("no_ai_provider");
  const maxTokens = params.maxTokens ?? 800;
  const temperature = params.temperature ?? 0.7;

  if (chosen.provider === "groq") {
    const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${chosen.key}` },
      body: JSON.stringify({
        model, max_tokens: maxTokens, temperature,
        messages: [{ role: "system", content: params.system }, { role: "user", content: params.user }],
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`groq_${res.status}`);
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    return (data.choices?.[0]?.message?.content || "").trim();
  }

  if (chosen.provider === "gemini") {
    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(chosen.key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: params.system }] },
        contents: [{ role: "user", parts: [{ text: params.user }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature },
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`gemini_${res.status}`);
    const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
  }

  // anthropic
  const model = process.env.BOT_AI_MODEL || "claude-sonnet-5";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": chosen.key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model, max_tokens: maxTokens, system: params.system,
      messages: [{ role: "user", content: params.user }],
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`anthropic_${res.status}`);
  const data = await res.json() as { content?: Array<{ type: string; text?: string }> };
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text || "").join("").trim();
}

// Extract a JSON object from a model reply that may be fenced or prefixed.
export function parseJsonReply<T>(text: string): T {
  const stripped = text.replace(/^```json\s*|^```\s*|\s*```$/gm, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  const slice = start >= 0 && end > start ? stripped.slice(start, end + 1) : stripped;
  return JSON.parse(slice) as T;
}
