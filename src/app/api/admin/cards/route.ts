import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { db, provider, fulfillManually, refundCardOrder, settleAnis, settlePendingAnis } from "@/lib/cards";
import { anisEnabled, anisBalance, anisCatalogue } from "@/lib/anis";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (anisEnabled()) await settlePendingAnis().catch(() => 0);
  const [{ data: products }, { data: pending }, { data: recent }] = await Promise.all([
    db.from("card_products").select("*").order("region").order("sort").order("brand").order("price"),
    db.from("card_orders").select("id,user_id,qty,total,created_at,provider,provider_state,card_products(name)").eq("status", "pending").order("created_at"),
    db.from("card_orders").select("id,qty,total,status,created_at,card_products(name)").order("created_at", { ascending: false }).limit(40),
  ]);
  const ids = [...new Set((pending || []).map((o) => o.user_id))];
  const { data: profs } = ids.length ? await db.from("profiles").select("id,full_name,phone").in("id", ids) : { data: [] };
  const pm = new Map((profs || []).map((p) => [p.id, p]));
  const prov = provider();
  return NextResponse.json({
    products: products || [], recent: recent || [],
    pending: (pending || []).map((o) => ({ ...o, customer: pm.get(o.user_id) || null })),
    provider: anisEnabled()
      ? await anisBalance().then((b) => ({ name: "أنيس Anis", balance: b ? b.amount : null }), (e) => ({ name: `أنيس Anis — خطأ اتصال: ${(e as Error).message}`, balance: null }))
      : prov ? { name: prov.name, balance: await prov.balance?.().catch(() => null) ?? null } : null,
  });
}

// { action: save, product } | { action: delete, id } | { action: fulfill, order_id, codes: string } | { action: refund, order_id }
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const b = await req.json().catch(() => ({}));
  try {
    if (b.action === "save") {
      const p = b.product || {};
      const row = {
        name: String(p.name || "").slice(0, 80), brand: String(p.brand || "").slice(0, 40),
        region: p.region === "international" ? "international" : "local", category: String(p.category || "mobile").slice(0, 20),
        face_value: String(p.face_value || "").slice(0, 30) || null, price: Number(p.price), image: p.image || null,
        provider_sku: String(p.provider_sku || "").slice(0, 80) || null, active: !!p.active, sort: Number(p.sort) || 0,
      };
      if (!row.name || !row.brand || !(row.price > 0)) return NextResponse.json({ error: "الاسم والماركة والسعر مطلوبين" }, { status: 400 });
      if (p.id) await db.from("card_products").update(row).eq("id", p.id); else await db.from("card_products").insert(row);
      return NextResponse.json({ success: true });
    }
    if (b.action === "delete") { await db.from("card_products").update({ active: false }).eq("id", b.id); return NextResponse.json({ success: true }); }
    if (b.action === "fulfill") {
      const codes = String(b.codes || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => { const [code, serial] = l.split(/[|,]/).map((x) => x.trim()); return { code, ...(serial ? { serial } : {}) }; });
      await fulfillManually(b.order_id, codes);
      return NextResponse.json({ success: true });
    }
    if (b.action === "anis_settle") return NextResponse.json({ success: true, result: await settleAnis(String(b.order_id)) });
    if (b.action === "anis_sync") return NextResponse.json({ success: true, ...(await syncAnis(Number(b.markup))) });
    if (b.action === "refund") { await refundCardOrder(b.order_id, String(b.reason || "استرجاع من الإدارة")); return NextResponse.json({ success: true }); }
    return NextResponse.json({ error: "unknown" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

/**
 * Import/refresh the Anis catalogue. New cards come in INACTIVE with a suggested selling price
 * (Anis retail price if given, else cost + markup%); existing rows only get cost/availability refreshed —
 * the admin's selling price is never overwritten.
 */
async function syncAnis(markupPct: number) {
  const mk = isFinite(markupPct) && markupPct >= 0 && markupPct <= 100 ? markupPct : 5;
  const list = await anisCatalogue();
  const { data: existing } = await db.from("card_products").select("id,provider_sku,price").eq("provider", "anis");
  const have = new Map((existing || []).map((r) => [r.provider_sku, r]));
  let added = 0, updated = 0, loss = 0;
  const now = new Date().toISOString();
  for (const { card, subName, subLogo, type, disclaimer } of list) {
    const cost = card.unitPrice ? Number(card.unitPrice.amount) : null;
    const base = { provider_cost: cost, provider_available: card.available && cost != null, provider_note: disclaimer?.slice(0, 500) || null, provider_synced_at: now };
    const ex = have.get(card.id);
    if (ex) {
      await db.from("card_products").update(base).eq("id", ex.id);
      if (cost != null && Number(ex.price) < cost) loss++;
      updated++;
    } else {
      if (cost == null) continue;
      const retail = card.personalPrice ? Number(card.personalPrice.amount) : 0;
      const price = Math.ceil(Math.max(retail, cost * (1 + mk / 100)) * 4) / 4; // round up to 0.25
      const name = card.name?.ar || card.name?.en || subName || "كرت";
      const cat = /pubg|free ?fire|game|play|xbox|steam|ببجي|فري فاير|ألعاب|العاب/i.test(`${name} ${subName}`) ? "games"
        : /itunes|apple|google|amazon|store|ستور/i.test(`${name} ${subName}`) ? "stores"
        : /netflix|shahid|spotify|osn|شاهد/i.test(`${name} ${subName}`) ? "streaming" : type === "local" ? "mobile" : "other";
      await db.from("card_products").insert({
        provider: "anis", provider_sku: card.id, name: name.slice(0, 80), brand: (subName || card.category?.name?.ar || "Anis").slice(0, 40),
        region: type === "international" ? "international" : "local", category: cat, face_value: card.faceValue?.slice(0, 30) || null,
        price, image: card.logo || subLogo || null, active: false, sort: 100, ...base,
      });
      added++;
    }
  }
  return { total: list.length, added, updated, loss };
}
