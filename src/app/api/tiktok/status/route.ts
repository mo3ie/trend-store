import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import { tiktokConfigured } from "@/services/tiktok";
import { adsConfigured } from "@/services/tiktokAds";

export const maxDuration = 30;

/**
 * GET — one call that tells the TikTok hub everything it needs to describe each tool
 * in terms of the user's OWN data: "3 rules ready · stopped", "7-day plan ready",
 * "no campaigns".
 *
 * The hub used to describe the tools with feature bullets, which is marketing, not
 * information — it reads the same on every account and on the first visit. A status
 * line built from what the user has actually set is the thing that tells them where
 * they left off.
 *
 * It also reports whether linking is available at all, so each screen can say so
 * plainly instead of offering a button that fails.
 */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const [account, configs, plans, campaigns, prices, adsGrant] = await Promise.all([
    supabaseAdmin.from("tiktok_accounts")
      .select("id, tiktok_account_id, display_name, avatar_url")
      .eq("user_id", user.id).is("revoked_at", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from("bot_configs")
      .select("id, enabled, page_id")
      .eq("user_id", user.id).eq("platform", "tiktok"),
    supabaseAdmin.from("studio_plans")
      .select("id, status, duration_days, created_at")
      .eq("user_id", user.id).eq("platform", "tiktok")
      .order("created_at", { ascending: false }).limit(1),
    supabaseAdmin.from("ad_campaigns")
      .select("id, status")
      .eq("user_id", user.id).eq("platform", "tiktok"),
    // The cheapest ACTIVE monthly plan per TikTok product, for the subscribe bar.
    supabaseAdmin.from("subscription_plans")
      .select("product, price_lyd, months, active")
      .in("product", ["tiktok_bot", "tiktok_studio", "tiktok_ads"])
      .eq("active", true).eq("months", 1),
    supabaseAdmin.from("tiktok_ads_authorizations")
      .select("id").eq("user_id", user.id).eq("status", "active").maybeSingle(),
  ]);

  // Rules are counted per config, so one query covers however many accounts exist.
  const configIds = (configs.data || []).map((c) => c.id);
  let ruleCount = 0;
  if (configIds.length) {
    const { count } = await supabaseAdmin
      .from("bot_rules").select("id", { count: "exact", head: true })
      .in("config_id", configIds);
    ruleCount = count ?? 0;
  }

  const plan = plans.data?.[0] ?? null;
  const camps = campaigns.data || [];

  const priceFor = (product: string) => {
    const rows = (prices.data || []).filter((p) => p.product === product);
    if (!rows.length) return null;
    return Math.min(...rows.map((p) => Number(p.price_lyd)));
  };

  return NextResponse.json({
    // Linking availability is an operator matter, not something a user can retry.
    linking: {
      organic: tiktokConfigured(),
      ads: adsConfigured(),
    },
    account: account.data
      ? {
          id: account.data.id,
          openId: account.data.tiktok_account_id,
          handle: account.data.display_name || "tiktok",
          avatarUrl: account.data.avatar_url,
        }
      : null,
    bot: {
      configured: (configs.data || []).length > 0,
      enabled: (configs.data || []).some((c) => c.enabled),
      rules: ruleCount,
      priceLyd: priceFor("tiktok_bot"),
    },
    studio: {
      hasPlan: !!plan,
      planDays: plan?.duration_days ?? null,
      planStatus: plan?.status ?? null,
      priceLyd: priceFor("tiktok_studio"),
    },
    ads: {
      connected: !!adsGrant.data,
      total: camps.length,
      live: camps.filter((c) => ["active", "in_review"].includes(c.status)).length,
      priceLyd: priceFor("tiktok_ads"),
    },
  });
}
