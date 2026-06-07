import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function makeServiceClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
}

async function getUser() {
  const cookieStore = await cookies();
  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await anonClient.auth.getUser();
  return user;
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ balance: 0, transactions: [] });

  const supabase = await makeServiceClient();
  const [{ data: profile }, { data: transactions }] = await Promise.all([
    supabase.from("profiles").select("wallet_balance").eq("id", user.id).single(),
    supabase.from("wallet_transactions").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(20),
  ]);

  return NextResponse.json({
    balance: profile?.wallet_balance || 0,
    transactions: transactions || [],
  });
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { amount, method, reference } = await req.json();
  if (!amount || amount <= 0) return NextResponse.json({ error: "مبلغ غير صحيح" }, { status: 400 });
  if (!method) return NextResponse.json({ error: "يرجى اختيار طريقة الشحن" }, { status: 400 });

  const supabase = await makeServiceClient();

  const { data: tx, error: txErr } = await supabase.from("wallet_transactions").insert({
    user_id: user.id,
    amount,
    type: "credit",
    method,
    status: "pending",
    reference: reference || null,
    note: `شحن محفظة عبر ${method}`,
  }).select().single();

  if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

  // Auto-complete for prepaid cards with valid reference
  if (method === "prepaid_card" && reference) {
    await supabase.from("wallet_transactions").update({ status: "completed" }).eq("id", tx.id);
    // Increment wallet_balance
    const { data: prof } = await supabase.from("profiles").select("wallet_balance").eq("id", user.id).single();
    const newBalance = (prof?.wallet_balance || 0) + amount;
    await supabase.from("profiles").update({ wallet_balance: newBalance }).eq("id", user.id);
  }

  return NextResponse.json({ success: true, transaction_id: tx.id, status: method === "prepaid_card" ? "completed" : "pending" });
}
