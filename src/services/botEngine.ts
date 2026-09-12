// Comment auto-reply bot engine.
// Matches an incoming Facebook comment against the page's keyword rules, then posts
// a public reply + a private reply (DM), rotating Page access tokens on rate-limit.
// Idempotency is guaranteed by the UNIQUE(comment_id) row in bot_reply_log.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  replyToComment,
  sendPrivateReply,
  type BotAttachment,
} from "@/services/meta";
import { generateAiReply, aiAvailable } from "@/services/botAi";

export interface BotRule {
  id:            string;
  keywords:      string[];
  match_type:    string;
  public_reply:  string | null;
  private_reply: string | null;
  attachments:   BotAttachment[];
  enabled:       boolean;
  priority:      number;
}

export interface CommentEvent {
  pageId:     string;
  commentId:  string;
  postId:     string;
  message:    string;
  fromId:     string;
  fromName:   string;
}

// Meta error strings/codes that mean "you're posting too fast / temporarily blocked".
function isRateLimit(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("(#32)") ||
    m.includes("(#613)") ||
    m.includes("(#368)") ||
    m.includes("rate limit") ||
    m.includes("too many") ||
    m.includes("temporarily blocked") ||
    m.includes("spam")
  );
}

// Normalises Arabic/English text for matching: lowercase, strip tashkeel, collapse
// whitespace, and unify alef/hamza + taa-marbuta so "بكم" and "بكم؟" both match.
function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[ً-ْ]/g, "")     // tashkeel
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")   // drop punctuation/emoji
    .replace(/\s+/g, " ")
    .trim();
}

// Returns the highest-priority enabled rule matching the comment, or null.
export function matchRule(message: string, rules: BotRule[]): BotRule | null {
  const text = normalize(message);
  const sorted = [...rules]
    .filter((r) => r.enabled)
    .sort((a, b) => b.priority - a.priority);

  for (const rule of sorted) {
    const kws = (rule.keywords || []).map(normalize).filter(Boolean);
    switch (rule.match_type) {
      case "catch_all":
        return rule;
      case "exact":
        if (kws.some((k) => text === k)) return rule;
        break;
      case "all_contains":
        if (kws.length > 0 && kws.every((k) => text.includes(k))) return rule;
        break;
      case "regex":
        for (const k of rule.keywords || []) {
          try { if (new RegExp(k, "iu").test(message)) return rule; } catch { /* bad regex */ }
        }
        break;
      case "any_contains":
      default:
        if (kws.some((k) => text.includes(k))) return rule;
    }
  }
  return null;
}

// ── Throttle (primary anti-block defense) ────────────────────────────────────
// When a post goes viral, hundreds of comments arrive at once. Replying to all of
// them instantly is exactly what trips Facebook's spam detection and gets the
// account temporarily blocked. We cap replies per page per minute using the
// bot_reply_log as the counter (durable across serverless instances) and add a
// small human-like jitter before each reply.
async function throttleGate(configId: string, perMin: number): Promise<boolean> {
  const since = new Date(Date.now() - 60_000).toISOString();
  // Count by sent_at (when we actually hit the Graph API), NOT created_at (when the
  // comment arrived) — otherwise drained rows carry an old created_at, never count
  // toward the current minute, and the drain blows straight through the cap.
  const { count } = await supabaseAdmin
    .from("bot_reply_log")
    .select("id", { count: "exact", head: true })
    .eq("config_id", configId)
    .gte("sent_at", since);

  if ((count ?? 0) >= perMin) return false; // over budget → defer this comment

  // Human-like pacing: 400–1600 ms before we touch the Graph API.
  await new Promise((r) => setTimeout(r, 400 + Math.random() * 1200));
  return true;
}

interface PoolToken { id: string; access_token: string; }

// Picks the least-recently-used ACTIVE token for a config, reactivating any whose
// cooldown has elapsed. Returns null if every token is dead/cooling-down.
async function pickToken(configId: string): Promise<PoolToken | null> {
  const nowIso = new Date().toISOString();

  // Reactivate cooled-down tokens.
  await supabaseAdmin
    .from("bot_page_tokens")
    .update({ status: "active", cooldown_until: null })
    .eq("config_id", configId)
    .eq("status", "cooldown")
    .lt("cooldown_until", nowIso);

  const { data } = await supabaseAdmin
    .from("bot_page_tokens")
    .select("id, access_token, last_used_at")
    .eq("config_id", configId)
    .eq("status", "active")
    .order("last_used_at", { ascending: true, nullsFirst: true })
    .limit(1);

  if (!data || data.length === 0) return null;
  const tok = data[0];
  await supabaseAdmin
    .from("bot_page_tokens")
    .update({ last_used_at: nowIso })
    .eq("id", tok.id);
  return { id: tok.id, access_token: tok.access_token };
}

// Puts a token into cooldown after a rate-limit block so the pool fails over.
async function coolDown(tokenId: string, minutes = 30): Promise<void> {
  const until = new Date(Date.now() + minutes * 60_000).toISOString();
  const { data } = await supabaseAdmin
    .from("bot_page_tokens")
    .select("fail_count")
    .eq("id", tokenId)
    .single();
  await supabaseAdmin
    .from("bot_page_tokens")
    .update({
      status: "cooldown",
      cooldown_until: until,
      fail_count: (data?.fail_count ?? 0) + 1,
    })
    .eq("id", tokenId);
}

// Runs a Graph call with token rotation: on a rate-limit error the current token is
// cooled down and the next active token is tried, up to `maxTries` distinct tokens.
async function withRotation<T>(
  configId: string,
  fn: (token: string) => Promise<T>,
  maxTries = 3
): Promise<{ ok: true; value: T; tokenId: string } | { ok: false; error: string }> {
  let lastErr = "no active token";
  for (let i = 0; i < maxTries; i++) {
    const tok = await pickToken(configId);
    if (!tok) return { ok: false, error: lastErr };
    try {
      const value = await fn(tok.access_token);
      return { ok: true, value, tokenId: tok.id };
    } catch (err: unknown) {
      lastErr = err instanceof Error ? err.message : "error";
      if (isRateLimit(lastErr)) {
        await coolDown(tok.id);
        continue; // fail over to the next token
      }
      return { ok: false, error: lastErr }; // non-rate-limit error → stop
    }
  }
  return { ok: false, error: lastErr };
}

// Processes one comment end-to-end. Safe to call concurrently: the first inserter of
// comment_id wins; everyone else no-ops. Returns a short status for logging.
export async function processComment(ev: CommentEvent): Promise<string> {
  // Anti-loop: never reply to the page's own comments (incl. our public replies).
  if (ev.fromId && ev.fromId === ev.pageId) return "skipped_self";

  // Load an active config for this page.
  const { data: config } = await supabaseAdmin
    .from("bot_configs")
    .select("id, user_id, enabled, reply_public, reply_private, default_public_reply, ai_enabled, ai_persona, page_name, throttle_per_min")
    .eq("page_id", ev.pageId)
    .eq("platform", "meta")
    .eq("enabled", true)
    .maybeSingle();
  if (!config) return "no_active_config";

  // Subscription gate — only run for pages with an active bot subscription.
  const { data: sub } = await supabaseAdmin
    .from("bot_subscriptions")
    .select("status, expires_at")
    .eq("user_id", config.user_id)
    .eq("page_id", ev.pageId)
    .maybeSingle();
  const subActive =
    sub &&
    sub.status === "active" &&
    (!sub.expires_at || new Date(sub.expires_at).getTime() > Date.now());
  if (!subActive) return "no_active_subscription";

  // Idempotency: claim this comment. Duplicate → someone already handled it.
  const { error: claimErr } = await supabaseAdmin.from("bot_reply_log").insert({
    config_id:       config.id,
    page_id:         ev.pageId,
    comment_id:      ev.commentId,
    post_id:         ev.postId,
    commenter_id:    ev.fromId,
    commenter_name:  ev.fromName,
    comment_message: ev.message,
  });
  if (claimErr) return "duplicate"; // unique(comment_id) violation

  return deliverComment(config as BotConfig, ev);
}

export interface BotConfig {
  id:                   string;
  user_id:              string;
  reply_public:         boolean;
  reply_private:        boolean;
  default_public_reply: string | null;
  ai_enabled:           boolean;
  ai_persona:           string | null;
  page_name:            string | null;
  throttle_per_min:     number;
}

// Matches rules (or asks the AI), then sends the replies for an ALREADY-CLAIMED
// comment. Shared by the live webhook path and the deferred-queue drain, so a comment
// held back by the throttle is delivered later instead of being dropped.
export async function deliverComment(config: BotConfig, ev: CommentEvent): Promise<string> {
  // Throttle: over the per-minute budget → park it for the drain job.
  const perMin = config.throttle_per_min || 20;
  if (!(await throttleGate(config.id, perMin))) {
    await supabaseAdmin.from("bot_reply_log")
      .update({ public_status: "deferred", private_status: "deferred", error: "throttled", sent_at: null })
      .eq("comment_id", ev.commentId);
    return "deferred";
  }

  // Match a rule.
  const { data: rules } = await supabaseAdmin
    .from("bot_rules")
    .select("id, keywords, match_type, public_reply, private_reply, attachments, enabled, priority")
    .eq("config_id", config.id);
  const rule = matchRule(ev.message, (rules || []) as BotRule[]);

  // Seed both statuses to 'skipped' and stamp sent_at NOW: this row has consumed a
  // throttle slot, and — critically — it must not stay 'deferred' when a reply type is
  // disabled, or the drain job would re-pick it forever.
  const update: Record<string, unknown> = {
    matched_rule_id: rule?.id ?? null,
    public_status:   "skipped",
    private_status:  "skipped",
    sent_at:         new Date().toISOString(),
    error:           null,
  };

  // No keyword rule matched → let the AI answer (if the page enabled it and a key is
  // configured). The AI text becomes the private reply; the public reply falls back to
  // the page default. Without AI we stay silent rather than guess.
  let aiPrivate: string | null = null;
  if (!rule) {
    if (config.ai_enabled && aiAvailable()) {
      aiPrivate = await generateAiReply(ev.message, config.ai_persona, config.page_name);
    }
    if (!aiPrivate) {
      update.public_status = "skipped";
      update.private_status = "skipped";
      update.error = config.ai_enabled ? "ai_unavailable" : "no_rule_match";
      await supabaseAdmin.from("bot_reply_log").update(update).eq("comment_id", ev.commentId);
      return "no_rule_match";
    }
    update.error = "ai_reply";
  }

  const errors: string[] = [];

  // 1) Public reply.
  if (config.reply_public) {
    const text = rule?.public_reply || config.default_public_reply;
    if (text) {
      const res = await withRotation(config.id, (tok) =>
        replyToComment(ev.commentId, text, tok)
      );
      if (res.ok) { update.public_status = "sent"; update.used_token_id = res.tokenId; }
      else { update.public_status = "failed"; errors.push(`public: ${res.error}`); }
    } else {
      update.public_status = "skipped";
    }
  }

  // 2) Private reply (DM) with attachments. Body comes from the matched rule, or from
  // the AI when no rule matched. Attachments only ever come from a rule.
  const privateBody = rule ? (rule.private_reply || "") : (aiPrivate || "");
  const privateAtts = rule?.attachments || [];

  if (config.reply_private && (privateBody || privateAtts.length)) {
    const res = await withRotation(config.id, (tok) =>
      sendPrivateReply(ev.pageId, ev.commentId, privateBody, tok, privateAtts)
    );
    if (res.ok) { update.private_status = "sent"; update.used_token_id = res.tokenId; }
    else { update.private_status = "failed"; errors.push(`private: ${res.error}`); }
  } else {
    update.private_status = "skipped";
  }

  if (errors.length) update.error = errors.join(" | ");
  await supabaseAdmin.from("bot_reply_log").update(update).eq("comment_id", ev.commentId);
  return errors.length ? "partial" : "ok";
}

// Drains comments parked by the throttle (status 'deferred'), oldest first. Run on a
// schedule (Vercel cron → /api/bot/cron/drain). Each call delivers what the current
// per-minute budget allows; the rest stay queued for the next run — so a 500-comment
// burst is answered steadily instead of in one spam-flagged blast.
export async function drainDeferred(limit = 50): Promise<{ processed: number; sent: number }> {
  const { data: rows } = await supabaseAdmin
    .from("bot_reply_log")
    .select("comment_id, post_id, page_id, commenter_id, commenter_name, comment_message, config_id")
    .eq("public_status", "deferred")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (!rows?.length) return { processed: 0, sent: 0 };

  // Cache configs so we don't refetch per row.
  const configs = new Map<string, BotConfig | null>();
  let sent = 0;

  for (const row of rows) {
    if (!configs.has(row.config_id)) {
      const { data } = await supabaseAdmin
        .from("bot_configs")
        .select("id, user_id, enabled, reply_public, reply_private, default_public_reply, ai_enabled, ai_persona, page_name, throttle_per_min")
        .eq("id", row.config_id)
        .eq("enabled", true)
        .maybeSingle();
      configs.set(row.config_id, (data as BotConfig | null) ?? null);
    }
    const config = configs.get(row.config_id);
    if (!config) continue; // bot turned off since — leave the row parked

    const res = await deliverComment(config, {
      pageId:    row.page_id,
      commentId: row.comment_id,
      postId:    row.post_id ?? "",
      message:   row.comment_message ?? "",
      fromId:    row.commenter_id ?? "",
      fromName:  row.commenter_name ?? "",
    });
    if (res === "deferred") break;      // budget exhausted → stop, retry next run
    if (res === "ok" || res === "partial") sent++;
  }

  return { processed: rows.length, sent };
}
