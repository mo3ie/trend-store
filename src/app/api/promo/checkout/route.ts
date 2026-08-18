import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { initiateCardPayment } from "@/lib/mobicash";

async function getUser() {
  const store = await cookies();
  const anon = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => store.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await anon.auth.getUser();
  return user;
}

// POST — create payment session for a campaign
// Body: { campaignId, method, phone? }
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { campaignId, method, phone, cardNumber } = await req.json();
  if (!campaignId || !method) {
    return NextResponse.json({ error: "campaignId و method مطلوبان" }, { status: 400 });
  }

  // Load campaign and verify ownership
  const { data: campaign } = await supabaseAdmin
    .from("ad_campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("user_id", user.id)
    .single();

  if (!campaign) return NextResponse.json({ error: "الحملة غير موجودة" }, { status: 404 });
  if (campaign.status !== "pending_payment") {
    return NextResponse.json({ error: "هذه الحملة مدفوعة مسبقًا" }, { status: 400 });
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://trendstore-ly.com";

  // Wallet payment — deduct directly
  if (method === "wallet") {
    const { data: wallet } = await supabaseAdmin
      .from("wallets")
      .select("balance")
      .eq("user_id", user.id)
      .single();

    if (!wallet || wallet.balance < campaign.total_price) {
      return NextResponse.json({ error: "رصيد المحفظة غير كافٍ" }, { status: 400 });
    }

    // Deduct from wallet
    await supabaseAdmin
      .from("wallets")
      .update({ balance: wallet.balance - campaign.total_price })
      .eq("user_id", user.id);

    // Record payment
    await supabaseAdmin.from("ad_payments").insert({
      user_id:    user.id,
      campaign_id: campaignId,
      amount:     campaign.total_price,
      provider:   "wallet",
      status:     "success",
    });

    // Mark paid and trigger boost
    await supabaseAdmin
      .from("ad_campaigns")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", campaignId);

    // Trigger boost async (fire-and-forget from client side)
    const boostUrl = `${base}/api/promo/boost`;
    fetch(boostUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId }),
    }).catch(() => {});

    return NextResponse.json({ success: true, redirect: `${base}/ads/campaigns?paid=1` });
  }

  // MobiCash card payment — charge the card, bank sends the customer an OTP,
  // which /api/promo/mobicash-verify confirms before the campaign is boosted.
  if (method === "mobicash") {
    if (!cardNumber) return NextResponse.json({ error: "رقم البطاقة مطلوب" }, { status: 400 });

    // Drop any earlier unconfirmed attempt for this campaign so only one
    // pending payment_uuid is ever live.
    await supabaseAdmin
      .from("ad_payments")
      .delete()
      .eq("campaign_id", campaignId)
      .eq("user_id", user.id)
      .eq("provider", "mobicash")
      .eq("status", "pending");

    try {
      const { paymentUuid } = await initiateCardPayment({
        cardNumber,
        amount: Number(campaign.total_price),
        description: `Trend Ads campaign ${campaignId}`,
      });

      const { error: payErr } = await supabaseAdmin.from("ad_payments").insert({
        user_id:          user.id,
        campaign_id:      campaignId,
        amount:           campaign.total_price,
        provider:         "mobicash",
        provider_session: paymentUuid,
        status:           "pending",
      });
      if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 });

      return NextResponse.json({ mobicash: true });
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "طريقة الدفع غير متاحة، يرجى استخدام المحفظة" }, { status: 400 });
}
