import { createHmac } from "crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { doPTrans } from "@/lib/adfali";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

  // ── Moamalat: direct Lightbox ──────────────────────────────────────────────
  if (method === "moamalat") {
    const MID = process.env.MOAMALAT_MERCHANT_ID!;
    const TID = process.env.MOAMALAT_TERMINAL_ID!;
    const KEY = process.env.MOAMALAT_SECURE_KEY!;

    const amountUnit        = Math.round(amt * 1000).toString();
    const dateTimeLocalTrxn = Math.floor(Date.now() / 1000).toString();

    const hashString = [
      `Amount=${amountUnit}`,
      `DateTimeLocalTrxn=${dateTimeLocalTrxn}`,
      `MerchantId=${MID}`,
      `MerchantReference=${tx.id}`,
      `TerminalId=${TID}`,
    ].join("&");

    const secureHash = createHmac("sha256", Buffer.from(KEY, "hex"))
      .update(hashString)
      .digest("hex")
      .toUpperCase();

    const isProduction = process.env.MOAMALAT_MODE === "Production";
    const scriptUrl    = isProduction
      ? "https://npg.moamalat.net:6006/js/lightbox.js"
      : "https://tnpg.moamalat.net:6006/js/lightbox.js";

    return NextResponse.json({
      lightbox:          true,
      MID,
      TID,
      AmountTrxn:        amountUnit,
      MerchantReference: tx.id,
      TrxDateTime:       dateTimeLocalTrxn,
      SecureHash:        secureHash,
      scriptUrl,
      txId:              tx.id,
    });
  }

  await supabaseAdmin.from("wallet_transactions").delete().eq("id", tx.id);
  return NextResponse.json({ error: "طريقة الدفع غير متاحة" }, { status: 400 });
}
