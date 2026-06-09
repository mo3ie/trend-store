import { createHmac } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("WALLET MOAMALAT WEBHOOK:", JSON.stringify(body, null, 2));

    const {
      MerchantId,
      TerminalId,
      SecureHash,
      DateTimeLocalTrxn,
      Amount,
      Currency,
      MerchantReference,
      SystemReference,
      TxnType,
    } = body;

    const KEY = process.env.MOAMALAT_SECURE_KEY!;
    const hashString = [
      `Amount=${Amount}`,
      `Currency=${Currency}`,
      `DateTimeLocalTrxn=${DateTimeLocalTrxn}`,
      `MerchantId=${MerchantId}`,
      `TerminalId=${TerminalId}`,
    ].join("&");

    const expectedHash = createHmac("sha256", Buffer.from(KEY, "hex"))
      .update(hashString)
      .digest("hex")
      .toUpperCase();

    if (SecureHash !== expectedHash) {
      console.error("WALLET MOAMALAT: Invalid SecureHash", { received: SecureHash, expected: expectedHash });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    if (String(TxnType) !== "1") {
      return NextResponse.json({ received: true });
    }

    // MerchantReference = wallet_transaction.id
    const txId = MerchantReference;

    const { data: tx } = await supabaseAdmin
      .from("wallet_transactions")
      .select("user_id, amount, status")
      .eq("id", txId)
      .single();

    if (!tx) {
      console.error("WALLET MOAMALAT: transaction not found", txId);
      return NextResponse.json({ received: true });
    }

    if (tx.status === "completed") {
      return NextResponse.json({ received: true });
    }

    await supabaseAdmin
      .from("wallet_transactions")
      .update({ status: "completed", reference: SystemReference })
      .eq("id", txId);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("wallet_balance")
      .eq("id", tx.user_id)
      .single();

    const newBalance = (profile?.wallet_balance || 0) + tx.amount;
    await supabaseAdmin
      .from("profiles")
      .update({ wallet_balance: newBalance })
      .eq("id", tx.user_id);

    console.log(`✅ Wallet moamalat topped up: user=${tx.user_id} +${tx.amount} → ${newBalance}`);
    return NextResponse.json({ received: true });

  } catch (err) {
    console.error("WALLET MOAMALAT WEBHOOK ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
