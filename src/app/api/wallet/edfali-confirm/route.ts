import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { onlineConfTrans } from "@/lib/adfali";
import { creditWallet } from "@/lib/wallet";
import { notifyUser, NOTICES } from "@/lib/notify";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUser() {
  const cookieStore = await cookies();
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await client.auth.getUser();
  return user;
}

// POST /api/wallet/edfali-confirm
// Body: { sessionId, otp, txId }
// Confirms Adfali OTP + credits wallet
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { sessionId, otp, txId } = await req.json();
  if (!sessionId || !otp || !txId) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  // Verify transaction belongs to user and is still pending
  const { data: tx } = await supabaseAdmin
    .from("wallet_transactions")
    .select("id, user_id, amount, status, method, reference")
    .eq("id", txId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .single();

  if (!tx) return NextResponse.json({ error: "العملية غير موجودة أو مكتملة بالفعل" }, { status: 404 });

  // Confirm the bank session stored on THIS top-up at /topup, never the one the
  // browser sends: a session opened for 1 LYD must not credit a 1000 LYD top-up.
  if (tx.method !== "edfali" || !tx.reference) {
    return NextResponse.json({ error: "لم تبدأ عملية الدفع لهذه العملية" }, { status: 400 });
  }
  try {
    await onlineConfTrans(tx.reference, otp);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  // Mark transaction completed
  // Conditional on still being pending, so two confirms racing each other
  // cannot credit the same top-up twice.
  const { data: done } = await supabaseAdmin
    .from("wallet_transactions")
    .update({ status: "completed" })
    .eq("id", txId)
    .eq("status", "pending")
    .select("id");
  if (!done?.length) return NextResponse.json({ error: "العملية مكتملة بالفعل" }, { status: 409 });

  // Credit the wallet the products actually debit (see lib/wallet).
  const newBalance = await creditWallet(user.id, tx.amount);
  await notifyUser(user.id, NOTICES.walletTopup(Number(tx.amount), newBalance));

  return NextResponse.json({ success: true, newBalance });
}
