import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/apiAuth";
import { buy } from "@/lib/market";

// POST { listing_id, delivery } — pays from the wallet into escrow.
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "سجّل الدخول باش تشتري" }, { status: 401 });
  const { listing_id, delivery } = await req.json().catch(() => ({}));
  try {
    const r = await buy(String(listing_id || ""), user.id, String(delivery || "store"));
    return NextResponse.json({ success: true, ...r });
  } catch (e) {
    const m = (e as Error).message;
    if (m === "INSUFFICIENT") return NextResponse.json({ error: "رصيد المحفظة غير كافي", code: "INSUFFICIENT" }, { status: 402 });
    return NextResponse.json({ error: m }, { status: 409 });
  }
}
