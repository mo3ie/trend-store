import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/authUser";
import { getActiveGrant } from "@/lib/tiktokAdsTokens";
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

  const [grant, tier, pricing] = await Promise.all([
    getActiveGrant(user.id),
    getTikTokUserTier(user.id),
    getTikTokAdsPricing(),
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
