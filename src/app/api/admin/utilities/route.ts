import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { db, settings, meterPackages, rechargeProducts, settleUtility, settleOpen } from "@/lib/anisUtilities";
import { anisEnabled, anisBalance } from "@/lib/anis";

export const maxDuration = 60;

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (anisEnabled()) await settleOpen(undefined, 8).catch(() => 0);
  const { data: raw } = await db.from("utility_settings").select("*").eq("id", 1).maybeSingle();
  const [s, meter, recharge, balance, { data: open }, { data: recent }] = await Promise.all([
    settings(),
    anisEnabled() ? meterPackages().catch(() => []) : [],
    anisEnabled() ? rechargeProducts().catch(() => []) : [],
    anisEnabled() ? anisBalance().catch(() => null) : null,
    db.from("utility_orders").select("*").in("status", ["processing", "action_needed", "failed"]).order("created_at"),
    db.from("utility_orders").select("id,kind,status,title,target,price,cost,refunded,provider_status,created_at").order("created_at", { ascending: false }).limit(50),
  ]);
  return NextResponse.json({ connected: anisEnabled(), balance, settings: { ...raw, ...s, meter_enabled: !!raw?.meter_enabled, recharge_enabled: !!raw?.recharge_enabled }, meter, recharge, open: open || [], recent: recent || [] });
}

// { action:"save", settings } | { action:"settle", id }
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const b = await req.json().catch(() => ({}));
  if (b.action === "save") {
    const x = b.settings || {};
    const num = (v: unknown, lo: number, hi: number, d: number) => { const n = Number(v); return isFinite(n) && n >= lo && n <= hi ? n : d; };
    await db.from("utility_settings").update({
      meter_enabled: !!x.meter_enabled, meter_markup_pct: num(x.meter_markup_pct, 0, 50, 0), meter_fee: num(x.meter_fee, 0, 50, 0),
      recharge_enabled: !!x.recharge_enabled, recharge_markup_pct: num(x.recharge_markup_pct, 0, 50, 3), recharge_fee: num(x.recharge_fee, 0, 500, 0),
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    return NextResponse.json({ success: true });
  }
  if (b.action === "settle") return NextResponse.json({ success: true, status: await settleUtility(String(b.id)) });
  return NextResponse.json({ error: "unknown" }, { status: 400 });
}
