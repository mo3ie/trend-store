import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readAdvertiserToken } from "@/lib/tiktokAdsTokens";
import { pauseCampaign } from "@/services/tiktokAdsCampaigns";

export const maxDuration = 60;

/**
 * Daily wallet debit for open-ended TikTok campaigns. Run once a day with
 * `Authorization: Bearer <CRON_SECRET>`.
 *
 * The TikTok twin of `/api/promo/campaigns/daily-debit`, and separate from it for a
 * reason that would otherwise cost real money: that route pauses an unpaid campaign
 * through the Meta API, which cannot pause a TikTok campaign. A shared route would
 * mark a TikTok campaign paused in our database while it kept spending on TikTok.
 *
 * Idempotent through `next_charge_at`: a second run on the same day finds nothing due.
 */
export async function GET(req: NextRequest) {
  const secret = (process.env.CRON_SECRET || "").trim();
  const auth = req.headers.get("authorization") || "";
  if (secret && auth !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const nowIso = new Date().toISOString();
  const { data: due, error } = await supabaseAdmin
    .from("ad_campaigns")
    .select("id, user_id, advertiser_id, external_campaign_id, daily_price_lyd, status")
    .eq("platform", "tiktok")
    .eq("continuous", true)
    .in("status", ["active", "in_review"])
    .lte("next_charge_at", nowIso)
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // One token read per advertiser, not per campaign.
  const tokens = new Map<string, string | null>();
  const tokenFor = async (userId: string) => {
    if (!tokens.has(userId)) tokens.set(userId, await readAdvertiserToken(userId).catch(() => null));
    return tokens.get(userId) ?? null;
  };

  let charged = 0, paused = 0;
  for (const c of due || []) {
    const price = Number(c.daily_price_lyd) || 0;
    if (price <= 0) continue;

    const { data: wallet } = await supabaseAdmin
      .from("wallets").select("balance").eq("user_id", c.user_id).maybeSingle();
    const balance = Number(wallet?.balance ?? 0);

    if (balance >= price) {
      await supabaseAdmin.from("wallets")
        .update({ balance: balance - price, updated_at: nowIso })
        .eq("user_id", c.user_id);
      await supabaseAdmin.from("ad_payments").insert({
        user_id: c.user_id, campaign_id: c.id, amount: price, provider: "wallet", status: "success",
      });
      await supabaseAdmin.from("ad_campaigns")
        .update({ next_charge_at: new Date(Date.now() + 86400000).toISOString(), updated_at: nowIso })
        .eq("id", c.id);
      charged++;
      continue;
    }

    // Out of balance: stop the spend on TikTok FIRST, then record it locally. If the
    // remote pause fails the row still says paused, but the error message says the
    // campaign may still be running — silence here would be a bill nobody expected.
    let remotePaused = false;
    if (c.external_campaign_id && c.advertiser_id) {
      const token = await tokenFor(c.user_id);
      if (token) {
        try {
          await pauseCampaign(token, c.advertiser_id, c.external_campaign_id);
          remotePaused = true;
        } catch { /* reported below */ }
      }
    }
    await supabaseAdmin.from("ad_campaigns").update({
      status: "paused",
      error_message: remotePaused
        ? "توقفت مؤقتاً لنفاد رصيد المحفظة — اشحن محفظتك واستأنف الحملة."
        : "نفد رصيد المحفظة وتعذّر إيقاف الحملة على تيك توك — اشحن محفظتك أو أوقفها من TikTok Ads Manager.",
      updated_at: nowIso,
    }).eq("id", c.id);
    paused++;
  }

  return NextResponse.json({ ok: true, due: (due || []).length, charged, paused });
}
