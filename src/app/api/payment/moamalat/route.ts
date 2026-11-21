import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const MID  = process.env.MOAMALAT_MERCHANT_ID;
const TID  = process.env.MOAMALAT_TERMINAL_ID;
const KEY  = process.env.MOAMALAT_SECURE_KEY;
const MODE = process.env.MOAMALAT_MODE;

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

// Signs Lightbox parameters for the caller's own order, for the total stored on
// it. It used to sign any orderId for any amount it was sent.
export async function POST(req: NextRequest) {
  try {
    const { data: { user } } = await getUser(req);
    if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { orderId } = await req.json();
    if (!orderId)
      return NextResponse.json({ error: "orderId مطلوب" }, { status: 400 });

    const { data: order } = await supabaseAdmin
      .from("store_orders")
      .select("id, total, payment_status")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .single();
    if (!order) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
    if (order.payment_status === "paid") return NextResponse.json({ error: "هذا الطلب مدفوع بالفعل" }, { status: 409 });
    const amountLYD = Number(order.total);
    if (!(amountLYD > 0)) return NextResponse.json({ error: "المبلغ غير صحيح" }, { status: 400 });

    const amountUnit       = Math.round(Number(amountLYD) * 1000).toString();
    const dateTimeLocalTrxn = Math.floor(Date.now() / 1000).toString();

    const hashString = [
      `Amount=${amountUnit}`,
      `DateTimeLocalTrxn=${dateTimeLocalTrxn}`,
      `MerchantId=${MID}`,
      `MerchantReference=${orderId}`,
      `TerminalId=${TID}`,
    ].join("&");

    const keyBuf     = Buffer.from(KEY!, "hex");
    const secureHash = createHmac("sha256", keyBuf).update(hashString).digest("hex").toUpperCase();

    const isProduction = MODE === "Production";
    const scriptUrl    = isProduction
      ? "https://npg.moamalat.net:6006/js/lightbox.js"
      : "https://tnpg.moamalat.net:6006/js/lightbox.js";

    return NextResponse.json({
      success:           true,
      MID,
      TID,
      AmountTrxn:        amountUnit,
      MerchantReference: orderId,
      TrxDateTime:       dateTimeLocalTrxn,
      SecureHash:        secureHash,
      scriptUrl,
    });

  } catch (err: any) {
    console.error("MOAMALAT INIT ERROR:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
