import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { onlineConfTrans } from "@/lib/adfali";

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
    .select("id, user_id, amount, status")
    .eq("id", txId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .single();

  if (!tx) return NextResponse.json({ error: "العملية غير موجودة أو مكتملة بالفعل" }, { status: 404 });

  // Call Adfali OnlineConfTrans
  try {
    await onlineConfTrans(sessionId, otp);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  // Mark transaction completed
  await supabaseAdmin
    .from("wallet_transactions")
    .update({ status: "completed", reference: sessionId })
    .eq("id", txId);

  // Credit wallet balance
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("wallet_balance")
    .eq("id", user.id)
    .single();

  const newBalance = (profile?.wallet_balance || 0) + tx.amount;
  await supabaseAdmin
    .from("profiles")
    .update({ wallet_balance: newBalance })
    .eq("id", user.id);

  return NextResponse.json({ success: true, newBalance });
}
