import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserTier } from "@/lib/adsPricing";
import { searchCities, searchInterests } from "@/services/meta";
import { aiComplete, hasAI, parseJsonReply } from "@/services/ai";

async function getUser() {
  const store = await cookies();
  const anon = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => store.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await anon.auth.getUser();
  return user;
}

// POST — VIP-only. Body: { description }. Claude suggests targeting; we resolve the
// suggested city/interest NAMES to real Meta keys/ids and return a ready-to-apply spec.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const tier = await getUserTier(user.id);
  if (tier !== "vip") return NextResponse.json({ error: "المساعد الذكي متاح لعملاء VIP فقط", code: "vip_only" }, { status: 403 });

  if (!hasAI()) return NextResponse.json({ error: "المساعد الذكي غير متاح حالياً" }, { status: 503 });

  const { description } = await req.json();
  if (!description || !String(description).trim()) return NextResponse.json({ error: "صف جمهورك المستهدف" }, { status: 400 });

  const system = [
    "You are a Facebook Ads targeting expert for advertisers in LIBYA.",
    "Given the advertiser's description of their product/audience, propose a targeting spec.",
    "Return ONLY a JSON object, no prose, with this exact shape:",
    '{"ageMin":number,"ageMax":number,"gender":"all"|"male"|"female",',
    '"cities":[string],"interests":[string],"summary":string}',
    "cities: 1-5 Libyan city names (English spelling, e.g. Tripoli, Benghazi, Misrata) — [] means all Libya.",
    "interests: 2-8 broad Facebook interest names in ENGLISH (e.g. Online shopping, Cosmetics, Real estate).",
    "ageMin 13-65, ageMax 13-65. summary: one short Arabic sentence explaining the choice.",
  ].join(" ");

  let parsed: { ageMin?: number; ageMax?: number; gender?: string; cities?: string[]; interests?: string[]; summary?: string };
  try {
    const text = await aiComplete({ system, user: String(description).slice(0, 1000), maxTokens: 600, temperature: 0.5 });
    parsed = parseJsonReply(text);
  } catch {
    return NextResponse.json({ error: "تعذّر تفسير اقتراح المساعد، حاول بوصف أوضح" }, { status: 502 });
  }

  // Resolve names → Meta keys/ids (best-effort, first match each).
  const cityNames     = Array.isArray(parsed.cities) ? parsed.cities.slice(0, 5) : [];
  const interestNames = Array.isArray(parsed.interests) ? parsed.interests.slice(0, 8) : [];

  const [cityLists, interestLists] = await Promise.all([
    Promise.all(cityNames.map((n) => searchCities(String(n)).catch(() => []))),
    Promise.all(interestNames.map((n) => searchInterests(String(n)).catch(() => []))),
  ]);

  const cities = cityLists.map((l) => l[0]).filter(Boolean).map((c) => ({ key: c!.key, name: c!.name, region: c!.region }));
  const seen = new Set<string>();
  const interests = interestLists.map((l) => l[0]).filter(Boolean)
    .filter((i) => (seen.has(i!.id) ? false : (seen.add(i!.id), true)))
    .map((i) => ({ id: i!.id, name: i!.name }));

  const clampAge = (v: unknown, d: number) => Math.max(13, Math.min(65, Number(v) || d));

  return NextResponse.json({
    ageMin:  clampAge(parsed.ageMin, 18),
    ageMax:  clampAge(parsed.ageMax, 45),
    gender:  parsed.gender === "male" || parsed.gender === "female" ? parsed.gender : "all",
    cities,
    interests,
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
  });
}
