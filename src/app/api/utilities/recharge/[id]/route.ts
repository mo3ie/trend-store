import { NextRequest, NextResponse } from "next/server";
import { settings, rechargeProduct, rechargeQuote } from "@/lib/anisUtilities";

type Params = Promise<{ id: string }>;

// GET → recipient fields (+ list options) ; GET ?amount=…&in=fx|lyd → quote with our price
export async function GET(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  const s = await settings();
  if (!s.recharge_enabled) return NextResponse.json({ error: "الخدمة غير متاحة" }, { status: 404 });
  const amount = req.nextUrl.searchParams.get("amount");
  try {
    if (amount) {
      if (!/^\d+(\.\d{1,3})?$/.test(amount)) return NextResponse.json({ error: "المبلغ غير صحيح" }, { status: 400 });
      const inn = req.nextUrl.searchParams.get("in") === "lyd" ? "lyd" : "fx";
      return NextResponse.json(await rechargeQuote(id, amount, inn));
    }
    return NextResponse.json(await rechargeProduct(id));
  } catch (e) {
    const code = (e as { code?: string }).code;
    const msg = code === "amount_out_of_range" ? "المبلغ خارج الحدود المسموحة" : code === "direct_recharge_product_unavailable" ? "الخدمة غير متاحة حالياً" : "تعذّر الحساب — حاول بعد قليل";
    return NextResponse.json({ error: msg, code }, { status: 400 });
  }
}
