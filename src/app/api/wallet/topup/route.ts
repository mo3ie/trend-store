import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { doPTrans } from "@/lib/adfali";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DPAY_URL =
  process.env.DPAY_MODE === "Production"
    ? "https://dpay.ly/api/payment/sessions/open"
    : "https://dpay.ly/api/sandbox/payment/sessions/open";

async function getUser() {
  const cookieStore = await cookies();
  const anon = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await anon.auth.getUser();
  return user;
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { amount, method, phone } = await req.json();

  const amt = parseFloat(amount);
  if (!amt || amt < 10) return NextResponse.json({ error: "الحد الأدنى للشحن 10 د.ل" }, { status: 400 });
  if (!method)         return NextResponse.json({ error: "يرجى اختيار طريقة الدفع" }, { status: 400 });
  if (method === "edfali" && !phone) return NextResponse.json({ error: "رقم الهاتف مطلوب" }, { status: 400 });

  // Create pending transaction first
  const { data: tx, error: txErr } = await supabaseAdmin.from("wallet_transactions").insert({
    user_id: user.id,
    amount:  Math.round(amt),
    type:    "credit",
    method,
    status:  "pending",
    note:    `شحن محفظة عبر ${method}`,
  }).select().single();

  if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

  // ── Edfali: direct Adfali web service ─────────────────────────────────────
  if (method === "edfali") {
    try {
      const sessionId = await doPTrans(phone, Math.round(amt));
      await supabaseAdmin.from("wallet_transactions")
        .update({ reference: sessionId })
        .eq("id", tx.id);
      return NextResponse.json({ edfali: true, sessionId, txId: tx.id });
    } catch (err: any) {
      await supabaseAdmin.from("wallet_transactions").delete().eq("id", tx.id);
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  }

  // ── DPay methods ───────────────────────────────────────────────────────────
  const BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://trendstore-ly.com";

  const payload: Record<string, unknown> = {
    amount:       Math.round(amt),
    currency:     "LYD",
    order_id:     tx.id,
    pay_method:   method,
    callback_url: `${BASE}/api/wallet/webhook`,
    return_url:   `${BASE}/account?tab=wallet&topup=success`,
  };

  if (method === "moamalat") {
    payload.customer_name  = user.user_metadata?.full_name || "customer";
    payload.customer_phone = phone || "0910000000";
  }

  const res = await fetch(DPAY_URL, {
    method:  "POST",
    headers: { Authorization: `Bearer ${process.env.DPAY_TOKEN}`, "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });

  const text = await res.text();
  let data: { payment_link?: string; session_id?: string; message?: string };
  try { data = JSON.parse(text); }
  catch { await supabaseAdmin.from("wallet_transactions").delete().eq("id", tx.id); return NextResponse.json({ error: "رد غير مفهوم من DPay" }, { status: 500 }); }

  if (!res.ok || !data.payment_link) {
    await supabaseAdmin.from("wallet_transactions").delete().eq("id", tx.id);
    return NextResponse.json({ error: data?.message || "فشل إنشاء جلسة الدفع" }, { status: 500 });
  }

  await supabaseAdmin.from("wallet_transactions")
    .update({ reference: data.session_id })
    .eq("id", tx.id);

  return NextResponse.json({ success: true, payment_link: data.payment_link, session_id: data.session_id, tx_id: tx.id });
}
