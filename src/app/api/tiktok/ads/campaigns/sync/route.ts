import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import { readAdvertiserToken } from "@/lib/tiktokAdsTokens";
import { getCampaignStats, mapStatus } from "@/services/tiktokAdsCampaigns";

export const maxDuration = 60;

/**
 * POST — refresh live status and numbers for the user's running TikTok campaigns.
 *
 * Only rows that actually reached TikTok are touched. The token is read once for all
 * of them rather than per row, and a campaign whose report fails is left exactly as
 * it was: stale numbers are better than zeroed ones, which an advertiser would read
 * as "my campaign stopped working".
 */
export async function POST() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { data: rows } = await supabaseAdmin
    .from("ad_campaigns")
    .select("id, external_campaign_id, advertiser_id, status")
    .eq("user_id", user.id).eq("platform", "tiktok")
    .not("external_campaign_id", "is", null)
    .in("status", ["creating", "in_review", "active", "paused", "issues"]);

  if (!rows?.length) return NextResponse.json({ synced: 0 });

  const token = await readAdvertiserToken(user.id);
  if (!token) {
    return NextResponse.json({
      error: "no_valid_token",
      message: "انتهى ربط حساب الإعلانات — أعد الربط لمتابعة نتائج حملاتك.",
      synced: 0,
    }, { status: 400 });
  }

  let synced = 0;
  await Promise.all(rows.map(async (row) => {
    if (!row.advertiser_id) return;
    try {
      const stats = await getCampaignStats(token, row.advertiser_id, row.external_campaign_id!);
      const patch: Record<string, unknown> = {
        reach: stats.reach, impressions: stats.impressions, clicks: stats.clicks,
        spend_usd: stats.spendUsd, insights_at: new Date().toISOString(),
      };
      // Only overwrite the status when TikTok gave one we understand — an unmapped
      // value must not silently demote a campaign the advertiser can see is running.
      const mapped = mapStatus(stats.status);
      if (mapped) patch.status = mapped;
      await supabaseAdmin.from("ad_campaigns")
        .update(patch).eq("id", row.id).eq("user_id", user.id);
      synced++;
    } catch { /* keep the stored numbers */ }
  }));

  return NextResponse.json({ synced });
}
