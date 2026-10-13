import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { refundFailedCampaign, withRefundNote } from "@/lib/adsRefund";
import { launchPaidCampaign } from "@/lib/adsLaunch";

export const maxDuration = 60;

/** Retry a campaign that has been paid but silent for this long. */
const RETRY_AFTER_MIN = 10;
/** Give up, refund, and say so, after this long. */
const GIVE_UP_AFTER_MIN = 60;

/**
 * The safety net under every paid campaign.
 *
 * Refunding inside the launch route only covers failures the launch route lives
 * to see. But the launch is fire-and-forget by design — the customer's payment
 * must not hang on a slow platform API — so if that hop never arrives, or the
 * function dies mid-way, NOTHING marks the campaign failed. It sits at 'paid'
 * forever: no ad, no error, no refund, and no way for the customer to tell the
 * difference between "still starting" and "lost".
 *
 * That silent case is the one that generates complaints, because the money is
 * gone and the screen says nothing is wrong. So time itself has to decide:
 *
 *   paid, no platform id, 10 min  → launch again (platforms fail transiently)
 *   paid, no platform id, 60 min  → mark failed and refund
 *   failed, payment still 'success' → refund (covers anything missed before)
 *
 * Refunds run through `refund_ad_payment`, which only pays out the caller that
 * actually flips the payment row, so overlapping sweeps cannot double-refund.
 */
async function sweep() {
  const now = Date.now();
  const retryBefore = new Date(now - RETRY_AFTER_MIN * 60_000).toISOString();
  const giveUpBefore = new Date(now - GIVE_UP_AFTER_MIN * 60_000).toISOString();

  const result = { retried: 0, refunded: 0, refundedAmount: 0, stillWaiting: 0 };

  // ── Paid but never launched ────────────────────────────────────────────────
  const { data: stuck } = await supabaseAdmin
    .from("ad_campaigns")
    .select("id, platform, status, updated_at, total_price")
    .eq("status", "paid")
    .is("external_campaign_id", null)
    .lt("updated_at", retryBefore)
    .limit(100);

  for (const c of stuck || []) {
    if (c.updated_at < giveUpBefore) {
      const back = await refundFailedCampaign(
        c.id,
        "استرجاع تلقائي — لم تُنفَّذ الحملة خلال ساعة",
      );
      await supabaseAdmin.from("ad_campaigns").update({
        status: "failed",
        error_message: withRefundNote(
          "لم تبدأ الحملة خلال ساعة من الدفع، فأُلغيت تلقائياً",
          back.refunded,
        ),
        updated_at: new Date().toISOString(),
      }).eq("id", c.id);
      if (back.refunded) { result.refunded++; result.refundedAmount += back.amount ?? 0; }
    } else {
      // Between 10 and 60 minutes: try again. `updated_at` is deliberately left
      // alone so the give-up clock keeps running from the payment, not from the
      // last retry — otherwise a permanently broken campaign retries forever.
      launchPaidCampaign(c.id, c.platform);
      result.retried++;
    }
  }

  // ── Failed, but the money never came back ──────────────────────────────────
  // Covers every failure that happened before refunding existed, and anything a
  // crash leaves behind in future.
  const { data: owed } = await supabaseAdmin
    .from("ad_campaigns")
    .select("id, error_message, ad_payments!inner(status)")
    .eq("status", "failed")
    .eq("ad_payments.status", "success")
    .limit(100);

  for (const c of owed || []) {
    const back = await refundFailedCampaign(c.id, "استرجاع تلقائي — حملة فاشلة");
    if (back.refunded) {
      result.refunded++;
      result.refundedAmount += back.amount ?? 0;
      await supabaseAdmin.from("ad_campaigns").update({
        error_message: withRefundNote(c.error_message || "فشل إطلاق الحملة", true),
        updated_at: new Date().toISOString(),
      }).eq("id", c.id);
    }
  }

  // Reported so a sweep that does nothing is distinguishable from one that ran
  // against an empty queue.
  const { count } = await supabaseAdmin
    .from("ad_campaigns")
    .select("id", { count: "exact", head: true })
    .eq("status", "paid").is("external_campaign_id", null);
  result.stillWaiting = count ?? 0;

  return result;
}

/**
 * Fail closed. Without a secret configured this endpoint would let anyone
 * trigger refunds, so it refuses rather than running unauthenticated.
 */
function authorized(req: NextRequest): boolean {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await sweep()) });
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await sweep()) });
}
