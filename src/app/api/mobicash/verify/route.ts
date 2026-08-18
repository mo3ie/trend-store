import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { verifyOtp } from "@/lib/mobicash";

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

// POST /api/mobicash/verify
// Body: { order_id, otp }
// Confirms the MobiCash charge with the customer's OTP, then marks the order paid.
export async function POST(req: NextRequest) {
  const { data: { user } } = await getUser(req);
  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { order_id, otp } = await req.json();
  if (!order_id || !otp) return NextResponse.json({ error: "order_id و otp مطلوبان" }, { status: 400 });

  const { data: order, error: orderErr } = await supabaseAdmin
    .from("store_orders")
    .select("id, user_id, dpay_session_id, payment_status")
    .eq("id", order_id)
    .eq("user_id", user.id)
    .single();
  if (orderErr || !order) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  if (order.payment_status === "paid") {
    return NextResponse.json({ error: "هذا الطلب مدفوع مسبقًا" }, { status: 400 });
  }

  // The payment_uuid was stashed as JSON in dpay_session_id at initiate.
  let session: { provider?: string; paymentUuid?: string; expiresAt?: string } = {};
  try { session = JSON.parse(order.dpay_session_id || "{}"); } catch { /* not a mobicash session */ }
  if (session.provider !== "mobicash" || !session.paymentUuid) {
    return NextResponse.json({ error: "لم تبدأ عملية الدفع لهذا الطلب" }, { status: 400 });
  }
  if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
    return NextResponse.json({ error: "انتهت صلاحية جلسة الدفع (5 دقائق)، يرجى إعادة المحاولة" }, { status: 400 });
  }

  try {
    const tx = await verifyOtp({ paymentUuid: session.paymentUuid, otp });

    await supabaseAdmin
      .from("store_orders")
      .update({
        payment_status: "paid",
        status: "processing",
        dpay_session_id: null, // single-use — clear it once confirmed
      })
      .eq("id", order_id);

    return NextResponse.json({ success: true, reference: tx.bankReference });
  } catch (err) {
    const e = err as Error;
    console.error(`[mobicash/verify] order ${order_id}:`, e.message);
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
