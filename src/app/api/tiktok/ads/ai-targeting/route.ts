import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/authUser";
import { requireAdsContext } from "@/lib/tiktokAdsContext";
import { getTikTokUserTier, MIN_DAILY_USD, minTotalUsd } from "@/lib/tiktokAdsPricing";
import { searchLocations, searchInterestCategories } from "@/services/tiktokAdsCampaigns";
import { aiComplete, hasAI, parseJsonReply } from "@/services/ai";

export const maxDuration = 60;

/**
 * POST { description } — the AI targeting assistant, TikTok edition.
 *
 * Same idea as the Facebook one, but the prompt is not shared and should not be:
 * TikTok's audience skews younger, its budgets start an order of magnitude higher
 * (the platform floor), and advice tuned for Facebook would hand the advertiser a
 * budget TikTok rejects. The model is told the floor so its suggestion is legal by
 * construction, and the result is clamped to it regardless of what comes back.
 *
 * The suggested location and interest NAMES are then resolved to real TikTok ids, so
 * what returns is applicable as-is rather than a paragraph to retype.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const tier = await getTikTokUserTier(user.id);
  if (tier !== "vip") {
    return NextResponse.json({
      error: "vip_only", message: "المساعد الذكي متاح لمشتركي إعلانات تيك توك فقط",
    }, { status: 403 });
  }
  if (!hasAI()) return NextResponse.json({ error: "المساعد الذكي غير متاح حالياً" }, { status: 503 });

  const { description, advertiserId } = await req.json();
  if (!description || !String(description).trim()) {
    return NextResponse.json({ error: "صف جمهورك المستهدف" }, { status: 400 });
  }

  const ctx = await requireAdsContext(user.id, advertiserId);
  if (!ctx.ok) return ctx.res;

  const system = [
    "You are a TikTok Ads strategist for advertisers in LIBYA. Budgets are in USD.",
    `TikTok enforces a MINIMUM spend of $${MIN_DAILY_USD} per day, so a campaign of N days needs at least $${MIN_DAILY_USD}*N in total. Never suggest less.`,
    "TikTok's Libyan audience skews 18-34 and is video-first; favour broad interest categories over narrow ones, because narrow targeting on TikTok starves delivery.",
    "Given the advertiser's product/goal, propose: audience targeting + a legal budget & duration + expected results.",
    "Return ONLY a JSON object, no prose, with this exact shape:",
    '{"ageMin":number,"ageMax":number,"gender":"all"|"male"|"female","locations":[string],"interests":[string],',
    '"objective":"reach"|"video_views"|"traffic"|"engagement"|"followers","budgetUsd":number,"days":number,"expected":string,"message":string}',
    "locations: 1-5 Libyan city or region names in ENGLISH (e.g. Tripoli, Benghazi, Misrata) — [] means all Libya.",
    "interests: 2-6 broad TikTok interest category names in ENGLISH (e.g. Beauty & Personal Care, Apparel & Accessories, Electronics).",
    "ageMin 13-65, ageMax 13-65. days: 3-30.",
    "expected: one short ARABIC sentence of realistic expected results for that budget on TikTok in Libya.",
    "message: 2-3 short ARABIC sentences explaining your recommendation warmly, and say plainly that TikTok's minimum daily spend is why the budget starts where it does.",
  ].join(" ");

  let parsed: {
    ageMin?: number; ageMax?: number; gender?: string; locations?: string[]; interests?: string[];
    objective?: string; budgetUsd?: number; days?: number; expected?: string; message?: string;
  };
  try {
    const text = await aiComplete({ system, user: String(description).slice(0, 1000), maxTokens: 900, temperature: 0.5 });
    parsed = parseJsonReply(text);
  } catch {
    return NextResponse.json({ error: "تعذّر تفسير اقتراح المساعد، حاول بوصف أوضح" }, { status: 502 });
  }

  const locationNames = Array.isArray(parsed.locations) ? parsed.locations.slice(0, 5) : [];
  const interestNames = Array.isArray(parsed.interests) ? parsed.interests.slice(0, 6) : [];

  // Resolved in parallel, each failure tolerated: a suggestion missing one interest is
  // still usable, while a hard failure here would waste the whole AI call.
  const [locLists, intLists] = await Promise.all([
    Promise.all(locationNames.map((n) =>
      searchLocations(ctx.ctx.token, ctx.ctx.advertiserId, String(n)).catch(() => []))),
    Promise.all(interestNames.map((n) =>
      searchInterestCategories(ctx.ctx.token, ctx.ctx.advertiserId, String(n)).catch(() => []))),
  ]);

  const seenLoc = new Set<string>();
  const locations = locLists.map((l) => l[0]).filter(Boolean)
    .filter((l) => (seenLoc.has(l!.id) ? false : (seenLoc.add(l!.id), true)))
    .map((l) => ({ id: l!.id, name: l!.name }));

  const seenInt = new Set<string>();
  const interests = intLists.map((l) => l[0]).filter(Boolean)
    .filter((i) => (seenInt.has(i!.id) ? false : (seenInt.add(i!.id), true)))
    .map((i) => ({ id: i!.id, name: i!.name }));

  const clampAge = (v: unknown, d: number) => Math.max(13, Math.min(65, Number(v) || d));
  const days = Math.max(3, Math.min(30, Math.round(Number(parsed.days) || 7)));
  const floor = minTotalUsd(days);
  const OBJECTIVES = ["reach", "video_views", "traffic", "engagement", "followers"];

  return NextResponse.json({
    ageMin: clampAge(parsed.ageMin, 18),
    ageMax: clampAge(parsed.ageMax, 34),
    gender: parsed.gender === "male" || parsed.gender === "female" ? parsed.gender : "all",
    locations,
    interests,
    objective: OBJECTIVES.includes(String(parsed.objective)) ? parsed.objective : "video_views",
    // The floor wins over the model, always.
    budgetUsd: Math.max(floor, Math.min(2000, Math.round(Number(parsed.budgetUsd) || floor))),
    days,
    minTotalUsd: floor,
    expected: typeof parsed.expected === "string" ? parsed.expected : "",
    message: typeof parsed.message === "string" ? parsed.message : "",
  });
}
