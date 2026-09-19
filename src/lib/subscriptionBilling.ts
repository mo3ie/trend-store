import { supabaseAdmin } from "@/lib/supabaseAdmin";

// One "month" of a plan term, matching the purchase route's own arithmetic.
export const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// Days-left buckets a user is warned at, largest first. `reminder_stage` on the row
// holds the smallest bucket already sent, so each bucket fires exactly once.
export const REMINDER_DAYS = [7, 3, 1];

export type RenewOutcome =
  | { ok: true; subscription: Record<string, unknown>; charged: number; balance: number }
  | { ok: false; code: "not_found" | "plan_unavailable" | "insufficient_balance"; message: string; price?: number; balance?: number };

// Drop a row in the in-app notification bell. Best-effort: a failed notification
// must never roll back a successful charge.
export async function notify(userId: string, title: string, body: string, type = "info", link = "/subscriptions") {
  try {
    await supabaseAdmin.from("notifications").insert({ user_id: userId, title, body, type, link });
  } catch { /* best-effort */ }
}

const PRODUCT_LABEL: Record<string, string> = {
  bot: "بوت الرد الآلي", ads: "الإعلانات VIP", studio: "الموظف الذكي",
};
export const productLabel = (p: string) => PRODUCT_LABEL[p] ?? p;

/**
 * Charge the wallet and extend one subscription by its plan's term.
 *
 * Used by both the manual "renew now" button and the auto-renew cron, so the two can
 * never drift apart. The price is re-read from the plan (not from the old row) so a
 * price change in the admin panel takes effect at renewal, and the new term is added
 * to whichever is later — now, or the current expiry — so renewing early never
 * loses the days already paid for.
 */
export async function renewSubscription(subId: string, opts: { userId?: string } = {}): Promise<RenewOutcome> {
  let q = supabaseAdmin.from("subscriptions").select("*").eq("id", subId);
  if (opts.userId) q = q.eq("user_id", opts.userId);
  const { data: sub } = await q.maybeSingle();
  if (!sub) return { ok: false, code: "not_found", message: "الاشتراك غير موجود" };

  const { data: plan } = await supabaseAdmin
    .from("subscription_plans").select("*").eq("id", sub.plan_id).maybeSingle();
  if (!plan || !plan.active) {
    return { ok: false, code: "plan_unavailable", message: "الباقة لم تعد متاحة — اختر باقة أخرى" };
  }

  const price = Number(plan.price_lyd);
  const { data: wallet } = await supabaseAdmin
    .from("wallets").select("balance").eq("user_id", sub.user_id).maybeSingle();
  const balance = Number(wallet?.balance ?? 0);
  if (balance < price) {
    return { ok: false, code: "insufficient_balance", message: "رصيد المحفظة غير كافٍ", price, balance };
  }

  const nowIso = new Date().toISOString();
  const base = sub.expires_at && new Date(sub.expires_at).getTime() > Date.now()
    ? new Date(sub.expires_at).getTime()
    : Date.now();
  const expiresAt = new Date(base + Number(plan.months) * MONTH_MS).toISOString();

  const newBalance = balance - price;
  await supabaseAdmin.from("wallets")
    .update({ balance: newBalance, updated_at: nowIso })
    .eq("user_id", sub.user_id);

  // Extending in place keeps the id stable, so page_ids and anything referencing the
  // subscription survive the renewal. reminder_stage resets for the new term.
  const { data: updated, error } = await supabaseAdmin.from("subscriptions")
    .update({
      status: "active",
      expires_at: expiresAt,
      price_lyd: price,
      reminder_stage: 99,
      cancelled_at: null,
    })
    .eq("id", sub.id).select().single();
  if (error) {
    // Refund rather than leave the user charged for nothing.
    await supabaseAdmin.from("wallets").update({ balance, updated_at: nowIso }).eq("user_id", sub.user_id);
    return { ok: false, code: "not_found", message: error.message };
  }

  await supabaseAdmin.from("subscription_payments").insert({
    user_id: sub.user_id, subscription_id: sub.id, product: sub.product,
    plan_id: plan.id, amount_lyd: price, provider: "wallet", status: "success", kind: "renewal",
  });

  return { ok: true, subscription: updated, charged: price, balance: newBalance };
}
