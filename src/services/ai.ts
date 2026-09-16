// Unified AI text completion. Picks the cheapest configured provider so the
// whole app (ad-copy, AI targeting, the reply bot) can run on a near-zero-cost
// open model instead of Claude:
//   1. Groq   (GROQ_API_KEY)   — free/near-zero, OpenAI-compatible, Llama 3.3 70B
//   2. Gemini (GEMINI_API_KEY) — generous free tier, Gemini Flash
//   3. Claude (ANTHROPIC_API_KEY) — original fallback
// Returns the model's text, or throws. `hasAI()` reports whether any provider is
// configured (callers 503 / fall back when not).

type Provider = "groq" | "gemini" | "anthropic";

// All configured providers, in cost order. aiComplete tries them in turn so a bad
// key / rate limit / outage on one falls through to the next instead of failing.
function configuredProviders(): { provider: Provider; key: string }[] {
  const list: { provider: Provider; key: string }[] = [];
  const groq = (process.env.GROQ_API_KEY || "").trim();
  if (groq) list.push({ provider: "groq", key: groq });
  const gemini = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
  if (gemini) list.push({ provider: "gemini", key: gemini });
  const anthropic = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (anthropic) list.push({ provider: "anthropic", key: anthropic });
  return list;
}

export function hasAI(): boolean {
  return configuredProviders().length > 0;
}

export interface AIParams {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}

async function callProvider(p: { provider: Provider; key: string }, params: AIParams, maxTokens: number, temperature: number): Promise<string> {
  if (p.provider === "groq") {
    // Default to an open model this account actually has access to. (Groq accounts
    // vary; this one exposes openai/gpt-oss-* + qwen + allam, not Llama.)
    const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${p.key}` },
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

  if (p.provider === "gemini") {
    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(p.key)}`, {
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
    return (data.candidates?.[0]?.content?.parts || []).map((x) => x.text || "").join("").trim();
  }

  // anthropic
  const model = process.env.BOT_AI_MODEL || "claude-sonnet-5";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": p.key, "anthropic-version": "2023-06-01" },
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

export async function aiComplete(params: AIParams): Promise<string> {
  const providers = configuredProviders();
  if (providers.length === 0) throw new Error("no_ai_provider");
  const maxTokens = params.maxTokens ?? 800;
  const temperature = params.temperature ?? 0.7;

  let lastErr: unknown;
  for (const p of providers) {
    try {
      const out = await callProvider(p, params, maxTokens, temperature);
      if (out) return out;
      lastErr = new Error(`${p.provider}_empty`);
    } catch (e) {
      lastErr = e; // try the next provider (bad key, rate limit, outage)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("ai_failed");
}

// Extract a JSON object from a model reply that may be fenced or prefixed.
export function parseJsonReply<T>(text: string): T {
  const stripped = text.replace(/^```json\s*|^```\s*|\s*```$/gm, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  const slice = start >= 0 && end > start ? stripped.slice(start, end + 1) : stripped;
  return JSON.parse(slice) as T;
}
