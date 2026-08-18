import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyOtp } from "@/lib/mobicash";

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

// POST /api/promo/mobicash-verify
// Body: { campaignId, otp }
// Confirms the MobiCash OTP for a campaign payment, then marks it paid and boosts.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { campaignId, otp } = await req.json();
  if (!campaignId || !otp) return NextResponse.json({ error: "campaignId و otp مطلوبان" }, { status: 400 });

  // The payment_uuid comes from the row written at checkout, not the browser.
  const { data: payment } = await supabaseAdmin
    .from("ad_payments")
    .select("id, provider_session, amount")
    .eq("campaign_id", campaignId)
    .eq("user_id", user.id)
    .eq("provider", "mobicash")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!payment?.provider_session) {
    return NextResponse.json({ error: "لم تبدأ عملية دفع لهذه الحملة" }, { status: 400 });
  }

  const { data: campaign } = await supabaseAdmin
    .from("ad_campaigns")
    .select("id, status")
    .eq("id", campaignId)
    .eq("user_id", user.id)
    .single();
  if (!campaign) return NextResponse.json({ error: "الحملة غير موجودة" }, { status: 404 });
  if (campaign.status !== "pending_payment") {
    return NextResponse.json({ error: "هذه الحملة مدفوعة مسبقًا" }, { status: 400 });
  }

  try {
    await verifyOtp({ paymentUuid: payment.provider_session, otp });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  await supabaseAdmin
    .from("ad_payments")
    .update({ status: "success" })
    .eq("id", payment.id);

  await supabaseAdmin
    .from("ad_campaigns")
    .update({ status: "paid", updated_at: new Date().toISOString() })
    .eq("id", campaignId);

  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://trendstore-ly.com";
  fetch(`${base}/api/promo/boost`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ campaignId }),
  }).catch(() => {});

  return NextResponse.json({ success: true, redirect: `${base}/ads/campaigns?paid=1` });
}
