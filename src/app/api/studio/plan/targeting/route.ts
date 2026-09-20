import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import { aiComplete, hasAI, parseJsonReply } from "@/services/ai";
import { searchCities, searchInterests } from "@/services/meta";

export const maxDuration = 60;

/**
 * POST { postId, cities? } — work out the ad targeting for ONE post.
 *
 * The owner should not have to describe their audience: the post already says
 * what it is selling. A women's perfume post gets a women's perfume audience,
 * derived from the caption, the linked catalog product and the brand profile.
 *
 * Cities stay the owner's call — they know their delivery range better than any
 * model — so a `cities` list passed in overrides the AI's choice and everything
 * else is filled in. The Arabic `note` is what the UI shows so the owner can see
 * exactly what was decided on their behalf before any money is spent.
 *
 * This only proposes and stores. Nothing is charged until the post is published
 * with boosting on.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  if (!hasAI()) return NextResponse.json({ error: "المساعد الذكي غير متاح حالياً" }, { status: 503 });

  const b = await req.json().catch(() => ({}));
  const postId = String(b.postId || "");
  const ownCities: string[] = Array.isArray(b.cities) ? b.cities.map(String).filter(Boolean).slice(0, 5) : [];
  if (!postId) return NextResponse.json({ error: "postId مطلوب" }, { status: 400 });

  const { data: post } = await supabaseAdmin
    .from("studio_posts").select("id, caption, hashtags, post_type, product_id, page_id")
    .eq("id", postId).eq("user_id", user.id).maybeSingle();
  if (!post) return NextResponse.json({ error: "المنشور غير موجود" }, { status: 404 });

  // Everything the model needs to understand what this post sells.
  const [{ data: product }, { data: brand }] = await Promise.all([
    post.product_id
      ? supabaseAdmin.from("studio_products").select("name, category, price_text, description").eq("id", post.product_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin.from("studio_brands").select("brand_name, tone, extra").eq("user_id", user.id).eq("page_id", post.page_id).maybeSingle(),
  ]);

  const context = [
    product ? `Product: ${product.name}${product.category ? ` (category: ${product.category})` : ""}${product.price_text ? `, price ${product.price_text}` : ""}` : "",
    product?.description ? `Product details: ${product.description}` : "",
    brand?.brand_name ? `Business: ${brand.brand_name}` : "",
    brand?.extra ? `About the business: ${String(brand.extra).slice(0, 400)}` : "",
    post.post_type ? `Post type: ${post.post_type}` : "",
    `Post caption (Arabic): ${post.caption || ""}`,
    post.hashtags ? `Hashtags: ${post.hashtags}` : "",
  ].filter(Boolean).join("\n").slice(0, 1600);

  const system = [
    "You are a Facebook Ads strategist for advertisers in LIBYA. Budgets are in USD.",
    "You are given ONE social post. Infer who should see its ad from the post itself —",
    "a women's perfume post targets women interested in beauty and fragrance, a phone",
    "accessory post targets a broader tech-interested audience, and so on.",
    "Return ONLY a JSON object, no prose, with this exact shape:",
    '{"ageMin":number,"ageMax":number,"gender":"all"|"male"|"female","cities":[string],',
    '"interests":[string],"budgetUsd":number,"days":number,"note":string}',
    "cities: 1-5 Libyan city names in English (Tripoli, Benghazi, Misrata, …); [] means all Libya.",
    "interests: 2-8 broad Facebook interest names in ENGLISH.",
    "ageMin/ageMax between 13 and 65. budgetUsd 3-100. days 1-30.",
    "note: 2-3 short ARABIC sentences telling the advertiser WHO you chose to target and WHY,",
    "phrased for a shop owner, not a marketer.",
  ].join(" ");

  let parsed: {
    ageMin?: number; ageMax?: number; gender?: string; cities?: string[];
    interests?: string[]; budgetUsd?: number; days?: number; note?: string;
  };
  try {
    parsed = parseJsonReply(await aiComplete({ system, user: context, maxTokens: 800, temperature: 0.4 }));
  } catch {
    return NextResponse.json({ error: "تعذّر تحديد الاستهداف — حاول مرة أخرى" }, { status: 502 });
  }

  // The owner's own cities win; otherwise use what the model proposed.
  const cityNames = ownCities.length > 0
    ? ownCities
    : (Array.isArray(parsed.cities) ? parsed.cities.slice(0, 5) : []);
  const interestNames = Array.isArray(parsed.interests) ? parsed.interests.slice(0, 8) : [];

  // Names mean nothing to Meta — resolve them to real keys/ids, best effort each.
  const [cityLists, interestLists] = await Promise.all([
    Promise.all(cityNames.map((n) => searchCities(String(n)).catch(() => []))),
    Promise.all(interestNames.map((n) => searchInterests(String(n)).catch(() => []))),
  ]);
  const cities = cityLists.map((l) => l[0]).filter(Boolean).map((c) => ({ key: c!.key, name: c!.name }));
  const seen = new Set<string>();
  const interests = interestLists.map((l) => l[0]).filter(Boolean)
    .filter((i) => (seen.has(i!.id) ? false : (seen.add(i!.id), true)))
    .map((i) => ({ id: i!.id, name: i!.name }));

  const clampAge = (v: unknown, d: number) => Math.max(13, Math.min(65, Number(v) || d));
  const targeting = {
    ageMin: clampAge(parsed.ageMin, 18),
    ageMax: clampAge(parsed.ageMax, 45),
    gender: parsed.gender === "male" || parsed.gender === "female" ? parsed.gender : "all",
    cities,
    interests,
    citiesFromOwner: ownCities.length > 0,
    budgetUsd: Math.max(3, Math.min(100, Math.round(Number(parsed.budgetUsd) || 10))),
    days: Math.max(1, Math.min(30, Math.round(Number(parsed.days) || 5))),
  };
  const note = typeof parsed.note === "string" ? parsed.note : "";

  await supabaseAdmin.from("studio_posts")
    .update({ boost_targeting: targeting, boost_targeting_note: note })
    .eq("id", post.id);

  return NextResponse.json({ targeting, note });
}
