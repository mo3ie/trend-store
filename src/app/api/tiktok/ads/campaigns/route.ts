import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import { requireAdsContext } from "@/lib/tiktokAdsContext";
import {
  getTikTokAdsPricing, getTikTokUserTier, findTikTokOption, tiktokPriceFor,
  MIN_DAILY_USD, minTotalUsd,
} from "@/lib/tiktokAdsPricing";
import { TIKTOK_OBJECTIVE_KEYS } from "@/services/tiktokAdsCampaigns";

export const maxDuration = 30;

/** GET — this advertiser's TikTok campaigns, newest first. */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("ad_campaigns").select("*")
    .eq("user_id", user.id).eq("platform", "tiktok")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaigns: data || [] });
}

/**
 * POST — create a TikTok campaign in `pending_payment`.
 *
 * Nothing reaches TikTok here. The row is priced, saved and paid for first, and only
 * `/api/tiktok/ads/launch` (called after payment clears) creates the real campaign —
 * the same order as the Facebook flow, so a failed payment never leaves a live ad.
 *
 * Every price is computed from server-side tables. A client may say which package it
 * picked; it may never say what that package costs.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const body = await req.json();
  const {
    advertiserId, identityId, identityType, itemId, itemIdB, objective, adText,
    landingPageUrl, targeting, packageId, budgetUsd, durationDays, continuous,
  } = body;

  // The grant is verified before anything is priced: a campaign for an ad account the
  // advertiser cannot spend from is worthless however correct its arithmetic.
  const ctx = await requireAdsContext(user.id, advertiserId);
  if (!ctx.ok) return ctx.res;

  if (!identityId) {
    return NextResponse.json({
      error: "identity_required",
      message: "اختر هوية تيك توك التي سيُنشر الإعلان باسمها.",
    }, { status: 400 });
  }

  const objectiveFinal = TIKTOK_OBJECTIVE_KEYS.includes(objective) ? objective : "reach";
  // Only a profile-growth ad can run without a video to promote.
  if (objectiveFinal !== "followers" && !itemId) {
    return NextResponse.json({
      error: "video_required",
      message: "اختر الفيديو الذي تريد ترويجه.",
    }, { status: 400 });
  }

  const tier = await getTikTokUserTier(user.id);
  const pricing = await getTikTokAdsPricing();
  const isContinuous = continuous === true;
  // Two videos means two ad groups, and TikTok's minimum applies to each — so the
  // whole budget has to clear twice the floor. Caught here, before payment.
  const sides = typeof itemIdB === "string" && itemIdB ? 2 : 1;

  let budgetUsdFinal: number, baseLyd: number, serviceFee: number, totalLyd: number, days: number;

  if (isContinuous) {
    // Open-ended: a DAILY budget, debited from the wallet each day, no end date.
    if (tier !== "vip") {
      return NextResponse.json({
        error: "vip_only", message: "الحملات المفتوحة متاحة لمشتركي إعلانات تيك توك فقط",
      }, { status: 403 });
    }
    const usd = Number(budgetUsd);
    if (!usd || usd < MIN_DAILY_USD) {
      return NextResponse.json({
        error: "below_minimum",
        message: `تيك توك يفرض حداً أدنى ${MIN_DAILY_USD}$ للميزانية اليومية.`,
        minDailyUsd: MIN_DAILY_USD,
      }, { status: 400 });
    }
    const price = tiktokPriceFor(usd, tier, pricing);
    budgetUsdFinal = price.budgetUsd;
    baseLyd = price.baseLyd;
    serviceFee = price.commissionLyd;
    totalLyd = price.totalLyd;   // the first day is charged now; the rest daily
    days = 0;
  } else if (packageId) {
    // A fixed package from the server's own price list.
    const found = findTikTokOption(pricing, String(packageId), Number(durationDays));
    if (!found) return NextResponse.json({ error: "الباقة غير صحيحة" }, { status: 400 });
    if (sides === 2 && found.option.budgetUsd < minTotalUsd(found.option.days) * 2) {
      return NextResponse.json({
        error: "below_minimum_ab",
        message: "تجربة فيديوهين تحتاج باقة أكبر — تيك توك يفرض الحد الأدنى على كل فيديو منفصلاً.",
      }, { status: 400 });
    }
    budgetUsdFinal = found.option.budgetUsd;
    baseLyd = found.option.priceLyd;
    serviceFee = 0;
    totalLyd = found.option.priceLyd;
    days = found.option.days;
  } else {
    // A free USD budget — subscribers only, as on the Facebook side.
    if (tier !== "vip") {
      return NextResponse.json({
        error: "vip_only", message: "الميزانية المخصصة متاحة لمشتركي إعلانات تيك توك فقط",
      }, { status: 403 });
    }
    const usd = Number(budgetUsd);
    const d = Number(durationDays);
    if (!d) return NextResponse.json({ error: "المدة مطلوبة" }, { status: 400 });
    const floor = minTotalUsd(d) * sides;
    if (!usd || usd < floor) {
      return NextResponse.json({
        error: "below_minimum",
        message: `تيك توك يفرض حداً أدنى ${MIN_DAILY_USD}$ لكل يوم — أي ${floor}$ على الأقل لمدة ${d} أيام.`,
        minTotalUsd: floor, minDailyUsd: MIN_DAILY_USD,
      }, { status: 400 });
    }
    const price = tiktokPriceFor(usd, tier, pricing);
    budgetUsdFinal = price.budgetUsd;
    baseLyd = price.baseLyd;
    serviceFee = price.commissionLyd;
    totalLyd = price.totalLyd;
    days = d;
  }

  const { data, error } = await supabaseAdmin
    .from("ad_campaigns")
    .insert({
      user_id: user.id,
      platform: "tiktok",
      advertiser_id: ctx.ctx.advertiserId,
      // `page_id` is the campaigns list's label column on both platforms; here it
      // carries the identity so one list can render Facebook and TikTok rows alike.
      page_id: identityId,
      page_name: typeof body.identityName === "string" ? body.identityName : null,
      tiktok_identity_id: identityId,
      tiktok_identity_type: typeof identityType === "string" ? identityType : "TT_USER",
      tiktok_item_id: itemId || null,
      post_url: itemId ? `https://www.tiktok.com/@_/video/${itemId}` : null,
      ad_text: typeof adText === "string" && adText.trim() ? adText.trim().slice(0, 100) : null,
      objective: objectiveFinal,
      placements: ["tiktok"],
      budget_usd: budgetUsdFinal,
      budget: baseLyd,
      duration_days: isContinuous ? null : days,
      service_fee: serviceFee,
      total_price: totalLyd,
      tier,
      status: "pending_payment",
      continuous: isContinuous,
      daily_budget_usd: isContinuous ? budgetUsdFinal : null,
      daily_price_lyd: isContinuous ? totalLyd : null,
      // The B video rides on the targeting blob so the two sides stay together with
      // the campaign they belong to.
      targeting: {
        ...(targeting && typeof targeting === "object" ? targeting : {}),
        landingPageUrl: landingPageUrl || null,
        itemIdB: typeof itemIdB === "string" && itemIdB ? itemIdB : null,
      },
      ab_test: !!(typeof itemIdB === "string" && itemIdB),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaign: data });
}
