import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getProvider } from "@/services/payments";

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

  const { campaignId, method, phone } = await req.json();
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
    const boostUrl = `${base}/api/ads/boost`;
    fetch(boostUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId }),
    }).catch(() => {});

    return NextResponse.json({ success: true, redirect: `${base}/ads/campaigns?paid=1` });
  }

  // External payment (DPay)
  try {
    const provider = getProvider(method);
    const session  = await provider.createSession({
      amount:      campaign.total_price,
      campaignId,
      userId:      user.id,
      method,
      phone,
      callbackUrl: `${base}/api/ads/webhook`,
      returnUrl:   `${base}/ads/campaigns?paid=1`,
    });

    // Record pending payment
    await supabaseAdmin.from("ad_payments").insert({
      user_id:          user.id,
      campaign_id:      campaignId,
      amount:           campaign.total_price,
      provider:         method,
      provider_session: session.sessionId,
      status:           "pending",
    });

    return NextResponse.json({ paymentLink: session.paymentLink, sessionId: session.sessionId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ في الدفع";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
