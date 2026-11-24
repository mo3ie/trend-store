import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/apiAuth";
import { db, settleOpen } from "@/lib/anisUtilities";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  await settleOpen(user.id, 5).catch(() => 0); // move any open order forward first
  const kind = req.nextUrl.searchParams.get("kind");
  let q = db.from("utility_orders").select("id,kind,status,title,target,price,refunded,result,error,created_at,request").eq("user_id", user.id);
  if (kind === "meter" || kind === "recharge") q = q.eq("kind", kind);
  const { data } = await q.order("created_at", { ascending: false }).limit(60);
  return NextResponse.json({ orders: (data || []).map(({ request, ...o }) => ({ ...o, product_id: (request as { productId?: string })?.productId || null })) });
}
