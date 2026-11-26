import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/authUser";
import { getActiveGrant, getPlatformGrant } from "@/lib/tiktokAdsTokens";
import { readAdvertiserToken } from "@/lib/tiktokAdsTokens";
import { getAdvertisers } from "@/services/tiktokAdsCampaigns";
import { getTikTokAdsPricing, getTikTokUserTier, MIN_DAILY_USD } from "@/lib/tiktokAdsPricing";
import { adsConfigured } from "@/services/tiktokAds";

export const maxDuration = 30;

/**
 * GET — everything the TikTok ads screens need before showing anything: whether the
 * feature is configured at all, whether this advertiser is connected, which ad
 * accounts they have, their tier, the price list and the platform's spending floor.
 *
 * One call rather than five, because every one of these facts changes what the create
 * screen is allowed to render, and a screen that renders a price list before knowing
 * the floor will offer a package TikTok refuses.
 */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const [grant, tier, pricing, platform] = await Promise.all([
    getActiveGrant(user.id),
    getTikTokUserTier(user.id),
    getTikTokAdsPricing(),
    // Only its EXISTENCE is reported. A customer must never learn our advertiser
    // id from a response they can read — it is the account their money is spent
    // from, not an account they may aim a campaign at.
    getPlatformGrant().then((p) => !!p, () => false),
  ]);

  // Account names come from TikTok, so a failure there must not blank the screen —
  // the ids alone are enough to create a campaign.
  let advertisers: Array<{ advertiserId: string; name: string; currency: string; status: string }> = [];
  if (grant) {
    const ids = (grant.advertiser_ids || []).map(String).filter(Boolean);
    try {
      const token = await readAdvertiserToken(user.id);
      if (token) advertisers = await getAdvertisers(token, ids);
    } catch { /* fall through to the bare ids */ }
    if (!advertisers.length) {
      advertisers = ids.map((id) => ({ advertiserId: id, name: `حساب ${id}`, currency: "USD", status: "" }));
    }
  }

  return NextResponse.json({
    configured: adsConfigured(),
    connected: !!grant,
    /*
     * Can this customer advertise RIGHT NOW without linking anything?
     *
     * True whenever we fund campaigns from the platform's own ad account — the
     * Facebook model. The create screen uses this to skip the link step
     * entirely, because asking a Libyan shop for a TikTok Ads Manager account
     * and an international card is where almost all of them stop.
     */
    canAdvertise: !!grant || platform,
    /** The spend comes off OUR card, not theirs. Changes what the screen says. */
    platformFunded: !grant && platform,
    connectedAt: grant?.connected_at ?? null,
    advertisers,
    tier,
    vip: tier === "vip",
    minDailyUsd: MIN_DAILY_USD,
    pricing: {
      packages: pricing.packagesTt,
      rate: tier === "vip" ? pricing.vipRate : pricing.regularRate,
      commission: tier === "vip" ? pricing.vipCommission : pricing.regularCommission,
    },
  });
}
