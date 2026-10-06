/**
 * Sends a paid campaign to the platform that will actually run it.
 *
 * Both payment paths (wallet and MobiCash OTP) end in the same step — "it is paid,
 * now create it" — but the two platforms have different creation routes, and getting
 * this branch wrong is expensive in both directions: a TikTok campaign sent to the
 * Meta route fails and the customer is charged for nothing, while a Meta campaign
 * sent to the TikTok route does the same. One helper, used by every payment path, so
 * the decision exists in exactly one place.
 *
 * Fire-and-forget by design: the customer's payment must not fail because the
 * platform's API was slow. A campaign that does not launch is left in `paid`, which
 * the campaigns screen shows and the launch route can safely retry.
 */
export function launchPaidCampaign(campaignId: string, platform: string | null | undefined): void {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://trendstore-ly.com";
  const path = platform === "tiktok" ? "/api/tiktok/ads/launch" : "/api/promo/boost";
  fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ campaignId }),
  }).catch(() => {});
}

/** Where the customer lands after paying — each platform has its own campaigns list. */
export function campaignsPathFor(platform: string | null | undefined): string {
  return platform === "tiktok" ? "/tiktok-ads/campaigns?paid=1" : "/ads/campaigns?paid=1";
}
