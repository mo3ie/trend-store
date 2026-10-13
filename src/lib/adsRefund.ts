import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Hand the money back when a campaign could not be created on the platform.
 *
 * A launch that fails is not the customer's doing — the money left their wallet
 * for an ad that never ran. Until this existed, `status` became 'failed' and the
 * balance simply stayed down; one customer lost 110 د.ل that way before anyone
 * noticed, and only because they said so.
 *
 * The decision and the payout happen in one database statement
 * (`refund_ad_payment`), because both launch routes are retryable: two retries
 * racing would otherwise refund twice. Safe to call on every failure path.
 *
 * Never throws. A refund that fails must not replace the real error with its
 * own — the campaign still has to be marked failed either way.
 */
export async function refundFailedCampaign(
  campaignId: string,
  reason?: string,
): Promise<{ refunded: boolean; amount?: number; balance?: number }> {
  try {
    const { data, error } = await supabaseAdmin.rpc("refund_ad_payment", {
      p_campaign: campaignId,
      p_reason: reason ?? null,
    });
    if (error) {
      console.error("refund failed ❌", campaignId, error.message);
      return { refunded: false };
    }
    const r = (data ?? {}) as { refunded?: boolean; amount?: number; balance?: number };
    if (r.refunded) console.log("refunded ✅", campaignId, r.amount);
    return { refunded: !!r.refunded, amount: r.amount, balance: r.balance };
  } catch (e) {
    console.error("refund threw ❌", campaignId, e);
    return { refunded: false };
  }
}

/** Appended to the stored error so the customer reads one message, not two. */
export function withRefundNote(message: string, refunded: boolean): string {
  const note = refunded
    ? " — أُعيد المبلغ إلى محفظتك."
    : "";
  return `${message}${note}`.slice(0, 300);
}
