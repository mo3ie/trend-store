import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { onlineConfTrans } from "@/lib/adfali";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/edfali/verify
// Body: { session_id, otp, order_id? }
// Calls Adfali OnlineConfTrans, updates store_order on success
export async function POST(req: NextRequest) {
  try {
    const { session_id, otp, order_id } = await req.json();

    if (!session_id || !otp) {
      return NextResponse.json({ error: "session_id و otp مطلوبان" }, { status: 400 });
    }

    await onlineConfTrans(session_id, otp);

    if (order_id) {
      await supabaseAdmin
        .from("store_orders")
        .update({ payment_status: "paid", status: "processing" })
        .eq("id", order_id);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
