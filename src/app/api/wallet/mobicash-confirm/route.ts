import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { verifyOtp } from "@/lib/mobicash";

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

// POST /api/wallet/mobicash-confirm
// Body: { txId, otp }
// Confirms the MobiCash OTP for a pending top-up and credits the wallet.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { txId, otp } = await req.json();
  if (!txId || !otp) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

  // The payment_uuid is read from the transaction row (written at top-up), never
  // taken from the browser.
  const { data: tx } = await supabaseAdmin
    .from("wallet_transactions")
    .select("id, user_id, amount, status, method, reference")
    .eq("id", txId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .single();

  if (!tx) return NextResponse.json({ error: "العملية غير موجودة أو مكتملة بالفعل" }, { status: 404 });
  if (tx.method !== "mobicash" || !tx.reference) {
    return NextResponse.json({ error: "هذه العملية ليست عملية موبي كاش" }, { status: 400 });
  }

  let bankReference: string | null = null;
  try {
    const result = await verifyOtp({ paymentUuid: tx.reference, otp });
    bankReference = result.bankReference;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  await supabaseAdmin
    .from("wallet_transactions")
    .update({ status: "completed", reference: bankReference || tx.reference })
    .eq("id", txId);

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
