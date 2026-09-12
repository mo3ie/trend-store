// AI reply generation for the comment bot (Claude Messages API, via plain fetch —
// no SDK dependency). Used only when a page has ai_enabled and no keyword rule
// matched the comment. If ANTHROPIC_API_KEY is unset, the caller falls back to the
// keyword rules, so AI is strictly additive.

const AI_MODEL = process.env.BOT_AI_MODEL || "claude-sonnet-5";

export function aiAvailable(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || "").trim();
}

// Generates a short private-reply body for a customer comment, in the commenter's
// language, using the page's persona as brand voice. Returns null on any failure so
// the bot degrades gracefully instead of replying with garbage.
export async function generateAiReply(
  comment: string,
  persona: string | null,
  pageName?: string | null
): Promise<string | null> {
  const key = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!key || !comment.trim()) return null;

  const system = [
    persona?.trim() ||
      `You are a helpful sales assistant for the Facebook page "${pageName || "our store"}".`,
    "You are replying privately to someone who commented on a Facebook post.",
    "Rules: reply in the SAME language as the comment (Arabic → Arabic, Libyan dialect is fine).",
    "Keep it under 45 words, warm and concrete. Never invent prices, stock, or delivery",
    "details you were not given — if you don't know, ask the customer for what you need",
    "or tell them a representative will follow up. No greetings boilerplate, no emojis spam.",
  ].join(" ");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type":      "application/json",
        "x-api-key":         key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      AI_MODEL,
        max_tokens: 300,
        system,
        messages:   [{ role: "user", content: comment }],
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;

    const data = await res.json() as { content?: Array<{ type: string; text?: string }> };
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text || "")
      .join("")
      .trim();
    return text || null;
  } catch {
    return null;
  }
}
