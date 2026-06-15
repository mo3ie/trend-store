import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "crypto";
import { signin, openSession } from "@/lib/yusor";

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

// POST /api/yusor/initiate
// Body: { order_id, identityCard, amount }
// Signs in to Yusor, opens a sale session (bank sends OTP to customer),
// persists the merchant token on the order, then returns success.
export async function POST(req: NextRequest) {
  const { data: { user } } = await getUser(req);
  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { order_id, identityCard, amount } = await req.json();
  if (!order_id) return NextResponse.json({ error: "order_id مطلوب" }, { status: 400 });
  if (!identityCard) return NextResponse.json({ error: "رقم البطاقة مطلوب" }, { status: 400 });
  if (!amount || Number(amount) <= 0) return NextResponse.json({ error: "المبلغ غير صحيح" }, { status: 400 });

  // Verify the order belongs to this user
  const { data: order, error: orderErr } = await supabaseAdmin
    .from("store_orders")
    .select("id, user_id, total")
    .eq("id", order_id)
    .eq("user_id", user.id)
    .single();
  if (orderErr || !order) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });

  try {
    const { token, validTo } = await signin();

    const transactionId = randomUUID();
    await openSession(token, { amount: Number(amount), identityCard, transactionId });

    const { error: updErr } = await supabaseAdmin
      .from("store_orders")
      .update({
        yusor_token: token,
        yusor_transaction_id: transactionId,
        yusor_valid_to: validTo,
      })
      .eq("id", order_id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    const e = err as Error;
    console.error(`[yusor/initiate] order ${order_id}:`, e.message);
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
