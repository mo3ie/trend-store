import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DPAY_VERIFY =
  process.env.DPAY_MODE === "Production"
    ? "https://dpay.ly/api/payment/sessions/verify"
    : "https://dpay.ly/api/sandbox/payment/sessions/verify";

export async function POST(req: NextRequest) {
  try {
    const { session_id, otp, order_id } = await req.json();

    if (!session_id || !otp) {
      return NextResponse.json({ error: "session_id و otp مطلوبان" }, { status: 400 });
    }

    const res = await fetch(DPAY_VERIFY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DPAY_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ session_id, otp }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.message || "رمز التحقق خاطئ أو انتهت صلاحيته" }, { status: res.status });
    }

    if (data.status === "paid" && order_id) {
      await supabaseAdmin
        .from("store_orders")
        .update({ payment_status: "paid", status: "processing" })
        .eq("id", order_id);
    }

    return NextResponse.json({ success: true, status: data.status, tx_id: data.tx_id });

  } catch (err: any) {
    console.error("EDFALI VERIFY:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
