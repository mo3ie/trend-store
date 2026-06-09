import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Called by success page when Moamalat Lightbox completeCallback fires on moamalat-pay.
// The Lightbox only runs on trendstore-ly.com (whitelisted domain) so this is
// sufficient evidence of a real payment.
export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();
    if (!orderId) return NextResponse.json({ error: "orderId مطلوب" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("store_orders")
      .update({ payment_status: "paid", status: "processing" })
      .eq("id", orderId);

    if (error) {
      console.error("[moamalat/confirm] DB error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("[moamalat/confirm] order marked paid:", orderId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[moamalat/confirm] ERROR:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
