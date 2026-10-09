import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import { getSystemPageToken, getPostStats, type PostStats } from "@/services/meta";

export const maxDuration = 60;

/**
 * GET ?pageId=[&planId=][&stats=1] — the state of every post, and how it did.
 *
 * Three facts live in three different places and an owner had no way to line them up:
 * what the plan says (our table), whether it actually reached Facebook (the external
 * id), and whether the custom reply ever reached the bot (`bot_configs.post_overrides`).
 * That last one is why 18 published posts here carry a reply the bot never received —
 * invisible until you join the three.
 *
 * `stats=1` additionally asks Facebook how each published post did. It is opt-in
 * because it is one call per post: useful on demand, wasteful on every page load.
 */

type Row = {
  id: string;
  planId: string;
  caption: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  status: string;
  error: string | null;
  externalPostId: string | null;
  /** Did the owner write a custom reply for this post? */
  hasReply: boolean;
  /** Did that reply actually reach the bot? */
  replyBound: boolean;
  /** Comments the bot has answered on this post. */
  repliesSent: number;
  boost: boolean;
  stats: PostStats | null;
};

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const pageId = req.nextUrl.searchParams.get("pageId");
  if (!pageId) return NextResponse.json({ error: "pageId مطلوب" }, { status: 400 });
  const planId = req.nextUrl.searchParams.get("planId");
  const wantStats = req.nextUrl.searchParams.get("stats") === "1";

  let q = supabaseAdmin
    .from("studio_posts")
    .select("id, plan_id, caption, scheduled_for, published_at, status, error, external_post_id, reply_config, boost")
    .eq("user_id", user.id).eq("page_id", pageId)
    .order("scheduled_for", { ascending: false });
  if (planId) q = q.eq("plan_id", planId);
  const { data: posts, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // What the bot actually holds for this Page.
  const { data: cfg } = await supabaseAdmin
    .from("bot_configs").select("id, post_overrides")
    .eq("user_id", user.id).eq("page_id", pageId).eq("platform", "meta").maybeSingle();
  const overrides = (cfg?.post_overrides || {}) as Record<string, unknown>;
  const isBound = (externalId: string | null) => {
    if (!externalId) return false;
    const numeric = externalId.includes("_") ? externalId.split("_")[1] : externalId;
    return externalId in overrides || numeric in overrides;
  };

  // How many comments the bot has answered, per post. One grouped read rather than
  // one per post — a plan can hold dozens.
  const repliesByPost = new Map<string, number>();
  if (cfg?.id) {
    const { data: logs } = await supabaseAdmin
      .from("bot_reply_log").select("post_id")
      .eq("config_id", cfg.id).eq("public_status", "sent").limit(5000);
    for (const l of logs || []) {
      const k = String(l.post_id ?? "");
      if (k) repliesByPost.set(k, (repliesByPost.get(k) ?? 0) + 1);
    }
  }
  const repliesFor = (externalId: string | null) => {
    if (!externalId) return 0;
    const numeric = externalId.includes("_") ? externalId.split("_")[1] : externalId;
    return (repliesByPost.get(externalId) ?? 0) + (repliesByPost.get(numeric) ?? 0);
  };

  const rows: Row[] = (posts || []).map((p) => ({
    id: p.id,
    planId: p.plan_id,
    caption: p.caption || "",
    scheduledFor: p.scheduled_for,
    publishedAt: p.published_at,
    status: p.status,
    error: p.error,
    externalPostId: p.external_post_id,
    hasReply: !!p.reply_config,
    replyBound: isBound(p.external_post_id),
    repliesSent: repliesFor(p.external_post_id),
    boost: !!p.boost,
    stats: null,
  }));

  if (wantStats) {
    const token = await getSystemPageToken(pageId);
    if (token) {
      const live = rows.filter((r) => r.externalPostId);
      // Bounded concurrency: a plan can hold fifty posts, and fifty parallel Graph
      // calls is how a token gets rate-limited for everything else it has to do.
      const CHUNK = 6;
      for (let i = 0; i < live.length; i += CHUNK) {
        const slice = live.slice(i, i + CHUNK);
        const got = await Promise.all(
          slice.map((r) => getPostStats(r.externalPostId as string, token)),
        );
        slice.forEach((r, n) => { r.stats = got[n]; });
      }
    }
  }

  const published = rows.filter((r) => r.externalPostId).length;
  return NextResponse.json({
    rows,
    summary: {
      total: rows.length,
      published,
      scheduled: rows.filter((r) => r.status === "scheduled").length,
      draft: rows.filter((r) => r.status === "draft").length,
      failed: rows.filter((r) => r.status === "failed").length,
      // The number worth surfacing: a reply the owner wrote that the bot never got.
      repliesUnbound: rows.filter((r) => r.hasReply && r.externalPostId && !r.replyBound).length,
      repliesSent: rows.reduce((n, r) => n + r.repliesSent, 0),
    },
    statsIncluded: wantStats,
  });
}

/**
 * POST { pageId } — attach every published post's reply to the bot.
 *
 * Repairs the posts that went out before binding was its own step, without
 * republishing anything. Kept separate from publishing on purpose: an owner who just
 * wants their replies working should not have to press a button named "publish".
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { pageId } = await req.json();
  if (!pageId) return NextResponse.json({ error: "pageId مطلوب" }, { status: 400 });

  const { data: cfg } = await supabaseAdmin
    .from("bot_configs").select("id, post_overrides")
    .eq("user_id", user.id).eq("page_id", String(pageId)).eq("platform", "meta").maybeSingle();
  if (!cfg) {
    return NextResponse.json({
      error: "no_bot_config",
      message: "لا توجد إعدادات بوت لهذه الصفحة — افتح الرد الآلي لهذه الصفحة أولاً.",
    }, { status: 400 });
  }

  const { data: posts } = await supabaseAdmin
    .from("studio_posts").select("external_post_id, reply_config")
    .eq("user_id", user.id).eq("page_id", String(pageId))
    .not("external_post_id", "is", null)
    .not("reply_config", "is", null);

  const overrides = { ...((cfg.post_overrides || {}) as Record<string, unknown>) };
  let bound = 0;
  for (const p of posts || []) {
    const rc = p.reply_config as {
      enabled?: boolean; public_replies?: string[]; private_reply?: string; like?: boolean;
    };
    const ext = String(p.external_post_id);
    const numeric = ext.includes("_") ? ext.split("_")[1] : ext;
    overrides[numeric] = rc.enabled === false
      ? { disabled: true }
      : {
          public_replies: (rc.public_replies || []).filter((x) => (x || "").trim()),
          private_reply: rc.private_reply || "",
          like: rc.like,
        };
    bound++;
  }

  const { error } = await supabaseAdmin
    .from("bot_configs").update({ post_overrides: overrides }).eq("id", cfg.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, bound });
}
