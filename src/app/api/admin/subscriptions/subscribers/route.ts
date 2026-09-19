import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser, isAdmin } from "@/lib/authUser";

// Admin-only: every subscriber with full profile + payment data, plus revenue stats.
export async function GET() {
  const user = await getAuthUser();
  if (!user || !(await isAdmin(user.id))) return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });

  const [subsRes, paysRes] = await Promise.all([
    supabaseAdmin.from("subscriptions").select("*").order("created_at", { ascending: false }).limit(1000),
    supabaseAdmin.from("subscription_payments").select("*").order("created_at", { ascending: false }).limit(2000),
  ]);
  const subs = subsRes.data || [];
  const pays = paysRes.data || [];

  // Join profiles for names/phones/emails.
  const userIds = [...new Set([...subs, ...pays].map((r) => r.user_id).filter(Boolean))];
  const profByUser: Record<string, { full_name: string | null; phone: string | null; email: string | null }> = {};
  if (userIds.length) {
    const { data: profs } = await supabaseAdmin
      .from("profiles").select("id, full_name, phone, email").in("id", userIds);
    for (const p of profs || []) profByUser[p.id] = { full_name: p.full_name, phone: p.phone, email: p.email };
  }
  const nameOf = (uid: string) => profByUser[uid] || { full_name: null, phone: null, email: null };

  const now = Date.now();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const isActive = (s: { status: string; expires_at: string | null }) =>
    s.status === "active" && (!s.expires_at || new Date(s.expires_at).getTime() > now);

  const successPays = pays.filter((p) => p.status === "success");
  const revenueByProduct: Record<string, number> = { bot: 0, ads: 0, studio: 0 };
  let totalRevenue = 0, revenueMonth = 0;
  for (const p of successPays) {
    const amt = Number(p.amount_lyd) || 0;
    totalRevenue += amt;
    if (p.product && p.product in revenueByProduct) revenueByProduct[p.product] += amt;
    if (new Date(p.created_at).getTime() >= monthStart) revenueMonth += amt;
  }

  const activeByProduct: Record<string, number> = { bot: 0, ads: 0, studio: 0 };
  const weekAhead = now + 7 * 86400000;
  let activeCount = 0, expiringSoon = 0, autoRenewCount = 0, expiredCount = 0;
  for (const s of subs) {
    if (isActive(s)) {
      activeCount++;
      if (s.product in activeByProduct) activeByProduct[s.product]++;
      if (s.auto_renew) autoRenewCount++;
      // Renewal pipeline: what the daily cron will act on within the week.
      if (s.expires_at && new Date(s.expires_at).getTime() <= weekAhead) expiringSoon++;
    } else if (s.status === "expired") expiredCount++;
  }
  const renewalRevenue = successPays
    .filter((p) => p.kind === "renewal")
    .reduce((t, p) => t + (Number(p.amount_lyd) || 0), 0);

  return NextResponse.json({
    stats: {
      total_revenue: totalRevenue,
      revenue_month: revenueMonth,
      revenue_by_product: revenueByProduct,
      active_count: activeCount,
      active_by_product: activeByProduct,
      total_subscriptions: subs.length,
      total_payments: successPays.length,
      expiring_soon: expiringSoon,
      expired_count: expiredCount,
      auto_renew_count: autoRenewCount,
      renewal_revenue: renewalRevenue,
    },
    subscribers: subs.map((s) => ({
      id: s.id, user_id: s.user_id, ...nameOf(s.user_id),
      product: s.product, tier: s.tier, page_scope: s.page_scope, page_ids: s.page_ids || [],
      status: s.status, active: isActive(s), auto_renew: !!s.auto_renew,
      starts_at: s.starts_at, expires_at: s.expires_at, price_lyd: s.price_lyd, created_at: s.created_at,
    })),
    payments: pays.map((p) => ({
      id: p.id, user_id: p.user_id, ...nameOf(p.user_id),
      product: p.product, plan_id: p.plan_id, amount_lyd: p.amount_lyd,
      provider: p.provider, status: p.status, kind: p.kind || "purchase", created_at: p.created_at,
    })),
  });
}
