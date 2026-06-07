import { NextRequest, NextResponse } from "next/server";

const BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://trendstore-ly.com";

const DPAY_URL =
  process.env.DPAY_MODE === "Production"
    ? "https://dpay.ly/api/payment/sessions/open"
    : "https://dpay.ly/api/sandbox/payment/sessions/open";

export async function POST(req: NextRequest) {
  try {
    const { amount, orderId, method, customer_mobile, customer_name, card_number } = await req.json();

    if (!amount || isNaN(amount) || amount <= 0)
      return NextResponse.json({ error: "المبلغ غير صالح" }, { status: 400 });
    if (!orderId)
      return NextResponse.json({ error: "orderId مطلوب" }, { status: 400 });
    if (!method)
      return NextResponse.json({ error: "طريقة الدفع مطلوبة" }, { status: 400 });

    const payload: Record<string, unknown> = {
      amount:       Math.round(amount),
      currency:     "LYD",
      order_id:     orderId,
      pay_method:   method,
      callback_url: `${BASE}/api/payment/dpay-webhook`,
      return_url:   `${BASE}/success?orderId=${orderId}&via=dpay`,
    };

    if (method === "edfali") {
      if (!customer_mobile)
        return NextResponse.json({ error: "رقم الهاتف مطلوب لـ ادفع لي" }, { status: 400 });
      payload.customer_mobile = customer_mobile;
    }

    if (["mobicash", "masrefypay", "yousrpay", "saharpay"].includes(method)) {
      if (!card_number)
        return NextResponse.json({ error: "رقم البطاقة مطلوب" }, { status: 400 });
      payload.card_number = card_number;
    }

    const response = await fetch(DPAY_URL, {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${process.env.DPAY_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let data: any;
    try { data = JSON.parse(text); }
    catch { return NextResponse.json({ error: "رد غير مفهوم من DPay", raw: text }, { status: 500 }); }

    if (!response.ok) {
      console.error("DPAY ERROR:", data);
      return NextResponse.json({ error: data?.message || "فشل إنشاء جلسة الدفع", data }, { status: 500 });
    }

    // edfali returns session_id only (OTP flow); other methods return payment_link
    if (method !== "edfali" && !data.payment_link) {
      return NextResponse.json({ error: "لم يتم استلام رابط الدفع", data }, { status: 500 });
    }

    return NextResponse.json({
      success:      true,
      payment_link: data.payment_link || null,
      session_id:   data.session_id || null,
    });

  } catch (err: any) {
    console.error("DPAY ERROR:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
