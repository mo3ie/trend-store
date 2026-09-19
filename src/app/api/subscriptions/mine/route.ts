import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import { activeSubscriptions, getAccess } from "@/lib/entitlements";

// GET — the signed-in user's active subscriptions, the ones that have lapsed (so the
// UI can offer a one-click renewal), full payment history (the payment-activity
// window), wallet balance, and access status (admin / free trial).
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const [subs, access, expiredRes, paymentsRes, walletRes] = await Promise.all([
    activeSubscriptions(user.id),
    getAccess(user.id),
    supabaseAdmin.from("subscriptions").select("*")
      .eq("user_id", user.id).neq("status", "active")
      .order("expires_at", { ascending: false }).limit(20),
    supabaseAdmin.from("subscription_payments").select("*")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
    supabaseAdmin.from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
  ]);

  return NextResponse.json({
    subscriptions: subs,
    expired: expiredRes.data || [],
    access,
    payments: paymentsRes.data || [],
    balance: Number(walletRes.data?.balance ?? 0),
  });
}
