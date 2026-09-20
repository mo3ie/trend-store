import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import { MAX_TOPUP_QTY, addExtra, getQuota } from "@/lib/studioQuota";
import { UNIT_COST_USD } from "@/services/studioImages";

/**
 * GET  — this month's allowance, what is left, and what one extra pack costs.
 * POST { qty } — buy `qty` extra packs from the wallet.
 *
 * A pack mirrors the buyer's own plan, so a VIP purchase tops up images and video
 * while a medium purchase tops up images alone, and a basic plan sells no pack at
 * all. Quantity multiplies everything: 3 VIP packs = 300 LYD = 300 images + 30
 * videos. Packs top up the CURRENT month only — renewal starts a fresh window, so
 * they never quietly accumulate.
 */

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const quota = await getQuota(user.id);
  return NextResponse.json({ quota, maxQty: MAX_TOPUP_QTY, unit_cost_usd: UNIT_COST_USD });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const qty = Math.max(1, Math.min(MAX_TOPUP_QTY, Math.floor(Number(b.qty) || 1)));

  const state = await getQuota(user.id);
  if (!state.subscriptionId) {
    return NextResponse.json({
      error: "no_subscription",
      message: "الباقات الإضافية تُضاف إلى اشتراك فعّال — اشترك في «الموظف الذكي» أولاً.",
    }, { status: 402 });
  }
  if (!state.pack.available) {
    return NextResponse.json({
      error: "not_available",
      message: "باقتك الحالية لا تشمل شراء كميات إضافية — رقِّ باقتك للاستفادة من هذه الميزة.",
    }, { status: 402 });
  }

  const price = state.pack.price_lyd * qty;
  const { data: wallet } = await supabaseAdmin
    .from("wallets").select("balance").eq("user_id", user.id).maybeSingle();
  const balance = Number(wallet?.balance ?? 0);
  if (balance < price) {
    return NextResponse.json({
      error: "insufficient_balance", message: "رصيد المحفظة غير كافٍ", balance, price,
    }, { status: 402 });
  }

  await supabaseAdmin.from("wallets")
    .update({ balance: balance - price, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  const images = state.pack.images * qty;
  const videos = state.pack.videos * qty;
  const quota = await addExtra(user.id, images, videos);

  await supabaseAdmin.from("subscription_payments").insert({
    user_id: user.id, subscription_id: state.subscriptionId, product: "studio",
    amount_lyd: price, provider: "wallet", status: "success",
    kind: "topup", quota_kind: videos > 0 ? "images+videos" : "images",
  });

  return NextResponse.json({
    quota, qty, addedImages: images, addedVideos: videos,
    charged: price, balance: balance - price,
  });
}
