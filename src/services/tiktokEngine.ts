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
import { matchRule, type BotRule } from "@/services/botEngine";
import { generateAiReply, aiAvailable } from "@/services/botAi";
import { getValidAccessToken } from "@/lib/tiktokTokens";
import { checkAppRateLimit, checkAccountRateLimit } from "@/lib/rateLimit";
import { listComments, listVideos, replyToComment, businessIdFromOpenId, TikTokError } from "@/services/tiktok";

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
    .select("id, user_id, page_id, page_name, enabled, ai_enabled, ai_persona, reply_public, throttle_per_min")
    .eq("platform", "tiktok")
    .eq("page_id", openId)
    .eq("enabled", true)
    .maybeSingle();
  if (!config) return null;

  // Same monthly-subscription gate as the Meta side.
  const { data: sub } = await supabaseAdmin
    .from("bot_subscriptions")
    .select("status, expires_at")
    .eq("user_id", config.user_id)
    .eq("page_id", openId)
    .eq("platform", "tiktok")
    .maybeSingle();
  const active = sub && sub.status === "active" &&
    (!sub.expires_at || new Date(sub.expires_at).getTime() > Date.now());
  if (!active) return null;

  return {
    configId: config.id,
    accountId: account.id,
    openId,
    userId: config.user_id,
    pageName: config.page_name,
    aiEnabled: !!config.ai_enabled,
    aiPersona: config.ai_persona,
    replyPublic: config.reply_public !== false,
    throttlePerMin: config.throttle_per_min || 20,
  };
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

/** Decides the reply text: keyword rule first, AI only as the fallback when enabled. */
async function decideReply(target: TikTokTarget, text: string, rules: BotRule[]) {
  const rule = matchRule(text, rules);
  let reply = rule?.public_reply || rule?.private_reply || null;
  if (!reply && target.aiEnabled && aiAvailable()) {
    reply = await generateAiReply(text, target.aiPersona, target.pageName);
  }
  return { rule, reply };
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
  comment: { commentId: string; videoId: string; text: string },
): Promise<void> {
  const rules = await rulesFor(target.configId);
  const { rule, reply } = await decideReply(target, comment.text, rules);

  const patch: Record<string, unknown> = {
    matched_rule_id: rule?.id ?? null,
    private_status: "skipped",         // organic TikTok replies are public
    sent_at: new Date().toISOString(),
    processed_at: new Date().toISOString(),
  };

  if (!reply || !target.replyPublic) {
    await finishComment(comment.commentId, {
      ...patch,
      public_status: "skipped",
      error: reply ? "public_replies_disabled" : "no_rule_match",
    });
    return;
  }

  const sent = await sendReply(target, comment.videoId, comment.commentId, reply);
  await finishComment(comment.commentId, {
    ...patch,
    public_status: sent.ok ? "sent" : "failed",
    error: sent.error ?? null,
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
