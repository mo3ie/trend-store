import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("DPAY WEBHOOK trend-store:", JSON.stringify(body));

    const { order_id, status, session_id } = body;

    if (!order_id) return NextResponse.json({ ok: true });

    const isPaid = status === "paid" || status === "PAID" || status === "success";

    const { error } = await supabaseAdmin
      .from("store_orders")
      .update({
        payment_status: isPaid ? "paid" : "failed",
        dpay_session_id: session_id || null,
        status: isPaid ? "processing" : "pending",
      })
      .eq("id", order_id);

    if (error) console.error("DPAY WEBHOOK DB ERROR:", error);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("DPAY WEBHOOK ERROR:", err);
    return NextResponse.json({ ok: true });
  }
}
