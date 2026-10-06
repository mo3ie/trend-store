import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import { adsContextForCampaign } from "@/lib/tiktokAdsContext";
import {
  pauseCampaign, resumeCampaign, deleteCampaign, getCampaignStats, mapStatus,
} from "@/services/tiktokAdsCampaigns";
import { TikTokAdsError } from "@/services/tiktokAds";

export const maxDuration = 30;

type Params = Promise<{ id: string }>;

/** GET — one campaign, with its numbers refreshed from TikTok when it is live. */
export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const resolved = await adsContextForCampaign(user.id, id);
  const campaign = resolved.campaign;
  if (!campaign) return (resolved as { res: NextResponse }).res;

  // A campaign that never reached TikTok, or a lapsed connection, still returns the
  // stored row — the advertiser needs to see what they paid for either way.
  if (!resolved.ok || !campaign.external_campaign_id) {
    return NextResponse.json({ campaign });
  }

  try {
    const stats = await getCampaignStats(
      resolved.ctx.token, resolved.ctx.advertiserId, String(campaign.external_campaign_id),
    );
    const patch: Record<string, unknown> = {
      reach: stats.reach, impressions: stats.impressions, clicks: stats.clicks,
      spend_usd: stats.spendUsd, insights_at: new Date().toISOString(),
    };
    const mapped = mapStatus(stats.status);
    if (mapped) patch.status = mapped;
    await supabaseAdmin.from("ad_campaigns").update(patch).eq("id", id).eq("user_id", user.id);
    return NextResponse.json({ campaign: { ...campaign, ...patch } });
  } catch {
    return NextResponse.json({ campaign });
  }
}

/**
 * PATCH { action: "pause" | "resume" } — the advertiser's own stop/start control.
 *
 * TikTok is changed before the database, never the other way round: a row that says
 * "paused" while the ad still spends is the one failure mode that costs the customer
 * money, so the local status only moves once TikTok has confirmed.
 */
export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { action } = await req.json();
  if (action !== "pause" && action !== "resume") {
    return NextResponse.json({ error: "action غير صحيح" }, { status: 400 });
  }

  const resolved = await adsContextForCampaign(user.id, id);
  if (!resolved.ok) return resolved.res;
  const campaign = resolved.campaign!;

  if (!campaign.external_campaign_id) {
    return NextResponse.json({ error: "لم تُنشأ الحملة على تيك توك بعد" }, { status: 400 });
  }

  try {
    const fn = action === "pause" ? pauseCampaign : resumeCampaign;
    await fn(resolved.ctx.token, resolved.ctx.advertiserId, String(campaign.external_campaign_id));
  } catch (e) {
    if (e instanceof TikTokAdsError) console.error(e.toLogLine(user.id));
    const msg = e instanceof Error ? e.message : "TikTok error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // Resuming hands the campaign back to TikTok's own state machine (it may go
  // straight back into review), so the honest local value is "in_review", not "active".
  const status = action === "pause" ? "paused" : "in_review";
  await supabaseAdmin.from("ad_campaigns")
    .update({ status, error_message: null, updated_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", user.id);

  return NextResponse.json({ ok: true, status });
}

/**
 * DELETE — stop a campaign for good.
 *
 * Deletes on TikTok and marks the row completed rather than removing it: the payment,
 * the invoice and the spend stay on the record. Money that was charged does not
 * disappear from the customer's history because they closed the campaign.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const resolved = await adsContextForCampaign(user.id, id);
  if (!resolved.ok) return resolved.res;
  const campaign = resolved.campaign!;

  if (campaign.external_campaign_id) {
    try {
      await deleteCampaign(
        resolved.ctx.token, resolved.ctx.advertiserId, String(campaign.external_campaign_id),
      );
    } catch (e) {
      if (e instanceof TikTokAdsError) console.error(e.toLogLine(user.id));
      return NextResponse.json({ error: "تعذّر إيقاف الحملة على تيك توك" }, { status: 502 });
    }
  }

  await supabaseAdmin.from("ad_campaigns")
    .update({ status: "completed", next_charge_at: null, updated_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
