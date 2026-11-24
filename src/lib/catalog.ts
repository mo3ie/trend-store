import { createClient } from "@supabase/supabase-js";

/**
 * A compact, cached view of the storefront catalog for the AI features
 * (assistant, hologram picks, diagnosis suggestions). Server-only.
 * Never exposes stock numbers — customers don't see stock limits.
 */
export type CatalogItem = {
  id: string;
  name: string;
  price: number;
  category: string;
  image_url: string | null;
  inStock: boolean;
  has3d: boolean;
  created_at: string;
};

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

let cache: { at: number; items: CatalogItem[] } | null = null;
const TTL = 5 * 60 * 1000;

export async function getCatalog(): Promise<CatalogItem[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.items;
  const { data } = await db
    .from("products")
    .select("id,name,price,category,image_url,quantity,stock,created_at,spin_images,model_url")
    .gt("quantity", 0) // sold-out products don't exist for customers (Trendy never suggests them)
    .order("created_at", { ascending: false })
    .limit(600);
  const items: CatalogItem[] = (data || []).map((p: Record<string, unknown>) => ({
    id: String(p.id),
    name: String(p.name || ""),
    price: Number(p.price) || 0,
    category: String(p.category || ""),
    image_url: (p.image_url as string) || null,
    inStock: Number(p.quantity ?? p.stock ?? 0) > 0,
    has3d: !!p.model_url || (Array.isArray(p.spin_images) && p.spin_images.length > 0),
    created_at: String(p.created_at || ""),
  }));
  cache = { at: Date.now(), items };
  return items;
}

/** Cheap keyword pre-filter so the AI only sees relevant products. */
export function shortlist(items: CatalogItem[], text: string, max = 40): CatalogItem[] {
  const words = text.toLowerCase().split(/[\s,.،؟?!]+/).filter((w) => w.length > 1);
  const scored = items.map((p) => {
    const hay = `${p.name} ${p.category}`.toLowerCase();
    let s = 0;
    for (const w of words) if (hay.includes(w)) s += w.length;
    if (p.inStock) s += 0.5;
    return { p, s };
  });
  scored.sort((a, b) => b.s - a.s);
  const hits = scored.filter((x) => x.s > 0.5).map((x) => x.p);
  // Not enough matches → pad with in-stock newest items so the AI can still suggest.
  const pad = items.filter((p) => p.inStock && !hits.includes(p));
  return [...hits, ...pad].slice(0, max);
}

/** Simple per-key rate limit (per server instance). */
const hits = new Map<string, number[]>();
export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}
