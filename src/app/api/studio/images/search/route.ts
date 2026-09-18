import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/authUser";

type Img = { url: string; thumb: string; source: string };

async function fromPexels(q: string): Promise<Img[]> {
  const key = (process.env.PEXELS_API_KEY || "").trim();
  if (!key) return [];
  try {
    const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=12&orientation=square`, { headers: { Authorization: key }, cache: "no-store" });
    if (!r.ok) return [];
    const d = await r.json() as { photos?: Array<{ src?: { large?: string; medium?: string; tiny?: string } }> };
    return (d.photos || []).map((p) => ({ url: p.src?.large || p.src?.medium || "", thumb: p.src?.tiny || p.src?.medium || "", source: "pexels" })).filter((x) => x.url);
  } catch { return []; }
}

async function fromUnsplash(q: string): Promise<Img[]> {
  const key = (process.env.UNSPLASH_ACCESS_KEY || "").trim();
  if (!key) return [];
  try {
    const r = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=12&orientation=squarish`, { headers: { Authorization: `Client-ID ${key}` }, cache: "no-store" });
    if (!r.ok) return [];
    const d = await r.json() as { results?: Array<{ urls?: { regular?: string; small?: string; thumb?: string } }> };
    return (d.results || []).map((p) => ({ url: p.urls?.regular || p.urls?.small || "", thumb: p.urls?.thumb || p.urls?.small || "", source: "unsplash" })).filter((x) => x.url);
  } catch { return []; }
}

async function fromPixabay(q: string): Promise<Img[]> {
  const key = (process.env.PIXABAY_KEY || "").trim();
  if (!key) return [];
  try {
    const r = await fetch(`https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(q)}&per_page=12&image_type=photo&safesearch=true`, { cache: "no-store" });
    if (!r.ok) return [];
    const d = await r.json() as { hits?: Array<{ largeImageURL?: string; webformatURL?: string; previewURL?: string }> };
    return (d.hits || []).map((p) => ({ url: p.largeImageURL || p.webformatURL || "", thumb: p.previewURL || p.webformatURL || "", source: "pixabay" })).filter((x) => x.url);
  } catch { return []; }
}

// Interleave arrays so results from every source appear near the top.
function interleave(lists: Img[][]): Img[] {
  const out: Img[] = []; let i = 0; let added = true;
  while (added) {
    added = false;
    for (const l of lists) { if (l[i]) { out.push(l[i]); added = true; } }
    i++;
  }
  const seen = new Set<string>();
  return out.filter((x) => (seen.has(x.url) ? false : (seen.add(x.url), true)));
}

// GET ?q= — search real photos across every configured provider (Pexels, Unsplash,
// Pixabay). Add whichever free keys you have; results are merged.
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const anyKey = ["PEXELS_API_KEY", "UNSPLASH_ACCESS_KEY", "PIXABAY_KEY"].some((k) => (process.env[k] || "").trim());
  if (!anyKey) return NextResponse.json({ error: "no_key", message: "بحث الصور غير مُفعّل — أضف مفتاح Pexels أو Unsplash أو Pixabay المجاني" }, { status: 503 });

  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ images: [] });

  const [px, un, pb] = await Promise.all([fromPexels(q), fromUnsplash(q), fromPixabay(q)]);
  return NextResponse.json({ images: interleave([px, un, pb]) });
}
