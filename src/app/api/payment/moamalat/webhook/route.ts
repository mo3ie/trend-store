import { createHmac } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Verify SecureHash from Moamalat server-to-server notification
function verifyHash(body: Record<string, string>): boolean {
  const KEY = process.env.MOAMALAT_SECURE_KEY;
  if (!KEY) return false;

  // Fields used in hash verification (Moamalat NPG spec)
  const hashString = [
    `Amount=${body.AmountTrxn || ""}`,
    `MerchantId=${body.MerchantId || ""}`,
    `MerchantReference=${body.MerchantReference || ""}`,
    `OriginalAmount=${body.OriginalAmount || ""}`,
    `ResponseCode=${body.ResponseCode || ""}`,
    `SystemReference=${body.SystemReference || ""}`,
    `TerminalId=${body.TerminalId || ""}`,
    `TransactionId=${body.TransactionId || ""}`,
  ].join("&");

  const keyBuf   = Buffer.from(KEY, "hex");
  const computed = createHmac("sha256", keyBuf).update(hashString).digest("hex").toUpperCase();
  return computed === (body.SecureHash || "").toUpperCase();
}

// POST /api/payment/moamalat/webhook
// Moamalat server-to-server payment notification
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
               ?? Object.fromEntries((await req.formData()).entries());

    console.log("MOAMALAT WEBHOOK:", JSON.stringify(body));

    const orderId      = body.MerchantReference as string;
    const responseCode = body.ResponseCode     as string;

    if (!orderId) return NextResponse.json({ ok: true });

    // "00" = approved in Moamalat NPG
    const isPaid = responseCode === "00";

    // Optionally verify hash (skip if KEY not set)
    if (process.env.MOAMALAT_SECURE_KEY && !verifyHash(body as Record<string, string>)) {
      console.error("MOAMALAT WEBHOOK: invalid SecureHash");
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("store_orders")
      .update({
        payment_status:        isPaid ? "paid" : "failed",
        moamalat_reference:    body.SystemReference || body.TransactionId || null,
        status:                isPaid ? "processing" : "pending",
      })
      .eq("id", orderId);

    if (error) console.error("MOAMALAT WEBHOOK DB ERROR:", error);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("MOAMALAT WEBHOOK ERROR:", err);
    return NextResponse.json({ ok: true });
  }
}
