import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DPAY_VERIFY_URL =
  process.env.DPAY_MODE === "Production"
    ? "https://dpay.ly/api/payment/sessions/verify"
    : "https://dpay.ly/api/sandbox/payment/sessions/verify";

async function verifyDPaySession(sessionId: string): Promise<boolean> {
  const res = await fetch(`${DPAY_VERIFY_URL}/${sessionId}`, {
    headers: { Authorization: `Bearer ${process.env.DPAY_TOKEN}` },
    cache: "no-store",
  });
  const data = await res.json();
  return data?.status === "paid" || data?.status === "completed";
}

// POST — DPay payment webhook for ad campaigns
export async function POST(req: NextRequest) {
  const body = await req.json();
  const sessionId = body?.session_id || body?.sessionId || body?.order_id;

  if (!sessionId) return NextResponse.json({ ok: false }, { status: 400 });

  // Find the pending payment by session id
  const { data: payment } = await supabaseAdmin
    .from("ad_payments")
    .select("*")
    .eq("provider_session", sessionId)
    .eq("status", "pending")
    .single();

  if (!payment) return NextResponse.json({ ok: true }); // already processed

  // Verify with DPay
  const paid = await verifyDPaySession(sessionId);
  if (!paid) {
    await supabaseAdmin
      .from("ad_payments")
      .update({ status: "failed" })
      .eq("id", payment.id);
    return NextResponse.json({ ok: false });
  }

  // Mark payment success
  await supabaseAdmin
    .from("ad_payments")
    .update({ status: "success" })
    .eq("id", payment.id);

  // Mark campaign as paid
  await supabaseAdmin
    .from("ad_campaigns")
    .update({ status: "paid", updated_at: new Date().toISOString() })
    .eq("id", payment.campaign_id);

  // Trigger Meta boost async
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://trendstore-ly.com";
  fetch(`${base}/api/ads/boost`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ campaignId: payment.campaign_id }),
  }).catch(() => {});

  console.log("Ad payment success ✅ campaign:", payment.campaign_id);
  return NextResponse.json({ ok: true });
}
