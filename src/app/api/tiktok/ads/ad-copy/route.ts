import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/authUser";
import { aiComplete, hasAI, parseJsonReply } from "@/services/ai";

export const maxDuration = 60;

/**
 * POST { description } — three ad texts for a TikTok Spark Ad.
 *
 * Deliberately not the Facebook copywriter with a different word swapped in: TikTok
 * caps the ad text at 100 characters, which is a quarter of what a Facebook caption
 * allows, and a 300-character suggestion would simply be truncated mid-sentence on
 * the ad. The limit is in the prompt AND enforced on the way out.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  if (!hasAI()) return NextResponse.json({ error: "المساعد الذكي غير متاح حالياً" }, { status: 503 });

  const { description } = await req.json();
  if (!description || !String(description).trim()) {
    return NextResponse.json({ error: "صف منتجك أو عرضك" }, { status: 400 });
  }

  const system = [
    "You are a senior Arabic social-media copywriter writing TIKTOK ad text for advertisers in LIBYA.",
    "Write 3 ad texts in Libyan-friendly Arabic for the advertiser's product/offer.",
    "HARD LIMIT: each text must be UNDER 90 characters including spaces and emojis. TikTok truncates anything longer.",
    "Each: one punchy hook, one implicit call to action, at most 2 emojis. Vary the angle across the three.",
    "Return ONLY a JSON object, no prose, exactly: {\"variations\":[string,string,string]}",
  ].join(" ");

  try {
    const text = await aiComplete({ system, user: String(description).slice(0, 1000), maxTokens: 600 });
    const parsed = parseJsonReply<{ variations?: unknown }>(text);
    const variations = Array.isArray(parsed.variations)
      ? parsed.variations.map((v) => String(v).trim()).filter(Boolean).map((v) => v.slice(0, 100)).slice(0, 3)
      : [];
    if (!variations.length) {
      return NextResponse.json({ error: "تعذّر توليد نصوص، حاول بوصف أوضح" }, { status: 502 });
    }
    return NextResponse.json({ variations, maxChars: 100 });
  } catch {
    return NextResponse.json({ error: "تعذّر توليد النصوص، حاول مجدداً" }, { status: 502 });
  }
}
