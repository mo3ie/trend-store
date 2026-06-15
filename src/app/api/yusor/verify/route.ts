import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { completeSession } from "@/lib/yusor";

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

// POST /api/yusor/verify
// Body: { order_id, otp }
// Confirms the Yusor sale with the customer's OTP using the merchant token
// stored at initiate, then marks the order paid.
export async function POST(req: NextRequest) {
  const { data: { user } } = await getUser(req);
  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { order_id, otp } = await req.json();
  if (!order_id || !otp) return NextResponse.json({ error: "order_id و otp مطلوبان" }, { status: 400 });

  const { data: order, error: orderErr } = await supabaseAdmin
    .from("store_orders")
    .select("id, user_id, yusor_token, yusor_valid_to")
    .eq("id", order_id)
    .eq("user_id", user.id)
    .single();
  if (orderErr || !order) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  if (!order.yusor_token) return NextResponse.json({ error: "لم تبدأ عملية الدفع لهذا الطلب" }, { status: 400 });
  if (order.yusor_valid_to && new Date(order.yusor_valid_to) < new Date()) {
    return NextResponse.json({ error: "انتهت صلاحية جلسة الدفع، يرجى إعادة المحاولة" }, { status: 400 });
  }

  try {
    await completeSession(order.yusor_token, otp);

    await supabaseAdmin
      .from("store_orders")
      .update({
        payment_status: "paid",
        status: "processing",
        yusor_token: null, // single-use — clear after confirmation
      })
      .eq("id", order_id);

    return NextResponse.json({ success: true });
  } catch (err) {
    const e = err as Error;
    console.error(`[yusor/verify] order ${order_id}:`, e.message);
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
