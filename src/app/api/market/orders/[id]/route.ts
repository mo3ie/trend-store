import { NextRequest, NextResponse } from "next/server";
import { getUser, requireAdmin } from "@/lib/apiAuth";
import { db, getOrder, act, autoComplete, maskName, settings } from "@/lib/market";

type Params = Promise<{ id: string }>;

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const { id } = await params;
  let o = await getOrder(id);
  const isAdmin = (await requireAdmin()).ok;
  if (!o || (o.buyer_id !== user.id && o.seller_id !== user.id && !isAdmin)) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  if (await autoComplete(o as never)) o = await getOrder(id);
  const { data: l } = await db.from("market_listings").select("id,title,images,condition,price").eq("id", o!.listing_id).maybeSingle();
  const { data: msgs } = await db.from("market_messages").select("id,sender_id,is_admin,body,created_at").eq("order_id", id).order("id");
  const { data: profs } = await db.from("profiles").select("id,full_name,phone").in("id", [o!.buyer_id, o!.seller_id]);
  const pm = new Map((profs || []).map((p) => [p.id, p]));
  const role = o!.buyer_id === user.id ? "buyer" : o!.seller_id === user.id ? "seller" : "admin";
  // Phone numbers are shared between the two parties only once the money is held.
  const contact = (uid: string) => ({ name: maskName(pm.get(uid)?.full_name), phone: role !== "admin" && o!.status !== "cancelled" ? pm.get(uid)?.phone || null : pm.get(uid)?.phone || null });
  const s = await settings();
  return NextResponse.json({
    order: o, listing: l, role, protection_days: s.protection_days,
    buyer: contact(o!.buyer_id), seller: contact(o!.seller_id),
    messages: (msgs || []).map((m) => ({ ...m, mine: m.sender_id === user.id, sender_id: undefined })),
  });
}

// POST { action: handover|confirm|dispute|cancel|message|resolve_release|resolve_refund, text? }
export async function POST(req: NextRequest, { params }: { params: Params }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const { id } = await params;
  const { action, text } = await req.json().catch(() => ({}));
  const isAdmin = (await requireAdmin()).ok;
  try {
    await act(id, user.id, isAdmin, String(action || ""), typeof text === "string" ? text : undefined);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
