import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { doPTrans, normalizePhone } from "@/lib/adfali";

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

// POST /api/edfali/initiate
// Body: { order_id, customerPhone }
// Calls Adfali DoPTrans for the order's stored total → sends OTP SMS to the
// customer, and keeps the bank session on the order so /verify can only ever
// confirm the session that was opened for THIS order and THIS amount.
export async function POST(req: NextRequest) {
  const { data: { user } } = await getUser(req);
  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { order_id, customerPhone } = await req.json();
  if (!order_id) return NextResponse.json({ error: "order_id مطلوب" }, { status: 400 });
  if (!customerPhone) return NextResponse.json({ error: "رقم الهاتف مطلوب" }, { status: 400 });

  const { data: order, error: orderErr } = await supabaseAdmin
    .from("store_orders")
    .select("id, user_id, total, payment_status")
    .eq("id", order_id)
    .eq("user_id", user.id)
    .single();
  if (orderErr || !order) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  if (order.payment_status === "paid") return NextResponse.json({ error: "هذا الطلب مدفوع بالفعل" }, { status: 409 });

  const amount = Number(order.total);
  if (!(amount > 0)) return NextResponse.json({ error: "المبلغ غير صحيح" }, { status: 400 });

  const normalized = normalizePhone(customerPhone);
  try {
    const sessionId = await doPTrans(customerPhone, amount);
    const { error: updErr } = await supabaseAdmin
      .from("store_orders")
      .update({ dpay_session_id: JSON.stringify({ edfali: sessionId }) })
      .eq("id", order_id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    return NextResponse.json({ sessionId });
  } catch (err: any) {
    console.error(`[edfali/initiate] error for phone ${normalized}:`, err.message);
    return NextResponse.json({ error: err.message, phone: normalized }, { status: 400 });
  }
}
