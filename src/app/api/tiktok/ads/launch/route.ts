import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdsContext } from "@/lib/tiktokAdsContext";
import { launchCampaign } from "@/services/tiktokAdsCampaigns";
import { TikTokAdsError } from "@/services/tiktokAds";

export const maxDuration = 60;

/**
 * POST { campaignId } — creates the real TikTok campaign for a PAID row.
 *
 * The TikTok counterpart of `/api/promo/boost`, and like it this is an internal call
 * made after payment clears, not something a browser invokes directly. Its only gate
 * is the campaign's own `status === "paid"`: a row that has not been paid for cannot
 * be launched no matter who asks, and a row already launched is not launched twice.
 */
export async function POST(req: NextRequest) {
  // Internal-only: called by the payment paths once a campaign is paid, never by a
  // browser. Fail closed when a secret is configured — the campaign's `paid` status
  // tells us a launch is legitimate, not who requested it.
  const secret = (process.env.CRON_SECRET || "").trim();
  if (secret && (req.headers.get("authorization") || "") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { campaignId } = await req.json();
  if (!campaignId) return NextResponse.json({ error: "campaignId مطلوب" }, { status: 400 });

  const { data: campaign } = await supabaseAdmin
    .from("ad_campaigns").select("*")
    .eq("id", campaignId).eq("platform", "tiktok")
    .maybeSingle();

  if (!campaign) return NextResponse.json({ error: "الحملة غير موجودة" }, { status: 404 });
  if (campaign.status !== "paid") {
    return NextResponse.json({ error: "الحملة غير جاهزة للإنشاء" }, { status: 400 });
  }
  if (campaign.external_campaign_id) {
    return NextResponse.json({ ok: true, alreadyLaunched: true });
  }

  const fail = async (message: string) => {
    await supabaseAdmin.from("ad_campaigns")
      .update({ status: "failed", error_message: message.slice(0, 300), updated_at: new Date().toISOString() })
      .eq("id", campaignId);
  };

  const ctx = await requireAdsContext(campaign.user_id, campaign.advertiser_id);
  if (!ctx.ok) {
    await fail("انتهى ربط حساب إعلانات تيك توك — أعد الربط ثم أعد المحاولة.");
    return ctx.res;
  }

  await supabaseAdmin.from("ad_campaigns")
    .update({ status: "creating", updated_at: new Date().toISOString() })
    .eq("id", campaignId);

  const tg = (campaign.targeting || {}) as {
    ageMin?: number; ageMax?: number; gender?: string;
    locations?: Array<{ id: string }>; locationIds?: string[];
    interests?: Array<{ id: string }>; interestIds?: string[];
    landingPageUrl?: string | null;
  };

  // The create screen stores picked objects; the API wants bare ids. Accept either,
  // so a campaign saved by an older build still launches.
  const locationIds = tg.locationIds?.length
    ? tg.locationIds
    : (tg.locations || []).map((l) => l.id).filter(Boolean);
  const interestIds = tg.interestIds?.length
    ? tg.interestIds
    : (tg.interests || []).map((i) => i.id).filter(Boolean);

  try {
    const result = await launchCampaign({
      token: ctx.ctx.token,
      advertiserId: ctx.ctx.advertiserId,
      campaignName: `TrendStore — ${campaign.page_name || "TikTok"} — ${String(campaignId).slice(0, 8)}`,
      objective: campaign.objective,
      budgetUsd: Number(campaign.budget_usd) || 0,
      durationDays: Number(campaign.duration_days) || 1,
      continuous: campaign.continuous === true,
      identityId: campaign.tiktok_identity_id,
      identityType: campaign.tiktok_identity_type || "TT_USER",
      itemId: campaign.tiktok_item_id,
      itemIdB: campaign.external_variant_b ? null : (campaign.targeting as { itemIdB?: string })?.itemIdB || null,
      adText: campaign.ad_text,
      landingPageUrl: tg.landingPageUrl || null,
      targeting: {
        ageMin: tg.ageMin, ageMax: tg.ageMax, gender: tg.gender,
        locationIds, interestIds,
      },
    });

    await supabaseAdmin.from("ad_campaigns").update({
      // Not active yet: TikTok reviews every new ad. A sync flips it once reviewed.
      status: "in_review",
      external_campaign_id: result.campaignId,
      external_adset_id: result.adgroupId,   // TikTok calls it an ad group
      external_ad_id: result.adId,
      external_adgroup_b: result.adgroupB ?? null,
      external_ad_b: result.adB ?? null,
      ab_test: !!result.adgroupB,
      error_message: null,
      next_charge_at: campaign.continuous === true
        ? new Date(Date.now() + 86400000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    }).eq("id", campaignId);

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "TikTok API error";
    if (err instanceof TikTokAdsError) console.error(err.toLogLine(campaign.user_id));
    await fail(msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
