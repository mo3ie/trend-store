import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/apiAuth";
import { db, buyCard, provider } from "@/lib/cards";
import { anisEnabled } from "@/lib/anis";

export async function GET() {
  const { data } = await db.from("card_products").select("id,name,brand,region,category,face_value,price,image,provider_note").eq("active", true).or("provider_available.is.null,provider_available.eq.true").order("sort").order("brand").order("price");
  return NextResponse.json({ products: data || [], instant: !!provider() || anisEnabled() });
}

// POST { product_id, qty }
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "سجّل الدخول" }, { status: 401 });
  const { product_id, qty } = await req.json().catch(() => ({}));
  try {
    return NextResponse.json({ success: true, ...(await buyCard(user.id, String(product_id || ""), Math.round(Number(qty) || 1))) });
  } catch (e) {
    const m = (e as Error).message;
    if (m === "INSUFFICIENT") return NextResponse.json({ error: "رصيد المحفظة غير كافي", code: "INSUFFICIENT" }, { status: 402 });
    return NextResponse.json({ error: m }, { status: 400 });
  }
}
