import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import { publishPagePhoto, getSystemPageToken } from "@/services/meta";

export const maxDuration = 60;

// POST { planId } — publish/schedule every approved post of a plan to Facebook.
// Requires pages_manage_posts on the Page token (posts that fail return status=failed
// with the reason, surfaced in the Alerts tab). Turns on the plan's auto_publish.
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const { planId } = await req.json();
  if (!planId) return NextResponse.json({ error: "planId مطلوب" }, { status: 400 });

  const { data: plan } = await supabaseAdmin
    .from("studio_plans").select("*").eq("id", planId).eq("user_id", user.id).maybeSingle();
  if (!plan) return NextResponse.json({ error: "الخطة غير موجودة" }, { status: 404 });

  const { data: page } = await supabaseAdmin
    .from("connected_pages").select("page_access_token").eq("user_id", user.id).eq("page_id", plan.page_id).maybeSingle();
  let token = page?.page_access_token as string | undefined;
  // Prefer a fresh system-user token if the stored one is missing.
  if (!token) token = (await getSystemPageToken(plan.page_id)) || undefined;
  if (!token) return NextResponse.json({ error: "تعذّر الوصول لرمز الصفحة — أعد ربط الصفحة" }, { status: 400 });

  const { data: posts } = await supabaseAdmin
    .from("studio_posts").select("*").eq("plan_id", planId)
    .in("status", ["approved", "scheduled", "failed"]);

  await supabaseAdmin.from("studio_plans").update({ auto_publish: true, status: "active" }).eq("id", planId);

  // Bot config for this page — per-post reply settings are written into its
  // post_overrides so the reply bot uses each post's custom reply once it's live.
  const { data: botCfg } = await supabaseAdmin
    .from("bot_configs").select("id, post_overrides").eq("user_id", user.id).eq("page_id", plan.page_id).eq("platform", "meta").maybeSingle();
  const overrides: Record<string, unknown> = { ...((botCfg?.post_overrides as Record<string, unknown>) || {}) };
  let overridesTouched = false;

  const now = Math.floor(Date.now() / 1000);
  let published = 0, scheduled = 0, failed = 0;
  for (const p of posts || []) {
    if (p.external_post_id) continue; // already on Facebook
    const caption = [p.caption, p.hashtags].filter(Boolean).join("\n\n");
    const whenUnix = p.scheduled_for ? Math.floor(new Date(p.scheduled_for).getTime() / 1000) : now;
    try {
      const res = await publishPagePhoto(plan.page_id, token, { message: caption, imageUrl: p.image_url, scheduledUnix: whenUnix });
      const isScheduled = whenUnix > now + 300;
      const externalId = res.postId || res.photoId;
      await supabaseAdmin.from("studio_posts").update({
        status: isScheduled ? "scheduled" : "published",
        external_post_id: externalId,
        published_at: isScheduled ? null : new Date().toISOString(),
        error: null,
      }).eq("id", p.id);
      if (isScheduled) scheduled++; else published++;

      // Bind this post's reply settings to the bot (keyed by the numeric post id).
      const rc = p.reply_config as { enabled?: boolean; public_replies?: string[]; private_reply?: string; like?: boolean } | null;
      if (botCfg && rc && externalId) {
        const numeric = externalId.includes("_") ? externalId.split("_")[1] : externalId;
        overrides[numeric] = rc.enabled === false
          ? { disabled: true }
          : {
              public_replies: (rc.public_replies || []).filter((s) => (s || "").trim()),
              private_reply:  rc.private_reply || "",
              like:           rc.like,
            };
        overridesTouched = true;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Meta error";
      await supabaseAdmin.from("studio_posts").update({ status: "failed", error: msg.slice(0, 300) }).eq("id", p.id);
      failed++;
    }
  }

  if (overridesTouched && botCfg) {
    await supabaseAdmin.from("bot_configs").update({ post_overrides: overrides }).eq("id", botCfg.id);
  }

  const { data: updated } = await supabaseAdmin
    .from("studio_posts").select("*").eq("plan_id", planId).order("scheduled_for", { ascending: true });
  return NextResponse.json({ ok: true, published, scheduled, failed, posts: updated || [] });
}
