import { NextRequest, NextResponse } from "next/server";
import { refundFailedCampaign, withRefundNote } from "@/lib/adsRefund";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { boostPost, extractPostId, getPagePicture } from "@/services/meta";

// POST — create Meta ad for a paid campaign
// Body: { campaignId }
// Called internally after payment success (fire-and-forget)
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

  // Load campaign
  const { data: campaign } = await supabaseAdmin
    .from("ad_campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (!campaign || campaign.status !== "paid") {
    return NextResponse.json({ error: "الحملة غير جاهزة للإنشاء" }, { status: 400 });
  }

  // Mark as creating
  await supabaseAdmin
    .from("ad_campaigns")
    .update({ status: "creating", updated_at: new Date().toISOString() })
    .eq("id", campaignId);

  // Load page access token
  const { data: page } = await supabaseAdmin
    .from("connected_pages")
    .select("page_access_token, page_name")
    .eq("page_id", campaign.page_id)
    .single();

  if (!page) {
    await supabaseAdmin
      .from("ad_campaigns")
      .update({ status: "failed", error_message: withRefundNote("لم يتم العثور على رمز الصفحة — أعد ربط الصفحة", (await refundFailedCampaign(campaignId, "استرجاع — رمز الصفحة مفقود")).refunded), updated_at: new Date().toISOString() })
      .eq("id", campaignId);
    return NextResponse.json({ error: "page token not found" }, { status: 500 });
  }

  const isPageLikes = campaign.objective === "page_likes";
  const isContinuous = campaign.continuous === true;

  // Extract post ID from URL (not needed for Page-likes ads, which promote the Page).
  let postId = "";
  let pagePicture: string | undefined;
  if (isPageLikes) {
    // Prefer the advertiser's uploaded image; otherwise use the Page picture.
    pagePicture = campaign.ad_image || (await getPagePicture(campaign.page_id, page.page_access_token)) || undefined;
  } else {
    const pid = extractPostId(campaign.post_url);
    if (!pid) {
      const back = await refundFailedCampaign(campaignId, "استرجاع — رابط المنشور غير صالح");
      await supabaseAdmin
        .from("ad_campaigns")
        .update({
          status: "failed",
          error_message: withRefundNote("تعذّر استخراج رقم المنشور من الرابط", back.refunded),
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaignId);
      return NextResponse.json({ error: "cannot extract post id" }, { status: 400 });
    }
    postId = pid;
  }

  try {
    const result = await boostPost({
      pageId:       campaign.page_id,
      postId,
      pageToken:    page.page_access_token,
      budgetUsd:    campaign.budget_usd ?? undefined,
      budgetLyd:    campaign.budget,
      durationDays: campaign.duration_days,
      campaignName: `TrendStore - ${page.page_name || campaign.page_id} - ${campaignId.slice(0, 8)}`,
      targeting:    campaign.targeting,
      objective:         campaign.objective ?? undefined,
      placements:        Array.isArray(campaign.placements) && campaign.placements.length ? campaign.placements : undefined,
      advantageAudience: campaign.advantage_audience ?? undefined,
      specialAdCategory: campaign.special_ad_category ?? undefined,
      targetingB:        campaign.ab_test && campaign.targeting_b ? campaign.targeting_b : undefined,
      adText:            isPageLikes ? (campaign.ad_text || undefined) : undefined,
      pagePicture,
      continuous:        campaign.continuous ?? undefined,
    });

    await supabaseAdmin
      .from("ad_campaigns")
      .update({
        // Not "active" yet — Meta reviews the ad first. A sync flips it to
        // active / rejected / paused based on the real effective_status.
        status:               "in_review",
        external_campaign_id: result.campaignId,
        external_adset_id:    result.adsetId,
        external_ad_id:       result.adId,
        external_variant_b:   result.variantB ?? null,
        // Continuous campaigns paid day 1 at checkout — next wallet debit tomorrow.
        next_charge_at:       isContinuous ? new Date(Date.now() + 86400000).toISOString() : null,
        updated_at:           new Date().toISOString(),
      })
      .eq("id", campaignId);

    console.log("Meta boost created ✅ campaign:", campaignId, result);
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Meta API error";
    console.error("Meta boost failed ❌", campaignId, msg);

    // The ad never ran, so the customer must not stay charged for it.
    const back = await refundFailedCampaign(campaignId, "استرجاع — تعذّر إنشاء الإعلان");

    await supabaseAdmin
      .from("ad_campaigns")
      .update({
        status: "failed",
        error_message: withRefundNote(msg, back.refunded),
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaignId);

    return NextResponse.json({ error: msg, refunded: back.refunded }, { status: 500 });
  }
}
