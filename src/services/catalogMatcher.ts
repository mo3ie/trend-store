import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { closestHash, hashImageUrl } from "@/lib/imageHash";

/**
 * Works out which catalog product a comment is asking about.
 *
 * A Page posts thirty photos for thirty products and gets hundreds of comments,
 * each about exactly one of them. Answering with the wrong price is worse than not
 * answering, so the signals are tried strongest-first and an ambiguous result is
 * reported as ambiguous rather than resolved by coin-toss.
 *
 *   post   — the comment sits under the product's own photo. Certain, and free.
 *   image  — the commenter attached a picture; its fingerprint matches one of the
 *            product's. Near-certain, and free.
 *   name   — the product's name, an alias, or its SKU appears in the text.
 *
 * Nothing here calls a paid model. The bot's AI runs only when all of this fails.
 */

export interface CatalogProduct {
  id: string;
  name: string;
  aliases: string[] | null;
  sku: string | null;
  price_text: string | null;
  description: string | null;
  images: string[] | null;
  image_hashes: string[] | null;
  post_ids: string[] | null;
  available: boolean | null;
}

export type MatchSignal = "post" | "image" | "name" | "none" | "ambiguous";

export interface MatchResult {
  product: CatalogProduct | null;
  signal: MatchSignal;
  candidates?: CatalogProduct[];   // set when `signal === "ambiguous"`
}

/** Same normalisation the keyword engine uses, so matching behaves consistently. */
function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[ً-ْ]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A post id arrives as "{pageId}_{postId}" or bare; compare both shapes. */
function postIdsMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const tail = (x: string) => (x.includes("_") ? x.split("_")[1] : x);
  return a === b || tail(a) === tail(b);
}

export async function loadCatalog(userId: string, pageId: string): Promise<CatalogProduct[]> {
  const { data } = await supabaseAdmin
    .from("studio_products")
    .select("id, name, aliases, sku, price_text, description, images, image_hashes, post_ids, available")
    .eq("user_id", userId).eq("page_id", pageId).eq("active", true)
    .limit(1000);
  return (data || []) as CatalogProduct[];
}

/**
 * Match by name, alias or SKU.
 *
 * Longer names are tried first so "iPhone 15 Pro" wins over "iPhone" on a comment
 * that mentions both — otherwise the shortest, vaguest product would always win.
 * When two names match at the same length the result is ambiguous, not a guess.
 */
export function matchByName(message: string, catalog: CatalogProduct[]): MatchResult {
  const text = normalize(message);
  if (!text) return { product: null, signal: "none" };

  const hits: { product: CatalogProduct; len: number }[] = [];
  for (const p of catalog) {
    const names = [p.name, ...(p.aliases || []), p.sku || ""].filter(Boolean).map(normalize);
    let best = 0;
    for (const n of names) {
      // Two characters is not a product name, it is a coincidence.
      if (n.length >= 3 && text.includes(n) && n.length > best) best = n.length;
    }
    if (best) hits.push({ product: p, len: best });
  }
  if (hits.length === 0) return { product: null, signal: "none" };

  hits.sort((a, b) => b.len - a.len);
  const top = hits[0];
  const tied = hits.filter((h) => h.len === top.len);
  if (tied.length > 1) {
    return { product: null, signal: "ambiguous", candidates: tied.map((h) => h.product) };
  }
  return { product: top.product, signal: "name" };
}

/** Match by the photo the comment sits under. */
export function matchByPost(postId: string, catalog: CatalogProduct[]): MatchResult {
  if (!postId) return { product: null, signal: "none" };
  const hits = catalog.filter((p) => (p.post_ids || []).some((x) => postIdsMatch(x, postId)));
  if (hits.length === 1) return { product: hits[0], signal: "post" };
  if (hits.length > 1) return { product: null, signal: "ambiguous", candidates: hits };
  return { product: null, signal: "none" };
}

/** Match by fingerprinting an image the commenter attached. */
export async function matchByImage(imageUrl: string, catalog: CatalogProduct[]): Promise<MatchResult> {
  const hash = await hashImageUrl(imageUrl);
  if (!hash) return { product: null, signal: "none" };

  let best: { product: CatalogProduct; distance: number } | null = null;
  for (const p of catalog) {
    const hit = closestHash(hash, p.image_hashes || []);
    if (hit && (!best || hit.distance < best.distance)) best = { product: p, distance: hit.distance };
  }
  return best ? { product: best.product, signal: "image" } : { product: null, signal: "none" };
}

/**
 * Run the enabled signals in order and return the first confident answer.
 *
 * `mode` mirrors what the Page owner chose: "post" | "name" | "image" | "all".
 * An ambiguous result from a strong signal is returned immediately — falling
 * through to a weaker one would turn a known uncertainty into a wrong price.
 */
export async function matchProduct(params: {
  message: string;
  postId: string;
  attachmentUrl?: string | null;
  catalog: CatalogProduct[];
  mode: string;
}): Promise<MatchResult> {
  const { message, postId, attachmentUrl, catalog, mode } = params;
  if (!catalog.length || mode === "off") return { product: null, signal: "none" };

  const usePost  = mode === "all" || mode === "post";
  const useName  = mode === "all" || mode === "name";
  const useImage = mode === "all" || mode === "image";

  if (usePost) {
    const r = matchByPost(postId, catalog);
    if (r.product || r.signal === "ambiguous") return r;
  }
  if (useImage && attachmentUrl) {
    const r = await matchByImage(attachmentUrl, catalog);
    if (r.product) return r;
  }
  if (useName) {
    const r = matchByName(message, catalog);
    if (r.product || r.signal === "ambiguous") return r;
  }
  return { product: null, signal: "none" };
}

/** The private-message body for a matched product. */
export function productReply(p: CatalogProduct): string {
  const price = (p.price_text || "").trim();
  const lines = [
    price ? `${p.name} — ${price}` : p.name,
    p.available === false ? "غير متوفر حالياً ❌" : "",
    (p.description || "").trim(),
  ].filter(Boolean);
  return lines.join("\n");
}
