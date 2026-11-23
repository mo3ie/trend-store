import { NextResponse } from "next/server";
import { getUser } from "@/lib/apiAuth";
import { db } from "@/lib/market";

// GET: my marketplace orders (as buyer and as seller)
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const sel = "id,listing_id,buyer_id,seller_id,price,seller_payout,status,delivery,created_at,confirm_deadline,market_listings(title,images)";
  const [{ data: bought }, { data: sold }] = await Promise.all([
    db.from("market_orders").select(sel).eq("buyer_id", user.id).order("created_at", { ascending: false }),
    db.from("market_orders").select(sel).eq("seller_id", user.id).order("created_at", { ascending: false }),
  ]);
  return NextResponse.json({ bought: bought || [], sold: sold || [] });
}
