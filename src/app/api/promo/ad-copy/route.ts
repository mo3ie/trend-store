import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
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

// POST — Body: { description }. Claude writes 3 Arabic ad-caption variations the
// advertiser can copy into their post before boosting. (Boosting an existing post
// can't change its text via the API, so these are copy-ready suggestions.)
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  if (!hasAI()) return NextResponse.json({ error: "المساعد الذكي غير متاح حالياً" }, { status: 503 });

  const { description } = await req.json();
  if (!description || !String(description).trim()) return NextResponse.json({ error: "صف منتجك أو عرضك" }, { status: 400 });

  const system = [
    "You are a senior Arabic social-media copywriter for advertisers in LIBYA.",
    "Write 3 short, punchy Facebook ad captions (Libyan-friendly Arabic) for the advertiser's product/offer.",
    "Each caption: 1-3 lines, a clear hook, one call to action, and 2-4 relevant emojis. Vary the angle across the three.",
    "Return ONLY a JSON object, no prose, exactly: {\"variations\":[string,string,string]}",
  ].join(" ");

  try {
    const text = await aiComplete({ system, user: String(description).slice(0, 1000), maxTokens: 900 });
    const parsed = parseJsonReply<{ variations?: unknown }>(text);
    const variations = Array.isArray(parsed.variations)
      ? parsed.variations.map((v) => String(v)).filter((v) => v.trim()).slice(0, 3)
      : [];
    if (variations.length === 0) return NextResponse.json({ error: "تعذّر توليد نصوص، حاول بوصف أوضح" }, { status: 502 });
    return NextResponse.json({ variations });
  } catch {
    return NextResponse.json({ error: "تعذّر توليد النصوص، حاول مجدداً" }, { status: 502 });
  }
}
