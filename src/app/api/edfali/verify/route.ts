import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { onlineConfTrans } from "@/lib/adfali";
import { notifyUser, NOTICES } from "@/lib/notify";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getUser(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => req.cookies.get(n)?.value, set: () => {}, remove: () => {} } }
  ).auth.getUser();
}

// POST /api/edfali/verify
// Body: { order_id, otp }
// Confirms the bank session that /initiate stored on the caller's own order.
// The session id is read from the order, never from the request: otherwise a
// session paid for a small amount could be used to mark a large order paid.
export async function POST(req: NextRequest) {
  const { data: { user } } = await getUser(req);
  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  try {
    const { otp, order_id } = await req.json();
    if (!order_id || !otp) {
      return NextResponse.json({ error: "order_id و otp مطلوبان" }, { status: 400 });
    }

    const { data: order } = await supabaseAdmin
      .from("store_orders")
      .select("id, dpay_session_id, payment_status")
      .eq("id", order_id)
      .eq("user_id", user.id)
      .single();
    if (!order) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
    if (order.payment_status === "paid") return NextResponse.json({ success: true });

    let session: { edfali?: string } = {};
    try { session = JSON.parse(order.dpay_session_id || "{}"); } catch { /* not an edfali session */ }
    if (!session.edfali) return NextResponse.json({ error: "لم تبدأ عملية الدفع لهذا الطلب" }, { status: 400 });

    await onlineConfTrans(session.edfali, String(otp));

    await supabaseAdmin
      .from("store_orders")
      .update({ payment_status: "paid", status: "processing", dpay_session_id: null })
      .eq("id", order_id);
    { const n = NOTICES.orderPayment(String(order_id), "paid"); if (n) await notifyUser(user.id, n); }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
