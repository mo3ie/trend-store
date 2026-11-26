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
  pageName?: string | null,
  catalog?: string | null,
  /**
   * Where this answer will actually appear.
   *
   * It was hard-coded as "replying privately ... on a Facebook post", and TikTok
   * reuses this function for a reply that is neither private nor on Facebook —
   * it is posted publicly, under the video, where every future viewer reads it.
   * That is a different piece of writing: shorter, addressed to a room rather
   * than a person, and with nothing in it that assumes privacy. The model was
   * being briefed for the wrong job and doing it well.
   */
  surface?: { platform?: "facebook" | "tiktok"; visibility?: "private" | "public" },
  /**
   * The shop's own facts — address, phone, hours, delivery terms — rendered by
   * `factsBlock`. Without it the bot could only ever promise that someone would
   * follow up, while the answer sat on another screen the merchant had already
   * filled in. See services/shopFacts.ts.
   */
  facts?: string | null,
): Promise<string | null> {
  if (!hasAI() || !comment.trim()) return null;

  const system = [
    persona?.trim() ||
      `You are a helpful sales assistant for the Facebook page "${pageName || "our store"}".`,
    (surface?.visibility ?? "private") === "public"
      ? `You are writing a PUBLIC reply under a ${surface?.platform === "tiktok" ? "TikTok video" : "post"}. Everyone scrolling the comments will read it, not only the person who asked — so answer them directly, but write it so a stranger reading it also learns something about the shop. Never mention prices, codes or links.`
      : "You are replying privately to someone who commented on a Facebook post.",
    "Rules: reply in the SAME language as the comment (Arabic → Arabic, Libyan dialect is fine).",
    "Keep it under 45 words, warm and concrete.",
    facts?.trim()
      ? `These are the shop's OWN facts. Answer from them when the comment asks about any of it — address, phone, opening hours, delivery, policies — and quote them exactly as written. If the comment asks something NOT covered here, say a representative will follow up; never fill a gap yourself:
${facts.trim()}`
      : "",
    catalog
      ? `Use ONLY this live PRICE LIST for prices/availability — quote the exact price when asked, and if an item is marked (نافد) say it's currently out of stock:\n${catalog}\nIf the asked item isn't in the list, ask the customer to clarify or say a rep will follow up.`
      : "Never invent prices, stock, or delivery details you were not given — if you don't know, ask the customer or say a representative will follow up.",
    "No greetings boilerplate, no emoji spam.",
  ].filter(Boolean).join(" ");

  try {
    const text = await aiComplete({ system, user: comment, maxTokens: 300, temperature: 0.6 });
    return text || null;
  } catch {
    return null;
  }
}

/**
 * "Is this comment asking what something costs?" — yes or no, nothing else.
 *
 * The opt-in half of the price gate. The word list in services/priceIntent.ts
 * handles the ordinary phrasings for free and offline; this exists for the ones
 * no list holds — "هل هو غالي؟", "ميزانيتي ٣٠٠٠، يكفي؟", "worth it?" — where the
 * question is about price without containing a price word.
 *
 * Deliberately tiny. It runs on EVERY comment when enabled, against a shared free
 * daily token budget, so: no catalog, no persona, no shop facts, ten output
 * tokens, and the default low reasoning effort. Everything that makes a reply
 * good makes a classifier expensive.
 *
 * Returns null — not false — when there is no provider or the answer is
 * unreadable, so the caller can fall back to the word list instead of treating
 * "could not tell" as "not a price question" and publishing a price.
 */
export async function classifyPriceIntent(comment: string): Promise<boolean | null> {
  if (!hasAI() || !comment.trim()) return null;
  try {
    const text = await aiComplete({
      system:
        "You decide ONE thing: is this social-media comment asking about the PRICE, cost or affordability of a product? " +
        "Comments arrive in Arabic (Libyan, Gulf, Egyptian, Levantine dialects) and English. " +
        "Count as YES: asking a price, asking if something is expensive or cheap, naming a budget, asking about discounts or instalments. " +
        "Count as NO: delivery, location, opening hours, colours, sizes, availability, warranty, compliments, anything else. " +
        "Answer with exactly one word: YES or NO.",
      user: comment.slice(0, 400),
      maxTokens: 10,
      temperature: 0,
    });
    const v = (text || "").trim().toUpperCase();
    if (v.startsWith("YES")) return true;
    if (v.startsWith("NO")) return false;
    return null;
  } catch {
    return null;
  }
}
