import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import { activeSubscriptions } from "@/lib/entitlements";

// GET — the signed-in user's active subscriptions, full payment history
// (the payment-activity window) and wallet balance.
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const [subs, paymentsRes, walletRes] = await Promise.all([
    activeSubscriptions(user.id),
    supabaseAdmin.from("subscription_payments").select("*")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
    supabaseAdmin.from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
  ]);

  return NextResponse.json({
    subscriptions: subs,
    payments: paymentsRes.data || [],
    balance: Number(walletRes.data?.balance ?? 0),
  });
}
