import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/apiAuth";
import { settings, meterPackages, rechargeProducts, buyMeter, buyRecharge } from "@/lib/anisUtilities";

export const maxDuration = 60;

// GET → what is on sale (meter packages + direct-recharge products) with OUR prices
export async function GET() {
  const s = await settings();
  const [meter, recharge] = await Promise.all([
    s.meter_enabled ? meterPackages().catch(() => []) : [],
    s.recharge_enabled ? rechargeProducts().catch(() => []) : [],
  ]);
  return NextResponse.json({
    meter: { enabled: s.meter_enabled, packages: meter.map(({ cost, retail, ...p }) => (void cost, void retail, p)) },
    recharge: { enabled: s.recharge_enabled, products: recharge.map(({ minTotal, maxTotal, ...p }) => (void minTotal, void maxTotal, p)) },
  });
}

// POST { kind:"meter", package_id, meter_number } | { kind:"recharge", product_id, payout, cost, recipient:[{key,value}] }
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "سجّل الدخول" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  try {
    const r = b.kind === "meter"
      ? await buyMeter(user.id, String(b.package_id || ""), String(b.meter_number || ""))
      : await buyRecharge(user.id, String(b.product_id || ""), String(b.payout || ""), Number(b.cost), Array.isArray(b.recipient) ? b.recipient : []);
    return NextResponse.json({ success: true, ...r });
  } catch (e) {
    const m = (e as Error).message;
    if (m === "INSUFFICIENT") return NextResponse.json({ error: "رصيد المحفظة غير كافي", code: "INSUFFICIENT" }, { status: 402 });
    return NextResponse.json({ error: m }, { status: 400 });
  }
}
