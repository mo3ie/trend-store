import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/authUser";
import { aiComplete, hasAI } from "@/services/ai";

type Img = { url: string; thumb: string; source: string; title?: string; license?: string };

// How many to pull from each provider per page. Six providers × 24 ≈ 140 candidates
// per page before de-duplication, which is what "make the library huge" needs.
const PER_SOURCE = 24;

const UA = "trend-store/1.0 (+https://www.trendstore-ly.com)";

// ── Query preparation ────────────────────────────────────────────────────────

const hasArabic = (s: string) => /[؀-ۿ]/.test(s);

// Stock libraries are indexed in English, so an Arabic query returns near-random
// results. Translating first is the single biggest accuracy win. Cached for the
// life of the serverless instance — the same searches repeat constantly.
const translationCache = new Map<string, string>();

async function toEnglishQuery(q: string): Promise<string> {
  if (!hasArabic(q) || !hasAI()) return q;
  const hit = translationCache.get(q);
  if (hit) return hit;
  try {
    const out = await aiComplete({
      system: "You translate short product/photo search queries into English keywords for a stock-photo search. Reply with ONLY the English keywords, no punctuation, no explanation, at most 6 words.",
      user: q,
      maxTokens: 30,
      temperature: 0,
    });
    const en = out.replace(/["'\n]/g, " ").trim().slice(0, 80);
    if (!en) return q;
    translationCache.set(q, en);
    return en;
  } catch {
    return q;   // translation is an optimisation, never a hard dependency
  }
}

// ── Providers ────────────────────────────────────────────────────────────────
// Every provider returns [] on any failure: one dead source must never empty the
// whole result set.

async function fromPexels(q: string, page: number): Promise<Img[]> {
  const key = (process.env.PEXELS_API_KEY || "").trim();
  if (!key) return [];
  try {
    const r = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${PER_SOURCE}&page=${page}`,
      { headers: { Authorization: key }, cache: "no-store" });
    if (!r.ok) return [];
    const d = await r.json() as { photos?: Array<{ alt?: string; src?: { large?: string; medium?: string; tiny?: string } }> };
    return (d.photos || []).map((p) => ({
      url: p.src?.large || p.src?.medium || "",
      thumb: p.src?.tiny || p.src?.medium || "",
      source: "pexels", title: p.alt,
    })).filter((x) => x.url);
  } catch { return []; }
}

async function fromUnsplash(q: string, page: number): Promise<Img[]> {
  const key = (process.env.UNSPLASH_ACCESS_KEY || "").trim();
  if (!key) return [];
  try {
    const r = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=${PER_SOURCE}&page=${page}`,
      { headers: { Authorization: `Client-ID ${key}` }, cache: "no-store" });
    if (!r.ok) return [];
    const d = await r.json() as { results?: Array<{ alt_description?: string; urls?: { regular?: string; small?: string; thumb?: string } }> };
    return (d.results || []).map((p) => ({
      url: p.urls?.regular || p.urls?.small || "",
      thumb: p.urls?.thumb || p.urls?.small || "",
      source: "unsplash", title: p.alt_description || undefined,
    })).filter((x) => x.url);
  } catch { return []; }
}

async function fromPixabay(q: string, page: number): Promise<Img[]> {
  const key = (process.env.PIXABAY_KEY || "").trim();
  if (!key) return [];
  try {
    const r = await fetch(
      `https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(q)}&per_page=${PER_SOURCE}&page=${page}&image_type=photo&safesearch=true`,
      { cache: "no-store" });
    if (!r.ok) return [];
    const d = await r.json() as { hits?: Array<{ tags?: string; largeImageURL?: string; webformatURL?: string; previewURL?: string }> };
    return (d.hits || []).map((p) => ({
      url: p.largeImageURL || p.webformatURL || "",
      thumb: p.previewURL || p.webformatURL || "",
      source: "pixabay", title: p.tags,
    })).filter((x) => x.url);
  } catch { return []; }
}

// Openverse — ~600M openly-licensed images, no API key required.
async function fromOpenverse(q: string, page: number): Promise<Img[]> {
  try {
    const r = await fetch(
      `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=${PER_SOURCE}&page=${page}&mature=false`,
      { headers: { "User-Agent": UA }, cache: "no-store" });
    if (!r.ok) return [];
    const d = await r.json() as { results?: Array<{ url?: string; thumbnail?: string; title?: string; license?: string }> };
    return (d.results || []).map((p) => ({
      url: p.url || "", thumb: p.thumbnail || p.url || "",
      source: "openverse", title: p.title, license: p.license,
    })).filter((x) => x.url);
  } catch { return []; }
}

// Wikimedia Commons — no key. Strong on real branded products and landmarks,
// which is exactly where the stock libraries are weakest.
async function fromWikimedia(q: string, page: number): Promise<Img[]> {
  try {
    const offset = (page - 1) * PER_SOURCE;
    const r = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}` +
      `&gsrnamespace=6&gsrlimit=${PER_SOURCE}&gsroffset=${offset}&prop=imageinfo&iiprop=url&iiurlwidth=600&format=json&origin=*`,
      { headers: { "User-Agent": UA }, cache: "no-store" });
    if (!r.ok) return [];
    const d = await r.json() as {
      query?: { pages?: Record<string, { title?: string; imageinfo?: Array<{ url?: string; thumburl?: string }> }> };
    };
    const pages = Object.values(d.query?.pages || {});
    return pages.map((p) => {
      const info = p.imageinfo?.[0];
      return {
        url: info?.thumburl || info?.url || "",
        thumb: info?.thumburl || info?.url || "",
        source: "wikimedia",
        title: (p.title || "").replace(/^File:/, ""),
      };
    }).filter((x) => x.url && /\.(jpe?g|png|webp)$/i.test(x.url.split("?")[0]));
  } catch { return []; }
}

// Flickr — optional key, adds a very large real-world photo pool.
async function fromFlickr(q: string, page: number): Promise<Img[]> {
  const key = (process.env.FLICKR_API_KEY || "").trim();
  if (!key) return [];
  try {
    const r = await fetch(
      `https://www.flickr.com/services/rest/?method=flickr.photos.search&api_key=${key}` +
      `&text=${encodeURIComponent(q)}&per_page=${PER_SOURCE}&page=${page}&license=1,2,3,4,5,6,9,10` +
      `&sort=relevance&safe_search=1&content_type=1&extras=url_l,url_m,url_t&format=json&nojsoncallback=1`,
      { cache: "no-store" });
    if (!r.ok) return [];
    const d = await r.json() as { photos?: { photo?: Array<{ title?: string; url_l?: string; url_m?: string; url_t?: string }> } };
    return (d.photos?.photo || []).map((p) => ({
      url: p.url_l || p.url_m || "", thumb: p.url_t || p.url_m || "",
      source: "flickr", title: p.title,
    })).filter((x) => x.url);
  } catch { return []; }
}

// Interleave so results from every source appear near the top, then de-duplicate.
function interleave(lists: Img[][]): Img[] {
  const out: Img[] = [];
  let i = 0, added = true;
  while (added) {
    added = false;
    for (const l of lists) { if (l[i]) { out.push(l[i]); added = true; } }
    i++;
  }
  const seen = new Set<string>();
  return out.filter((x) => (seen.has(x.url) ? false : (seen.add(x.url), true)));
}

/**
 * GET ?q= &page= — search real photos across every configured provider.
 *
 * Openverse and Wikimedia need no key and are always on, so the search works even
 * with nothing configured. Pexels, Unsplash, Pixabay and Flickr join in as their
 * keys are set. An Arabic query is translated to English first.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ images: [] });
  const page = Math.max(1, Math.min(20, Number(req.nextUrl.searchParams.get("page") || 1) || 1));

  const query = await toEnglishQuery(q);

  const lists = await Promise.all([
    fromPexels(query, page),
    fromUnsplash(query, page),
    fromPixabay(query, page),
    fromOpenverse(query, page),
    fromWikimedia(query, page),
    fromFlickr(query, page),
  ]);

  const images = interleave(lists);
  return NextResponse.json({
    images,
    page,
    query,
    translated: query !== q ? query : null,
    // The UI shows "load more" only while a page comes back reasonably full.
    hasMore: images.length >= PER_SOURCE,
    sources: ["pexels", "unsplash", "pixabay", "openverse", "wikimedia", "flickr"]
      .filter((s, i) => lists[i].length > 0),
  });
}
