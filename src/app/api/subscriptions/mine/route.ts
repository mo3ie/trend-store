import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import { activeSubscriptions, getAccess } from "@/lib/entitlements";

// GET — the signed-in user's active subscriptions, full payment history
// (the payment-activity window), wallet balance, and access status (admin / free trial).
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const [subs, access, paymentsRes, walletRes] = await Promise.all([
    activeSubscriptions(user.id),
    getAccess(user.id),
    supabaseAdmin.from("subscription_payments").select("*")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
    supabaseAdmin.from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
  ]);

  return NextResponse.json({
    subscriptions: subs,
    access,
    payments: paymentsRes.data || [],
    balance: Number(walletRes.data?.balance ?? 0),
  });
}
