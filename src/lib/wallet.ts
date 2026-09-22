import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * The single source of truth for wallet money: `wallets.balance`.
 *
 * This repo grew two wallet conventions. Every product — ads checkout, bot and
 * studio subscriptions, renewals, top-up packs — DEBITS `wallets.balance`, while
 * the payment gateways used to CREDIT `profiles.wallet_balance`. The two never
 * met, so a customer could pay through Edfali, MobiCash or Moamalat and still be
 * told their balance was too low, with the money sitting in a column nothing
 * read. Every credit path now goes through here instead.
 *
 * `profiles.wallet_balance` is now dead: nothing in the app reads it. It is left
 * untouched rather than mirrored, because a mirror that only tracks credits and
 * not spends would drift and mislead whoever finds it next.
 */

/** Current balance, creating nothing. */
export async function getBalance(userId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("wallets").select("balance").eq("user_id", userId).maybeSingle();
  return Number(data?.balance ?? 0);
}

/**
 * Add money to a user's wallet, creating the row on first top-up. Returns the new
 * balance. `amount` may be negative to debit, but prefer `debit()` for that so the
 * insufficient-funds case is handled in one place.
 */
export async function creditWallet(userId: string, amount: number): Promise<number> {
  const current = await getBalance(userId);
  const next = current + amount;
  const nowIso = new Date().toISOString();

  await supabaseAdmin.from("wallets")
    .upsert({ user_id: userId, balance: next, updated_at: nowIso }, { onConflict: "user_id" });

  return next;
}

/**
 * Take money out, refusing rather than going negative.
 * Returns the new balance, or null when the wallet cannot cover it.
 */
export async function debitWallet(userId: string, amount: number): Promise<number | null> {
  const current = await getBalance(userId);
  if (current < amount) return null;
  return await creditWallet(userId, -amount);
}
