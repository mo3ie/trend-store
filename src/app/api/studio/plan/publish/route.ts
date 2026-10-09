import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import {
  publishPagePhoto, publishPageVideo, boostPost, getSystemPageToken, canPublishToPage,
} from "@/services/meta";
import { hasProduct } from "@/lib/entitlements";
import { getValidAccessToken } from "@/lib/tiktokTokens";
import { businessIdFromOpenId, canPublish, publishVideo } from "@/services/tiktok";

export const maxDuration = 60;

// POST { planId } — publish/schedule every approved post of a plan to Facebook.
// Requires pages_manage_posts on the Page token (posts that fail return status=failed
// with the reason, surfaced in the Alerts tab). Turns on the plan's auto_publish.

/**
 * Publishes a plan's approved posts to a TikTok account.
 *
 * TikTok takes video, not photos, so a post without a clip is reported as such
 * rather than silently skipped — an owner who approved ten posts and saw "0
 * published" with no reason would have no idea what to fix.
 *
 * Video publishing is NOT in the app's approved scope set yet. Rather than fail
 * one post at a time against the API, the whole call stops with a clear message
 * when the account was never granted it.
 */
async function publishToTikTok(
  userId: string,
  plan: { id: string; page_id: string },
  planId: string,
) {
  const { data: account } = await supabaseAdmin
    .from("tiktok_accounts")
    .select("id, granted_scopes")
    .eq("user_id", userId).eq("tiktok_account_id", plan.page_id).is("revoked_at", null)
    .maybeSingle();
  if (!account) {
    return NextResponse.json({ error: "الحساب غير مرتبط — أعد ربط حساب تيك توك" }, { status: 400 });
  }
  if (!canPublish(account.granted_scopes as string[] | null)) {
    return NextResponse.json({
      error: "publish_scope_missing",
      message: "النشر على تيك توك يحتاج صلاحية نشر الفيديو — لم تُمنح لهذا التطبيق بعد. الخطة محفوظة وجاهزة، وتُنشر فور اعتماد الصلاحية.",
    }, { status: 402 });
  }
  const token = await getValidAccessToken(account.id);
  if (!token) {
    return NextResponse.json({ error: "انتهت صلاحية الربط — أعد ربط حساب تيك توك" }, { status: 400 });
  }

  const { data: posts } = await supabaseAdmin
    .from("studio_posts").select("*").eq("plan_id", planId)
    .in("status", ["approved", "scheduled", "failed"]);

  await supabaseAdmin.from("studio_plans").update({ auto_publish: true, status: "active" }).eq("id", planId);

  const businessId = businessIdFromOpenId(plan.page_id);
  const now = Math.floor(Date.now() / 1000);
  let published = 0, scheduled = 0, failed = 0;

  for (const p of posts || []) {
    if (p.external_post_id) continue;                 // already on TikTok
    const caption = [p.caption, p.hashtags].filter(Boolean).join("\n");
    const whenUnix = p.scheduled_for ? Math.floor(new Date(p.scheduled_for).getTime() / 1000) : now;

    if (!p.video_url) {
      await supabaseAdmin.from("studio_posts").update({
        status: "failed",
        error: "تيك توك ينشر فيديو فقط — ارفع فيديو لهذا المنشور.",
      }).eq("id", p.id);
      failed++;
      continue;
    }

    try {
      const res = await publishVideo(token, businessId, {
        videoUrl: p.video_url, caption, scheduleTime: whenUnix,
      });
      const isScheduled = whenUnix > now + 300;
      await supabaseAdmin.from("studio_posts").update({
        status: isScheduled ? "scheduled" : "published",
        external_post_id: res.publishId,
        published_at: isScheduled ? null : new Date().toISOString(),
        error: null,
      }).eq("id", p.id);
      if (isScheduled) scheduled++; else published++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "TikTok error";
      await supabaseAdmin.from("studio_posts")
        .update({ status: "failed", error: msg.slice(0, 300) }).eq("id", p.id);
      failed++;
    }
  }

  const { data: updated } = await supabaseAdmin
    .from("studio_posts").select("*").eq("plan_id", planId).order("scheduled_for", { ascending: true });
  return NextResponse.json({ ok: true, platform: "tiktok", published, scheduled, failed, posts: updated || [] });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const { planId, postIds } = await req.json();
  // A subset, when the owner picked specific posts. Publishing is N separate calls to
  // Facebook and a dropped connection halfway through leaves the rest unsent with no
  // way to resume just those — so they can send a few at a time and see each land.
  const only: string[] | null = Array.isArray(postIds) && postIds.length
    ? postIds.map(String)
    : null;
  if (!planId) return NextResponse.json({ error: "planId مطلوب" }, { status: 400 });

  const { data: plan } = await supabaseAdmin
    .from("studio_plans").select("*").eq("id", planId).eq("user_id", user.id).maybeSingle();
  if (!plan) return NextResponse.json({ error: "الخطة غير موجودة" }, { status: 404 });

  // A plan belongs to one platform, and each has its own product and its own price.
  const platform: "meta" | "tiktok" = plan.platform === "tiktok" ? "tiktok" : "meta";
  const studioProduct = platform === "tiktok" ? "tiktok_studio" : "studio";

  // Studio gate: admins + 3-day trial pass; afterwards a Studio subscription is required.
  const entitled = await hasProduct(user.id, studioProduct, plan.page_id).catch(() => false);
  if (!entitled) return NextResponse.json({ error: "subscription_required", code: "subscribe", message: "انتهت التجربة المجانية — اشترك في «الموظف الذكي» للمتابعة" }, { status: 402 });

  // ── TikTok: publish videos to the connected account ───────────────────────
  if (platform === "tiktok") {
    return await publishToTikTok(user.id, plan, planId);
  }

  const { data: page } = await supabaseAdmin
    .from("connected_pages").select("page_access_token").eq("user_id", user.id).eq("page_id", plan.page_id).maybeSingle();
  let token = page?.page_access_token as string | undefined;
  // Prefer a fresh system-user token if the stored one is missing.
  if (!token) token = (await getSystemPageToken(plan.page_id)) || undefined;
  if (!token) return NextResponse.json({ error: "تعذّر الوصول لرمز الصفحة — أعد ربط الصفحة" }, { status: 400 });

  /*
   * Pre-flight: can this token publish at all?
   *
   * A Page token carries the permissions it was minted with and never gains more, so
   * a Page connected before `pages_manage_posts` was approved fails every post with a
   * generic "(#200) Permissions error". That is how 42 posts failed here one at a
   * time. One check up front replaces N identical failures with an instruction.
   */
  const publishable = await canPublishToPage(token);
  if (publishable === false) {
    return NextResponse.json({
      error: "reconnect_required",
      message: "هذه الصفحة مرتبطة قبل اعتماد صلاحية النشر. أعد ربطها من زر «ربط صفحة» ثم أعد النشر — خطتك محفوظة كما هي.",
    }, { status: 409 });
  }

  let postQuery = supabaseAdmin
    .from("studio_posts").select("*").eq("plan_id", planId);
  // A chosen subset is published whatever its status — the owner picked it on purpose,
  // including to retry one that failed. Without a selection, only the ones waiting.
  if (only) postQuery = postQuery.in("id", only);
  else postQuery = postQuery.in("status", ["approved", "scheduled", "failed"]);
  const { data: posts } = await postQuery;

  // Publishing a hand-picked few is not "turn this plan on": that switch belongs to
  // publishing the plan, not to sending three posts to test the connection.
  if (!only) {
    await supabaseAdmin.from("studio_plans")
      .update({ auto_publish: true, status: "active" }).eq("id", planId);
  }

  // Bot config for this page — per-post reply settings are written into its
  // post_overrides so the reply bot uses each post's custom reply once it's live.
  const { data: botCfg } = await supabaseAdmin
    .from("bot_configs").select("id, post_overrides").eq("user_id", user.id).eq("page_id", plan.page_id).eq("platform", "meta").maybeSingle();
  const overrides: Record<string, unknown> = { ...((botCfg?.post_overrides as Record<string, unknown>) || {}) };
  let overridesTouched = false;

  /**
   * Attaches a post's custom reply to the bot, keyed by its Facebook id.
   *
   * This used to live inside the publish attempt, which meant it only ever ran when
   * a post published successfully ON THAT RUN. Three ways that lost the owner's work
   * silently: the post failed to publish (as 42 did), the post was already live so
   * the loop skipped it, or the reply was written AFTER publishing. In each case the
   * owner had written a reply, pressed save, and the bot never knew about it.
   *
   * It is a separate step now, applied to every post we know the id of.
   */
  function bindReply(post: Record<string, unknown>, externalId: string | null): boolean {
    const rc = post.reply_config as {
      enabled?: boolean; public_replies?: string[]; private_reply?: string; like?: boolean;
    } | null;
    if (!botCfg || !rc || !externalId) return false;

    const numeric = externalId.includes("_") ? externalId.split("_")[1] : externalId;
    overrides[numeric] = rc.enabled === false
      ? { disabled: true }
      : {
          public_replies: (rc.public_replies || []).filter((x) => (x || "").trim()),
          private_reply:  rc.private_reply || "",
          like:           rc.like,
        };
    return true;
  }

  const now = Math.floor(Date.now() / 1000);
  let published = 0, scheduled = 0, failed = 0, bound = 0;

  // Posts already on Facebook: nothing to publish, but their reply may be new or
  // changed since, and binding it is the whole point of writing one.
  for (const p of posts || []) {
    if (!p.external_post_id) continue;
    if (bindReply(p, p.external_post_id)) { overridesTouched = true; bound++; }
  }

  for (const p of posts || []) {
    if (p.external_post_id) continue; // already on Facebook
    const caption = [p.caption, p.hashtags].filter(Boolean).join("\n\n");
    const whenUnix = p.scheduled_for ? Math.floor(new Date(p.scheduled_for).getTime() / 1000) : now;
    try {
      // A clip the owner uploaded is published as a Page video; otherwise a photo.
      const res = p.video_url
        ? await publishPageVideo(plan.page_id, token, { message: caption, videoUrl: p.video_url, scheduledUnix: whenUnix })
          .then((r) => ({ postId: r.postId, mediaId: r.videoId }))
        : await publishPagePhoto(plan.page_id, token, { message: caption, imageUrl: p.image_url, scheduledUnix: whenUnix })
          .then((r) => ({ postId: r.postId, mediaId: r.photoId }));
      const isScheduled = whenUnix > now + 300;
      const externalId = res.postId || res.mediaId;
      await supabaseAdmin.from("studio_posts").update({
        status: isScheduled ? "scheduled" : "published",
        external_post_id: externalId,
        published_at: isScheduled ? null : new Date().toISOString(),
        error: null,
      }).eq("id", p.id);
      if (isScheduled) scheduled++; else published++;

      // Boosting: only for posts that are live now (a scheduled post is boosted when
      // it publishes, not before) and only when the owner turned it on. Failure here
      // must never mark the post itself failed — it published fine.
      if (p.boost && !isScheduled && externalId) {
        try {
          const tg = (p.boost_targeting || {}) as {
            ageMin?: number; ageMax?: number; gender?: string;
            cities?: Array<{ key: string }>; interests?: Array<{ id: string }>;
            budgetUsd?: number; days?: number;
          };
          const cityKeys = (tg.cities || []).map((x) => x.key).filter(Boolean);
          const targeting: Record<string, unknown> = {
            geo_locations: cityKeys.length
              ? { cities: cityKeys.map((key) => ({ key, radius: 25, distance_unit: "kilometer" })) }
              : { countries: ["LY"] },
            age_min: tg.ageMin ?? 18,
            age_max: tg.ageMax ?? 45,
          };
          if (tg.gender === "male") targeting.genders = [1];
          if (tg.gender === "female") targeting.genders = [2];
          if ((tg.interests || []).length) {
            targeting.flexible_spec = [{ interests: (tg.interests || []).map((i) => ({ id: i.id })) }];
          }

          const boost = await boostPost({
            pageId: plan.page_id,
            postId: externalId,
            pageToken: token,
            budgetUsd: Number(p.boost_budget_usd) || tg.budgetUsd || 5,
            durationDays: Number(p.boost_days) || tg.days || 3,
            campaignName: `Studio — ${String(p.caption || "post").slice(0, 40)}`,
            targeting,
          });
          await supabaseAdmin.from("studio_posts")
            .update({ boost_campaign_id: boost.campaignId }).eq("id", p.id);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "boost failed";
          await supabaseAdmin.from("studio_posts")
            .update({ error: `نُشر بنجاح لكن تعذّر الترويج: ${msg.slice(0, 200)}` }).eq("id", p.id);
        }
      }

      if (bindReply(p, externalId)) { overridesTouched = true; bound++; }
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Meta error";
      // "(#200) Permissions error" says nothing an owner can act on. Name the cause.
      const msg = /#200|permission/i.test(raw)
        ? "صلاحية النشر غير متوفرة لهذه الصفحة — أعد ربط الصفحة ثم أعد المحاولة."
        : raw;
      await supabaseAdmin.from("studio_posts").update({ status: "failed", error: msg.slice(0, 300) }).eq("id", p.id);
      failed++;
    }
  }

  if (overridesTouched && botCfg) {
    await supabaseAdmin.from("bot_configs").update({ post_overrides: overrides }).eq("id", botCfg.id);
  }

  const { data: updated } = await supabaseAdmin
    .from("studio_posts").select("*").eq("plan_id", planId).order("scheduled_for", { ascending: true });

  // A reply written for a post that never reached Facebook has nothing to attach to.
  // Saying so beats letting the owner assume the bot is armed when it is not.
  const unbound = (updated || []).filter(
    (p) => p.reply_config && !p.external_post_id,
  ).length;

  return NextResponse.json({
    ok: true, published, scheduled, failed,
    repliesBound: bound,
    repliesUnbound: unbound,
    posts: updated || [],
  });
}
