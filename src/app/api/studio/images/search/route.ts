import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/authUser";

// GET ?q= — search real high-quality photos from Pexels (free API key).
// Set PEXELS_API_KEY in env to enable. Returns { images: [{ url, thumb }] }.
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const key = (process.env.PEXELS_API_KEY || "").trim();
  if (!key) return NextResponse.json({ error: "no_key", message: "بحث الصور غير مُفعّل — أضف مفتاح Pexels المجاني" }, { status: 503 });

  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ images: [] });

  try {
    const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=15&orientation=square`, {
      headers: { Authorization: key }, cache: "no-store",
    });
    if (!r.ok) return NextResponse.json({ error: "search_failed" }, { status: 502 });
    const data = await r.json() as { photos?: Array<{ src?: { large?: string; medium?: string; tiny?: string } }> };
    const images = (data.photos || []).map((p) => ({ url: p.src?.large || p.src?.medium || "", thumb: p.src?.tiny || p.src?.medium || "" })).filter((x) => x.url);
    return NextResponse.json({ images });
  } catch {
    return NextResponse.json({ error: "search_failed" }, { status: 502 });
  }
}
