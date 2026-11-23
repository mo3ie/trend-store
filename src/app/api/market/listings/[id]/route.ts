import { NextRequest, NextResponse } from "next/server";
import { getUser, requireAdmin } from "@/lib/apiAuth";
import { db, maskName, settings, CONDITIONS } from "@/lib/market";

type Params = Promise<{ id: string }>;

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  const { data: l } = await db.from("market_listings").select("*").eq("id", id).maybeSingle();
  if (!l) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  const user = await getUser().catch(() => null);
  const owner = user?.id === l.seller_id;
  if (!["active", "reserved", "sold"].includes(l.status) && !owner && !(await requireAdmin()).ok) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  const { data: prof } = await db.from("profiles").select("full_name,created_at").eq("id", l.seller_id).maybeSingle();
  const { count: sold } = await db.from("market_orders").select("id", { count: "exact", head: true }).eq("seller_id", l.seller_id).eq("status", "completed");
  let report = null;
  if (l.diag_report_id) {
    const { data: r } = await db.from("device_reports").select("id,score,created_at").eq("id", l.diag_report_id).maybeSingle();
    report = r;
  }
  if (!owner) db.from("market_listings").update({ views: (l.views || 0) + 1 }).eq("id", id).then(() => {});
  const s = await settings();
  const { seller_id: _s, ...pub } = l; void _s;
  return NextResponse.json({
    listing: owner ? l : pub, owner,
    seller: { name: maskName(prof?.full_name), since: prof?.created_at || null, completed_sales: sold || 0 },
    report, protection_days: s.protection_days,
  });
}

// PATCH: owner edits (back to review) or removes the listing
export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const { id } = await params;
  const { data: l } = await db.from("market_listings").select("seller_id,status").eq("id", id).maybeSingle();
  if (!l || l.seller_id !== user.id) return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (b.remove) {
    if (!["pending", "active", "rejected"].includes(l.status)) return NextResponse.json({ error: "ما تقدرش تحذفه الآن (عليه طلب)" }, { status: 409 });
    await db.from("market_listings").update({ status: "removed" }).eq("id", id);
    return NextResponse.json({ success: true });
  }
  if (!["pending", "active", "rejected"].includes(l.status)) return NextResponse.json({ error: "ما تقدرش تعدّله الآن" }, { status: 409 });
  const patch: Record<string, unknown> = { status: "pending", reject_reason: null, updated_at: new Date().toISOString() };
  if (b.title) patch.title = String(b.title).slice(0, 100);
  if (Number(b.price) > 0) patch.price = Math.round(Number(b.price));
  if (CONDITIONS[b.condition]) patch.condition = b.condition;
  if (typeof b.description === "string") patch.description = b.description.slice(0, 2000);
  if (Array.isArray(b.images)) patch.images = b.images.filter((u: unknown) => typeof u === "string" && /^https:\/\//.test(u)).slice(0, 8);
  await db.from("market_listings").update(patch).eq("id", id);
  return NextResponse.json({ success: true });
}
