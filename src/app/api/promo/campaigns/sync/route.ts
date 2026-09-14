import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAdEffectiveStatus, getCampaignInsights, mapEffectiveStatus } from "@/services/meta";

async function getUser() {
  const store = await cookies();
  const anon = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => store.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await anon.auth.getUser();
  return user;
}

// POST — refresh live status + insights from Meta for the user's running campaigns.
// Only touches campaigns that reached Meta (have external_campaign_id). Called by the
// "My campaigns" screen on load.
export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { data: rows } = await supabaseAdmin
    .from("ad_campaigns")
    .select("id, external_campaign_id, external_ad_id, status")
    .eq("user_id", user.id)
    .not("external_campaign_id", "is", null)
    .in("status", ["in_review", "active", "paused", "issues", "creating"]);

  if (!rows?.length) return NextResponse.json({ synced: 0 });

  let synced = 0;
  await Promise.all(rows.map(async (row) => {
    const [effective, insights] = await Promise.all([
      row.external_ad_id ? getAdEffectiveStatus(row.external_ad_id) : Promise.resolve(null),
      getCampaignInsights(row.external_campaign_id),
    ]);
    const patch: Record<string, unknown> = {
      reach: insights.reach, impressions: insights.impressions, clicks: insights.clicks,
      spend_usd: insights.spendUsd, insights_at: new Date().toISOString(),
    };
    if (effective) patch.status = mapEffectiveStatus(effective);
    await supabaseAdmin.from("ad_campaigns").update(patch).eq("id", row.id).eq("user_id", user.id);
    synced++;
  }));

  return NextResponse.json({ synced });
}
