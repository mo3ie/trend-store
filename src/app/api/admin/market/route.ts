import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { db, act } from "@/lib/market";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const [{ data: pending }, { data: disputes }, { data: orders }, { data: s }] = await Promise.all([
    db.from("market_listings").select("*").eq("status", "pending").order("created_at"),
    db.from("market_orders").select("*,market_listings(title,images)").eq("status", "disputed").order("updated_at"),
    db.from("market_orders").select("id,price,commission,status,created_at,market_listings(title)").order("created_at", { ascending: false }).limit(50),
    db.from("market_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  const held = (orders || []).filter((o) => ["held", "handed_over", "disputed"].includes(o.status)).reduce((a, o) => a + Number(o.price), 0);
  const earned = (orders || []).filter((o) => o.status === "completed").reduce((a, o) => a + Number(o.commission), 0);
  return NextResponse.json({ pending: pending || [], disputes: disputes || [], orders: orders || [], settings: s, totals: { held, earned } });
}

// { action: approve|reject|settings|resolve_release|resolve_refund, id?, reason?, commission_pct?, protection_days?, min_price? }
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const b = await req.json().catch(() => ({}));
  try {
    if (b.action === "approve" || b.action === "reject") {
      const { data: l } = await db.from("market_listings").update(b.action === "approve" ? { status: "active", reject_reason: null } : { status: "rejected", reject_reason: String(b.reason || "مخالف للشروط").slice(0, 300) })
        .eq("id", b.id).eq("status", "pending").select("seller_id,title").maybeSingle();
      if (l) await db.from("notifications").insert({ user_id: l.seller_id, type: "market", link: `/market/me`,
        title: b.action === "approve" ? "✅ إعلانك انتشر في سوق المستعمل" : "❌ إعلانك ما انقبلش",
        body: b.action === "approve" ? `«${l.title}» صار ظاهر للمشترين.` : `«${l.title}»: ${b.reason || "مخالف للشروط"} — عدّله وأرسله مرة ثانية.` });
      return NextResponse.json({ success: true });
    }
    if (b.action === "settings") {
      const c = Number(b.commission_pct), d = Number(b.protection_days), m = Number(b.min_price);
      if (!(c >= 0 && c <= 30 && d >= 1 && d <= 14 && m >= 1)) return NextResponse.json({ error: "قيم غير منطقية" }, { status: 400 });
      await db.from("market_settings").update({ commission_pct: c, protection_days: d, min_price: m }).eq("id", 1);
      return NextResponse.json({ success: true });
    }
    if (b.action === "resolve_release" || b.action === "resolve_refund") {
      await act(b.id, auth.userId, true, b.action, b.reason);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "unknown" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
