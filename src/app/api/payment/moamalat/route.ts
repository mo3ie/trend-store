import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const MID  = process.env.MOAMALAT_MERCHANT_ID;
const TID  = process.env.MOAMALAT_TERMINAL_ID;
const KEY  = process.env.MOAMALAT_SECURE_KEY;
const MODE = process.env.MOAMALAT_MODE;

export async function POST(req: NextRequest) {
  try {
    const { orderId, amountLYD } = await req.json();

    if (!orderId || !amountLYD)
      return NextResponse.json({ error: "orderId و amountLYD مطلوبان" }, { status: 400 });

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
