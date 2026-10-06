// TikTok comment auto-reply engine (Organic Accounts API v1.3).
//
// Two discovery paths, one pipeline:
//   * the `comment.update` webhook  — PRIMARY. It claims the comment durably (see
//                                     tiktokEvents.ts) and then calls processClaimedComment.
//   * pollAllTikTok()               — BACKSTOP. Reconciliation sweep every 15-30 minutes
//                                     that catches deliveries we missed (events fire
//                                     "within five minutes", delivery is at-least-once and
//                                     retry behaviour is undocumented).
//
// Both paths share the SAME rule matcher as the Meta bot (matchRule from botEngine) and the
// SAME idempotency claim — the UNIQUE(comment_id) constraint on bot_reply_log. There is one
// rule engine in this codebase, not two.
//
// Credentials come from tiktok_tokens via getValidAccessToken (decrypted server-side only).

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  humanPause, isItemTargeted, repliesInLastMinute,
  DEFAULT_PER_MIN, DEFAULT_MIN_DELAY_SEC, DEFAULT_MAX_DELAY_SEC,
} from "@/services/botThrottle";
import { matchRule, overrideHasContent, type BotRule } from "@/services/botEngine";
import { generateAiReply, aiAvailable } from "@/services/botAi";
import { getValidAccessToken } from "@/lib/tiktokTokens";
import { hasProduct } from "@/lib/entitlements";
import { checkAppRateLimit, checkAccountRateLimit } from "@/lib/rateLimit";
import {
  listComments, listVideos, replyToComment, likeComment, hideComment, deleteComment,
  businessIdFromOpenId, TikTokError,
} from "@/services/tiktok";
import { decide, type ReplyGroup, type ReplyPolicy } from "@/services/replyDecision";
import { loadCatalog, matchProduct, productReply } from "@/services/catalogMatcher";
import { featuresFor } from "@/lib/entitlements";
import type { PostOverride } from "@/services/botEngine";

/** The bot's view of a connected TikTok account: credentials + rule configuration. */
export interface TikTokTarget {
  configId: string;
  accountId: string;   // tiktok_accounts.id
  openId: string;      // == business_id
  userId: string;
  pageName: string | null;
  aiEnabled: boolean;
  aiPersona: string | null;
  replyPublic: boolean;
  throttlePerMin: number;
  /** Human-like pacing before each reply — the anti-block defence, shared with Meta. */
  minDelaySec: number;
  maxDelaySec: number;
  /** When set, the bot answers only the videos the owner listed. */
  videoFilter: string[] | null;
  videoFilterEnabled: boolean;
  /** Everything the Facebook bot answers with — the schema is shared, so TikTok
   *  gets the same keyword groups, moderation and per-video overrides. */
  pageId: string;
  replyGroups: ReplyGroup[] | null;
  bannedWords: string[] | null;
  bannedAction: "delete" | "hide" | "ignore";
  mentionAuthor: boolean;
  oncePerUser: boolean;
  likeComments: boolean;
  publicReplies: string[] | null;
  defaultPublicReply: string | null;
  defaultPrivateReply: string | null;
  postOverrides: Record<string, PostOverride> | null;
  catalogMatch: string;
  catalogAmbiguousReply: string | null;
}

/** Loads the account + its bot config, verifying the subscription gate. */
export async function loadTarget(openId: string): Promise<TikTokTarget | null> {
  const { data: account } = await supabaseAdmin
    .from("tiktok_accounts")
    .select("id, user_id, tiktok_account_id")
    .eq("tiktok_account_id", openId)
    .is("revoked_at", null)
    .maybeSingle();
  if (!account) return null;

  const { data: config } = await supabaseAdmin
    .from("bot_configs")
    .select("id, user_id, page_id, page_name, enabled, ai_enabled, ai_persona, reply_public, throttle_per_min, min_delay_sec, max_delay_sec, post_filter, post_filter_enabled, reply_groups, banned_words, banned_action, mention_author, once_per_user, like_comments, public_replies, default_public_reply, default_private_reply, post_overrides, catalog_match, catalog_ambiguous_reply")
    .eq("platform", "tiktok")
    .eq("page_id", openId)
    .eq("enabled", true)
    .maybeSingle();
  if (!config) return null;

  // Same gate as the Meta side: entitlements v2 (new subscription) is the source of
  // truth; the legacy bot_subscriptions row is kept as an OR-fallback for rollback.
  const entitledV2 = await hasProduct(config.user_id, "tiktok_bot", openId).catch(() => false);
  const { data: sub } = await supabaseAdmin
    .from("bot_subscriptions")
    .select("status, expires_at")
    .eq("user_id", config.user_id)
    .eq("page_id", openId)
    .eq("platform", "tiktok")
    .maybeSingle();
  const legacyActive = sub && sub.status === "active" &&
    (!sub.expires_at || new Date(sub.expires_at).getTime() > Date.now());
  if (!entitledV2 && !legacyActive) return null;

  return {
    configId: config.id,
    accountId: account.id,
    openId,
    userId: config.user_id,
    pageName: config.page_name,
    aiEnabled: !!config.ai_enabled,
    aiPersona: config.ai_persona,
    replyPublic: config.reply_public !== false,
    throttlePerMin: config.throttle_per_min || DEFAULT_PER_MIN,
    minDelaySec: config.min_delay_sec ?? DEFAULT_MIN_DELAY_SEC,
    maxDelaySec: config.max_delay_sec ?? DEFAULT_MAX_DELAY_SEC,
    videoFilter: (config.post_filter as string[] | null) ?? null,
    videoFilterEnabled: !!config.post_filter_enabled,
    pageId: config.page_id,
    replyGroups: (config.reply_groups as ReplyGroup[] | null) ?? null,
    bannedWords: (config.banned_words as string[] | null) ?? null,
    bannedAction: (config.banned_action as "delete" | "hide" | "ignore") || "hide",
    mentionAuthor: config.mention_author !== false,
    oncePerUser: config.once_per_user !== false,
    likeComments: !!config.like_comments,
    publicReplies: (config.public_replies as string[] | null) ?? null,
    defaultPublicReply: config.default_public_reply,
    defaultPrivateReply: config.default_private_reply,
    postOverrides: (config.post_overrides as Record<string, PostOverride> | null) ?? null,
    catalogMatch: config.catalog_match || "off",
    catalogAmbiguousReply: config.catalog_ambiguous_reply,
  };
}

/** The override for one video, keyed either way the id can arrive. */
function overrideForVideo(
  overrides: Record<string, PostOverride> | null, videoId: string,
): PostOverride | null {
  if (!overrides || !videoId) return null;
  const tail = videoId.includes("_") ? videoId.split("_")[1] : videoId;
  return overrides[videoId] || overrides[tail] || null;
}

async function rulesFor(configId: string): Promise<BotRule[]> {
  const { data } = await supabaseAdmin
    .from("bot_rules")
    .select("id, keywords, match_type, public_reply, private_reply, attachments, enabled, priority")
    .eq("config_id", configId);
  return (data || []) as BotRule[];
}

/**
 * Claims a comment for processing.
 *
 * The insert either succeeds (we own this comment) or violates UNIQUE(comment_id) (someone
 * already handled it). This is what makes duplicate webhook deliveries — and the overlap
 * between the webhook and the reconciliation poll — safe.
 */
async function claimComment(target: TikTokTarget, comment: {
  commentId: string; videoId: string; text: string; username: string;
}): Promise<boolean> {
  const { error } = await supabaseAdmin.from("bot_reply_log").insert({
    config_id: target.configId,
    page_id: target.openId,
    comment_id: comment.commentId,
    post_id: comment.videoId,
    commenter_name: comment.username,
    comment_message: comment.text,
  });
  return !error;
}

async function finishComment(commentId: string, patch: Record<string, unknown>): Promise<void> {
  await supabaseAdmin.from("bot_reply_log").update(patch).eq("comment_id", commentId);
}

/**
 * Decides the reply using the SAME core as the Facebook bot (services/replyDecision),
 * so keyword groups, banned-word moderation, mentions, the smart catalog and the
 * AI fallback behave identically on both platforms. Only delivery differs.
 *
 * TikTok has no organic private reply, so what Facebook would send as a DM is sent
 * here as the public answer — the private text is the richer one (it carries the
 * price), which is what a commenter actually asked for.
 */
async function decideReply(
  target: TikTokTarget,
  comment: { text: string; videoId: string; username?: string },
  rules: BotRule[],
) {
  const rule = matchRule(comment.text, rules);
  const override = overrideForVideo(target.postOverrides, comment.videoId);
  if (override?.disabled) return { rule: null, decision: null as null, skip: "video_reply_disabled" };

  // The catalog answers "how much is this one?" from the video it was asked under,
  // from a picture, or from the product's name — before any paid model is involved.
  let catalogText: string | null = null;
  if (!rule && target.catalogMatch !== "off"
      && (await featuresFor(target.userId, "tiktok_bot", target.pageId).catch(() => new Set<string>())).has("catalog_reply")) {
    const catalog = await loadCatalog(target.userId, target.pageId);
    if (catalog.length) {
      const m = await matchProduct({
        message: comment.text, postId: comment.videoId, attachmentUrl: null,
        catalog, mode: target.catalogMatch,
      });
      if (m.product) catalogText = productReply(m.product);
      else if (m.signal === "ambiguous") {
        const names = (m.candidates || []).slice(0, 4).map((p) => p.name).join("، ");
        catalogText = (target.catalogAmbiguousReply || "أي منتج تقصد بالضبط؟") + (names ? `\n${names}` : "");
      }
    }
  }

  const policy: ReplyPolicy = {
    mode: override?.mode ?? "groups",
    groups: override?.groups ?? null,
    pageGroups: target.replyGroups,
    inheritGroups: override?.inherit_groups ?? true,
    bannedWords: [...(override?.banned_words || []), ...(target.bannedWords || [])],
    bannedAction: override?.banned_action || target.bannedAction,
    mention: override?.mention ?? target.mentionAuthor,
    like: override?.like ?? target.likeComments,
    flatPublic: override?.public_replies ?? null,
    flatPrivate: override?.private_reply ?? null,
    defaultPublic: target.publicReplies,
    defaultPublicOne: target.defaultPublicReply,
    defaultPrivate: target.defaultPrivateReply,
  };

  // AI stays last, and only when nothing the owner wrote down already answers.
  let aiText: string | null = null;
  const aiWanted = (override?.ai ?? target.aiEnabled) === true;
  if (!rule && !catalogText && aiWanted && aiAvailable()
      && (await featuresFor(target.userId, "tiktok_bot", target.pageId).catch(() => new Set<string>())).has("ai_reply")) {
    aiText = await generateAiReply(comment.text, target.aiPersona, target.pageName);
  }

  const decision = decide({
    message: comment.text,
    fromName: comment.username,
    policy,
    ruleMatched: !!rule,
    rulePublic: rule?.public_replies ?? null,
    rulePublicOne: rule?.public_reply ?? null,
    rulePrivate: rule?.private_reply ?? null,
    catalogText,
    aiText,
  });
  return { rule, decision, skip: null as string | null };
}

/** Hide or delete a comment that tripped the banned-word list. */
async function moderate(
  target: TikTokTarget, videoId: string, commentId: string, action: "delete" | "hide" | "ignore",
): Promise<void> {
  if (action === "ignore") return;
  const token = await getValidAccessToken(target.accountId);
  if (!token) return;
  const businessId = businessIdFromOpenId(target.openId);
  try {
    if (action === "delete") await deleteComment(token, businessId, commentId);
    else await hideComment(token, businessId, videoId, commentId);
  } catch { /* moderation is best-effort — never fail the pipeline over it */ }
}

/** Like a comment, best-effort. */
async function like(target: TikTokTarget, commentId: string): Promise<void> {
  const token = await getValidAccessToken(target.accountId);
  if (!token) return;
  try { await likeComment(token, businessIdFromOpenId(target.openId), commentId); } catch { /* ignore */ }
}

/**
 * Sends one reply, respecting both rate-limit planes:
 *   * the app-wide TikTok budget (shared by every customer), and
 *   * the per-account, per-endpoint budget.
 */
async function sendReply(
  target: TikTokTarget, videoId: string, commentId: string, text: string,
): Promise<{ ok: boolean; error?: string }> {
  const appLimit = await checkAppRateLimit("comment_reply_create");
  if (!appLimit.allowed) return { ok: false, error: "app_rate_limited" };

  const acctLimit = await checkAccountRateLimit(target.accountId, "comment_reply_create");
  if (!acctLimit.allowed) return { ok: false, error: "account_rate_limited" };

  const token = await getValidAccessToken(target.accountId);
  if (!token) return { ok: false, error: "no_valid_token" };

  try {
    await replyToComment(token, businessIdFromOpenId(target.openId), videoId, commentId, text);
    return { ok: true };
  } catch (err) {
    if (err instanceof TikTokError) {
      console.error(err.toLogLine(target.accountId));
      return { ok: false, error: `tiktok_${err.ttCode ?? err.kind}` };
    }
    return { ok: false, error: "reply_failed" };
  }
}

// ── Shared processing step ────────────────────────────────────────────────────

/**
 * Replies to a comment that has ALREADY been claimed in bot_reply_log.
 *
 * Claiming (the UNIQUE(comment_id) insert) happens in exactly two places — the webhook's
 * durable enqueue and the reconciliation poll — and both then land here, so a reply is
 * produced by one code path regardless of how the comment was discovered.
 */
export async function processClaimedComment(
  target: TikTokTarget,
  comment: { commentId: string; videoId: string; text: string; username?: string },
): Promise<void> {
  const rules = await rulesFor(target.configId);

  const patch: Record<string, unknown> = {
    private_status: "skipped",         // organic TikTok replies are public
    sent_at: new Date().toISOString(),
    processed_at: new Date().toISOString(),
  };

  // One answer per person per video: someone who comments five times gets one
  // reply, not five. The claim row for THIS comment already exists, so an earlier
  // answered comment from the same author is what we look for.
  if (target.oncePerUser && comment.username) {
    const { data: prior } = await supabaseAdmin
      .from("bot_reply_log").select("id")
      .eq("config_id", target.configId).eq("post_id", comment.videoId)
      .eq("commenter_name", comment.username)
      .neq("comment_id", comment.commentId)
      .in("public_status", ["sent", "failed"]).limit(1);
    if (prior && prior.length) {
      await finishComment(comment.commentId, { ...patch, public_status: "skipped", error: "already_replied_to_user" });
      return;
    }
  }

  // Video targeting: an owner who listed specific videos expects silence on the rest.
  // A video with its own custom reply is always answered — see `isItemTargeted`.
  if (!isItemTargeted(
        comment.videoId,
        target.videoFilterEnabled,
        target.videoFilter,
        overrideHasContent(overrideForVideo(target.postOverrides, comment.videoId)),
      )) {
    await finishComment(comment.commentId, { ...patch, public_status: "skipped", error: "video_not_targeted" });
    return;
  }

  const { rule, decision, skip } = await decideReply(target, comment, rules);
  patch.matched_rule_id = rule?.id ?? null;

  if (skip || !decision) {
    await finishComment(comment.commentId, { ...patch, public_status: "skipped", error: skip || "no_rule_match" });
    return;
  }

  if (decision.kind === "moderate") {
    await moderate(target, comment.videoId, comment.commentId, decision.action);
    await finishComment(comment.commentId, {
      ...patch, public_status: "skipped", moderation: decision.action, error: "banned_word",
    });
    return;
  }

  if (decision.kind === "silent") {
    await finishComment(comment.commentId, { ...patch, public_status: "skipped", error: decision.reason });
    return;
  }

  // TikTok has no organic private reply, so the richer text — the one carrying the
  // price — becomes the public answer rather than being dropped on the floor.
  const reply = decision.privateText || decision.publicText;
  if (!reply || !target.replyPublic) {
    await finishComment(comment.commentId, {
      ...patch, public_status: "skipped",
      error: reply ? "public_replies_disabled" : "no_rule_match",
    });
    return;
  }

  // Human-like pacing. TikTok's rate limits are the stricter of the two platforms, and
  // this bot was capping replies per sweep without ever waiting between them — a burst
  // of instant replies is exactly what gets an account throttled or blocked.
  await humanPause(target.minDelaySec, target.maxDelaySec);

  const sent = await sendReply(target, comment.videoId, comment.commentId, reply);
  if (sent.ok && decision.like) await like(target, comment.commentId);
  await finishComment(comment.commentId, {
    ...patch,
    public_status: sent.ok ? "sent" : "failed",
    match_signal: decision.source,
    error: sent.error ?? (decision.label ? `group:${decision.label}` : decision.source),
  });
}

// ── BACKSTOP path: reconciliation poll ────────────────────────────────────────

/** How far back the reconciliation sweep looks. Older comments are assumed handled. */
const RECONCILE_WINDOW_SEC = 3 * 60 * 60;

/**
 * Sweeps one account's recent videos for comments the webhook never delivered.
 * Deliberately conservative: a handful of videos, one page of comments each.
 */
async function reconcileAccount(target: TikTokTarget): Promise<number> {
  const token = await getValidAccessToken(target.accountId);
  if (!token) return 0;

  const businessId = businessIdFromOpenId(target.openId);
  const cutoff = Math.floor(Date.now() / 1000) - RECONCILE_WINDOW_SEC;
  let replied = 0;

  const appLimit = await checkAppRateLimit("video_list");
  if (!appLimit.allowed) return 0;

  const videos = await listVideos(token, businessId, { maxCount: 10 });

  for (const video of videos.items) {
    if (replied >= target.throttlePerMin) break;

    const acctLimit = await checkAccountRateLimit(target.accountId, "comment_list");
    if (!acctLimit.allowed) break;

    const page = await listComments(token, businessId, video.videoId, {
      maxCount: 30,
      sortField: "create_time",
      sortOrder: "desc",
    });

    for (const comment of page.items) {
      if (replied >= target.throttlePerMin) break;
      if (comment.createTime && comment.createTime < cutoff) continue;
      if (comment.owner) continue;                    // our own comment
      if (!target.replyPublic) continue;

      // Per-minute budget. Checked before claiming, not after: the claim is what makes
      // duplicate deliveries safe, so a comment we claim and then decline to answer is
      // a comment no later sweep will ever pick up again. Stopping here instead leaves
      // it unclaimed for the next poll.
      if (await repliesInLastMinute(target.configId) >= target.throttlePerMin) return replied;

      // Same claim as the webhook path — whichever gets here first wins, the other no-ops.
      const claimed = await claimComment(target, {
        commentId: comment.commentId,
        videoId: comment.videoId,
        text: comment.text,
        username: comment.username || comment.uniqueIdentifier || "",
      });
      if (!claimed) continue;

      await processClaimedComment(target, {
        commentId: comment.commentId,
        videoId: comment.videoId,
        text: comment.text,
        username: comment.username || comment.uniqueIdentifier || "",
      });
      replied++;
    }
  }

  return replied;
}

/**
 * Reconciliation sweep across every enabled, subscribed TikTok account.
 * Runs on the cron every 15-30 minutes — NOT every minute: the webhook is the primary path
 * and TikTok's app-wide QPM ceiling is shared by all customers.
 */
export async function pollAllTikTok(): Promise<{ accounts: number; replies: number }> {
  const { data: configs } = await supabaseAdmin
    .from("bot_configs")
    .select("page_id")
    .eq("platform", "tiktok")
    .eq("enabled", true);
  if (!configs?.length) return { accounts: 0, replies: 0 };

  let accounts = 0, replies = 0;
  for (const config of configs) {
    const target = await loadTarget(config.page_id as string);
    if (!target) continue;
    accounts++;
    try {
      replies += await reconcileAccount(target);
    } catch (err) {
      // One bad account must never stop the sweep for the others.
      if (err instanceof TikTokError) console.error(err.toLogLine(target.accountId));
    }
  }
  return { accounts, replies };
}
