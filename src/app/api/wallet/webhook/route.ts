import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { creditWallet } from "@/lib/wallet";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // Fail CLOSED: this legacy DPay top-up webhook credits wallets, so it must
    // present the shared secret. If WALLET_WEBHOOK_SECRET is unset, the endpoint
    // is effectively disabled (DPay is retired and nothing else calls this).
    const secret = process.env.WALLET_WEBHOOK_SECRET;
    const provided =
      req.headers.get("x-webhook-secret") ||
      new URL(req.url).searchParams.get("secret");
    if (!secret || provided !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    console.log("WALLET WEBHOOK:", body);

    const { session_id, status, order_id } = body;

    const isPaid = status === "paid" || status === "success";
    if (!isPaid || !order_id) {
      return NextResponse.json({ received: true });
    }

    // order_id = wallet_transaction.id
    const { data: tx, error } = await supabaseAdmin
      .from("wallet_transactions")
      .select("user_id, amount, status")
      .eq("id", order_id)
      .single();

    if (error || !tx) {
      console.error("Wallet webhook: transaction not found", order_id);
      return NextResponse.json({ received: true });
    }

    // Idempotency check
    if (tx.status === "completed") {
      return NextResponse.json({ received: true });
    }

    // Mark transaction completed
    await supabaseAdmin
      .from("wallet_transactions")
      .update({ status: "completed", reference: session_id })
      .eq("id", order_id);

    // Credit the wallet the products actually debit (see lib/wallet).
  const newBalance = await creditWallet(tx.user_id, tx.amount);

    console.log(`✅ Wallet topped up: user=${tx.user_id} +${tx.amount} → ${newBalance}`);
    return NextResponse.json({ received: true });

  } catch (err) {
    console.error("WALLET WEBHOOK ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
