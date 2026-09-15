// AI reply generation for the comment bot. Uses the unified AI provider
// (Groq → Gemini → Claude, see services/ai.ts) so replies run on a near-zero-cost
// open model. Used only when a page has ai_enabled and no keyword rule matched the
// comment. If no provider is configured, the caller falls back to the keyword
// rules, so AI is strictly additive.

import { aiComplete, hasAI } from "@/services/ai";

export function aiAvailable(): boolean {
  return hasAI();
}

// Generates a short private-reply body for a customer comment, in the commenter's
// language, using the page's persona as brand voice. Returns null on any failure so
// the bot degrades gracefully instead of replying with garbage.
export async function generateAiReply(
  comment: string,
  persona: string | null,
  pageName?: string | null
): Promise<string | null> {
  if (!hasAI() || !comment.trim()) return null;

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
    const text = await aiComplete({ system, user: comment, maxTokens: 300, temperature: 0.6 });
    return text || null;
  } catch {
    return null;
  }
}
