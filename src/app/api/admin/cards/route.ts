import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { db, provider, fulfillManually, refundCardOrder } from "@/lib/cards";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const [{ data: products }, { data: pending }, { data: recent }] = await Promise.all([
    db.from("card_products").select("*").order("region").order("sort").order("brand").order("price"),
    db.from("card_orders").select("id,user_id,qty,total,created_at,card_products(name)").eq("status", "pending").order("created_at"),
    db.from("card_orders").select("id,qty,total,status,created_at,card_products(name)").order("created_at", { ascending: false }).limit(40),
  ]);
  const ids = [...new Set((pending || []).map((o) => o.user_id))];
  const { data: profs } = ids.length ? await db.from("profiles").select("id,full_name,phone").in("id", ids) : { data: [] };
  const pm = new Map((profs || []).map((p) => [p.id, p]));
  const prov = provider();
  return NextResponse.json({
    products: products || [], recent: recent || [],
    pending: (pending || []).map((o) => ({ ...o, customer: pm.get(o.user_id) || null })),
    provider: prov ? { name: prov.name, balance: await prov.balance?.().catch(() => null) ?? null } : null,
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
    if (b.action === "refund") { await refundCardOrder(b.order_id, String(b.reason || "استرجاع من الإدارة")); return NextResponse.json({ success: true }); }
    return NextResponse.json({ error: "unknown" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
