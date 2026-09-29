import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import { hashImageUrl } from "@/lib/imageHash";
import { getPagePosts, getSystemPageToken, type PagePost } from "@/services/meta";

export const maxDuration = 60;

/**
 * The smart catalog behind the bot's per-product answers.
 *
 *   GET    ?pageId=            — the catalog, with its matching metadata
 *   PATCH  { pageId, items }   — edit products (aliases, sku, post bindings)
 *   POST   { pageId, action }  — bulk operations:
 *       "prices"   { text }    — paste "name = price" lines; matches by name/alias
 *       "rehash"              — fingerprint every product image
 *       "autobind"            — bind Page photos to products by name, then by image
 *
 * Bulk price updates match on NAME, and the images stay attached to the product —
 * which is what makes "update the price list and the right picture follows" true
 * without anyone re-uploading anything.
 */

function normalize(s: string): string {
  return (s || "").toLowerCase()
    .replace(/[ً-ْ]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const pageId = req.nextUrl.searchParams.get("pageId");
  if (!pageId) return NextResponse.json({ error: "pageId مطلوب" }, { status: 400 });

  const { data } = await supabaseAdmin
    .from("studio_products")
    .select("id, name, aliases, sku, price_text, price_number, images, image_hashes, post_ids, available, active")
    .eq("user_id", user.id).eq("page_id", pageId)
    .order("name");
  return NextResponse.json({ products: data || [] });
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const items = Array.isArray(b.items) ? b.items : [];
  if (!items.length) return NextResponse.json({ error: "لا عناصر" }, { status: 400 });

  let updated = 0;
  for (const it of items.slice(0, 500)) {
    if (!it?.id) continue;
    const patch: Record<string, unknown> = {};
    for (const k of ["name", "sku", "price_text", "available", "active"]) if (k in it) patch[k] = it[k];
    if (Array.isArray(it.aliases))  patch.aliases  = it.aliases.map(String).filter(Boolean);
    if (Array.isArray(it.post_ids)) patch.post_ids = it.post_ids.map(String).filter(Boolean);
    if (Object.keys(patch).length === 0) continue;
    const { error } = await supabaseAdmin.from("studio_products")
      .update(patch).eq("id", it.id).eq("user_id", user.id);
    if (!error) updated++;
  }
  return NextResponse.json({ updated });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const pageId = String(b.pageId || "");
  const action = String(b.action || "");
  if (!pageId) return NextResponse.json({ error: "pageId مطلوب" }, { status: 400 });

  const { data: products } = await supabaseAdmin
    .from("studio_products")
    .select("id, name, aliases, sku, images, image_hashes, post_ids")
    .eq("user_id", user.id).eq("page_id", pageId).eq("active", true).limit(1000);
  const catalog = products || [];

  // ── Bulk price update from a pasted list ──────────────────────────────────
  if (action === "prices") {
    const text = String(b.text || "");
    const rows = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let updated = 0; const missed: string[] = [];

    for (const row of rows) {
      // "name = price", "name : price", "name , price" or "name <tab> price"
      const m = row.match(/^(.*?)\s*[=:\t،,]\s*(.+)$/);
      if (!m) { missed.push(row); continue; }
      const wanted = normalize(m[1]);
      const price = m[2].trim();
      if (!wanted || !price) { missed.push(row); continue; }

      // Longest name wins, so "iPhone 15 Pro" is not beaten by "iPhone".
      let best: { id: string; len: number } | null = null;
      for (const p of catalog) {
        for (const n of [p.name, ...(p.aliases || []), p.sku || ""].filter(Boolean).map(normalize)) {
          if (n && (n === wanted || wanted === n || n.includes(wanted) || wanted.includes(n))) {
            if (!best || n.length > best.len) best = { id: p.id, len: n.length };
          }
        }
      }
      if (!best) { missed.push(row); continue; }

      const num = parseFloat(price.replace(/[^\d.]/g, ""));
      await supabaseAdmin.from("studio_products")
        .update({ price_text: price, price_number: Number.isFinite(num) ? num : null })
        .eq("id", best.id).eq("user_id", user.id);
      updated++;
    }
    return NextResponse.json({ updated, missed, total: rows.length });
  }

  // ── Fingerprint every catalog image ───────────────────────────────────────
  if (action === "rehash") {
    let hashed = 0;
    for (const p of catalog) {
      const urls = (p.images || []).slice(0, 5);
      if (!urls.length) continue;
      const hashes = (await Promise.all(urls.map((u: string) => hashImageUrl(u)))).filter(Boolean) as string[];
      if (!hashes.length) continue;
      await supabaseAdmin.from("studio_products")
        .update({ image_hashes: hashes }).eq("id", p.id).eq("user_id", user.id);
      hashed++;
    }
    return NextResponse.json({ hashed, total: catalog.length });
  }

  // ── Bind Page photos to products ──────────────────────────────────────────
  // First by the product's name appearing in the post's caption, then — for posts
  // that named nothing — by fingerprinting the post's own picture. The owner fixes
  // whatever it got wrong from the catalog screen.
  if (action === "autobind") {
    const { data: page } = await supabaseAdmin
      .from("connected_pages").select("page_access_token")
      .eq("user_id", user.id).eq("page_id", pageId).maybeSingle();
    const token = (page?.page_access_token as string) || (await getSystemPageToken(pageId)) || undefined;
    if (!token) return NextResponse.json({ error: "تعذّر الوصول لرمز الصفحة — أعد ربط الصفحة" }, { status: 400 });

    const posts = await getPagePosts(pageId, token, 50).catch(() => [] as PagePost[]);
    const bound: Record<string, string[]> = {};
    const unnamed: PagePost[] = [];

    for (const post of posts) {
      const caption = normalize(post.message || "");
      let best: { id: string; len: number } | null = null;
      if (caption) {
        for (const p of catalog) {
          for (const n of [p.name, ...(p.aliases || []), p.sku || ""].filter(Boolean).map(normalize)) {
            if (n.length >= 3 && caption.includes(n) && (!best || n.length > best.len)) best = { id: p.id, len: n.length };
          }
        }
      }
      if (best) (bound[best.id] ||= []).push(post.id);
      else if (post.picture) unnamed.push(post);
    }

    // Posts whose caption named nothing: match the post's own image instead.
    for (const post of unnamed.slice(0, 40)) {
      const hash = await hashImageUrl(post.picture!);
      if (!hash) continue;
      const { closestHash } = await import("@/lib/imageHash");
      let winner: { id: string; distance: number } | null = null;
      for (const p of catalog) {
        const hit = closestHash(hash, p.image_hashes || []);
        if (hit && (!winner || hit.distance < winner.distance)) winner = { id: p.id, distance: hit.distance };
      }
      if (winner) (bound[winner.id] ||= []).push(post.id);
    }

    let updated = 0;
    for (const [productId, postIds] of Object.entries(bound)) {
      const existing = catalog.find((p) => p.id === productId)?.post_ids || [];
      const merged = [...new Set([...existing, ...postIds])];
      await supabaseAdmin.from("studio_products")
        .update({ post_ids: merged }).eq("id", productId).eq("user_id", user.id);
      updated++;
    }
    return NextResponse.json({ bound: updated, posts: posts.length });
  }

  return NextResponse.json({ error: "action غير معروف" }, { status: 400 });
}
