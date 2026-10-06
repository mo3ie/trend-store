import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getActiveGrant, readAdvertiserToken } from "@/lib/tiktokAdsTokens";

/**
 * Resolves the three things every TikTok Marketing API call needs: the advertiser's
 * token, the ad account to spend from, and the right refusal when either is missing.
 *
 * Every ads route needs this identical preamble, and the failure messages matter more
 * than the happy path: "not connected", "connection revoked" and "that ad account is
 * not yours" are three different problems with three different fixes, and an
 * advertiser who gets one generic error has no idea which one they are looking at.
 */

export interface AdsContext {
  token: string;
  advertiserId: string;
  /** Every ad account this grant covers, for the account picker. */
  advertiserIds: string[];
}

export type AdsContextResult =
  | { ok: true; ctx: AdsContext }
  | { ok: false; res: NextResponse };

export async function requireAdsContext(
  userId: string,
  requestedAdvertiserId?: string | null,
): Promise<AdsContextResult> {
  const grant = await getActiveGrant(userId);
  if (!grant) {
    return {
      ok: false,
      res: NextResponse.json({
        error: "not_connected",
        message: "لم تربط حساب إعلانات تيك توك بعد — اربطه أولاً.",
      }, { status: 400 }),
    };
  }

  const advertiserIds = (grant.advertiser_ids || []).map(String).filter(Boolean);
  if (!advertiserIds.length) {
    return {
      ok: false,
      res: NextResponse.json({
        error: "no_advertiser",
        message: "الربط لا يشمل أي حساب إعلاني — أنشئ حساباً إعلانياً في TikTok Ads Manager ثم أعد الربط.",
      }, { status: 400 }),
    };
  }

  // A client may pass any id; only one this grant actually covers is accepted.
  const advertiserId = requestedAdvertiserId
    ? advertiserIds.find((id) => id === String(requestedAdvertiserId))
    : advertiserIds[0];
  if (!advertiserId) {
    return {
      ok: false,
      res: NextResponse.json({
        error: "advertiser_not_granted",
        message: "هذا الحساب الإعلاني غير مشمول بالربط.",
      }, { status: 403 }),
    };
  }

  const token = await readAdvertiserToken(userId);
  if (!token) {
    return {
      ok: false,
      res: NextResponse.json({
        error: "no_valid_token",
        message: "انتهى ربط حساب الإعلانات — أعد الربط.",
      }, { status: 400 }),
    };
  }

  return { ok: true, ctx: { token, advertiserId, advertiserIds } };
}

/**
 * The same resolution for a campaign already in the database, where the advertiser id
 * is whatever the campaign was created under — not the account currently selected in
 * the UI, which may well have changed since.
 */
export async function adsContextForCampaign(
  userId: string, campaignId: string,
): Promise<AdsContextResult & { campaign?: Record<string, unknown> }> {
  const { data: campaign } = await supabaseAdmin
    .from("ad_campaigns").select("*")
    .eq("id", campaignId).eq("user_id", userId).eq("platform", "tiktok")
    .maybeSingle();

  if (!campaign) {
    return { ok: false, res: NextResponse.json({ error: "الحملة غير موجودة" }, { status: 404 }) };
  }

  const resolved = await requireAdsContext(userId, campaign.advertiser_id as string | null);
  return resolved.ok ? { ...resolved, campaign } : resolved;
}
