import { NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import { activeSubscriptions, getAccess } from "@/lib/entitlements";

/**
 * Everything the «أدوات فيسبوك» hub shows about the signed-in customer, in one call.
 * Real values only — every query is scoped to the caller's user_id; a stranger gets
 * { signedIn:false } and the page shows its onboarding state instead of numbers.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ signedIn: false });

  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
  // week = Saturday → Friday (Libya)
  const now = new Date();
  const weekStart = new Date(now); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 1) % 7));
  const weekEnd = new Date(weekStart.getTime() + 7 * 864e5);

  const [pagesRes, campaignsRes, configsRes, postsRes, subs, access] = await Promise.all([
    db.from("connected_pages").select("page_id,page_name,page_picture,platform,created_at").eq("user_id", user.id).order("created_at", { ascending: true }),
    db.from("ad_campaigns").select("status").eq("user_id", user.id).in("status", ["active", "in_review", "paused"]),
    db.from("bot_configs").select("id,enabled").eq("user_id", user.id),
    db.from("studio_posts").select("status,scheduled_for,published_at").eq("user_id", user.id)
      .gte("scheduled_for", weekStart.toISOString()).lt("scheduled_for", weekEnd.toISOString()),
    activeSubscriptions(user.id),
    getAccess(user.id),
  ]);

  const configIds = (configsRes.data || []).map((c) => c.id);
  let replies30 = 0;
  if (configIds.length) {
    const { count } = await db.from("bot_reply_log").select("id", { count: "exact", head: true })
      .in("config_id", configIds).gte("created_at", since30).is("error", null);
    replies30 = count || 0;
  }

  const pages = (pagesRes.data || []).filter((p) => !p.platform || p.platform === "facebook");
  const camps = campaignsRes.data || [];
  const posts = postsRes.data || [];

  return NextResponse.json({
    signedIn: true,
    name: (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || "",
    pages: pages.map((p) => ({ id: p.page_id, name: p.page_name, picture: p.page_picture, since: p.created_at })),
    stats: {
      pages: pages.length,
      activeCampaigns: camps.filter((c) => c.status === "active").length,
      inReview: camps.filter((c) => c.status === "in_review").length,
      botsOn: (configsRes.data || []).filter((c) => c.enabled).length,
      replies30,
      postsWeek: posts.length,
      publishedWeek: posts.filter((p) => p.published_at || p.status === "published").length,
    },
    subscriptions: (subs || []).map((s) => ({
      product: s.product, tier: s.tier, page_scope: s.page_scope, expires_at: s.expires_at, auto_renew: s.auto_renew,
    })),
    access,
  });
}
