import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
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

    // Credit wallet balance
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

    console.log(`✅ Wallet topped up: user=${tx.user_id} +${tx.amount} → ${newBalance}`);
    return NextResponse.json({ received: true });

  } catch (err) {
    console.error("WALLET WEBHOOK ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
