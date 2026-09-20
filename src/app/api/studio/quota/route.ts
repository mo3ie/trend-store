import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import { TOPUP, addExtra, getQuota } from "@/lib/studioQuota";
import { UNIT_COST_USD } from "@/services/studioImages";

/**
 * GET  — this month's paid-AI allowance, usage and top-up prices.
 * POST { kind: "images" | "videos" } — buy one extra pack from the wallet.
 *
 * A pack tops up the CURRENT window only. Renewing the subscription starts a new
 * window with the plan's allowance again, so packs never accumulate silently.
 */

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  return NextResponse.json({ quota: await getQuota(user.id), topup: TOPUP, unit_cost_usd: UNIT_COST_USD });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const kind = b.kind === "videos" ? "videos" : "images";
  const pack = TOPUP[kind];

  const state = await getQuota(user.id);
  if (!state.subscriptionId && !state.unlimited) {
    return NextResponse.json({
      error: "no_subscription",
      message: "الباقات الإضافية تُضاف إلى اشتراك فعّال — اشترك في «الموظف الذكي» أولاً.",
    }, { status: 402 });
  }

  const { data: wallet } = await supabaseAdmin
    .from("wallets").select("balance").eq("user_id", user.id).maybeSingle();
  const balance = Number(wallet?.balance ?? 0);
  if (balance < pack.price_lyd) {
    return NextResponse.json({
      error: "insufficient_balance", message: "رصيد المحفظة غير كافٍ",
      balance, price: pack.price_lyd,
    }, { status: 402 });
  }

  const nowIso = new Date().toISOString();
  await supabaseAdmin.from("wallets")
    .update({ balance: balance - pack.price_lyd, updated_at: nowIso })
    .eq("user_id", user.id);

  const quota = await addExtra(user.id, kind, pack.amount);

  await supabaseAdmin.from("subscription_payments").insert({
    user_id: user.id, subscription_id: state.subscriptionId, product: "studio",
    amount_lyd: pack.price_lyd, provider: "wallet", status: "success",
    kind: "topup", quota_kind: kind,
  });

  return NextResponse.json({ quota, added: pack.amount, charged: pack.price_lyd, balance: balance - pack.price_lyd });
}
