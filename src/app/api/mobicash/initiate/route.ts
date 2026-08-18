import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { initiateCardPayment } from "@/lib/mobicash";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function getUser(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => req.cookies.get(n)?.value, set: () => {}, remove: () => {} } },
  ).auth.getUser();
}

// POST /api/mobicash/initiate
// Body: { order_id, cardNumber }
// Charges the customer's MobiCash card — the bank sends them an OTP — and
// stashes the returned payment_uuid on the order until /verify confirms it.
export async function POST(req: NextRequest) {
  const { data: { user } } = await getUser(req);
  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { order_id, cardNumber } = await req.json();
  if (!order_id)   return NextResponse.json({ error: "order_id مطلوب" }, { status: 400 });
  if (!cardNumber) return NextResponse.json({ error: "رقم البطاقة مطلوب" }, { status: 400 });

  // Verify the order belongs to this user, and charge the stored total — never
  // an amount supplied by the browser.
  const { data: order, error: orderErr } = await supabaseAdmin
    .from("store_orders")
    .select("id, user_id, total, payment_status")
    .eq("id", order_id)
    .eq("user_id", user.id)
    .single();
  if (orderErr || !order) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  if (order.payment_status === "paid") {
    return NextResponse.json({ error: "هذا الطلب مدفوع مسبقًا" }, { status: 400 });
  }

  try {
    const { paymentUuid, expiresAt } = await initiateCardPayment({
      cardNumber,
      amount: Number(order.total),
      description: `Trend Store order ${order_id}`,
    });

    // Persist the payment_uuid between the two calls. We reuse the retired
    // dpay_session_id column (DPay is disabled) — stored as JSON, same as Yusor.
    const session = JSON.stringify({ provider: "mobicash", paymentUuid, expiresAt });
    const { error: updErr } = await supabaseAdmin
      .from("store_orders")
      .update({ dpay_session_id: session, payment_method: "mobicash" })
      .eq("id", order_id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ success: true, expiresAt });
  } catch (err) {
    const e = err as Error;
    console.error(`[mobicash/initiate] order ${order_id}:`, e.message);
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
