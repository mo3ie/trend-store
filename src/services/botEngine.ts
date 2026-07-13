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
    .select("id, user_id, enabled, reply_public, reply_private, default_public_reply")
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

  // Match a rule.
  const { data: rules } = await supabaseAdmin
    .from("bot_rules")
    .select("id, keywords, match_type, public_reply, private_reply, attachments, enabled, priority")
    .eq("config_id", config.id);
  const rule = matchRule(ev.message, (rules || []) as BotRule[]);

  const update: Record<string, unknown> = { matched_rule_id: rule?.id ?? null };

  if (!rule) {
    update.public_status = "skipped";
    update.private_status = "skipped";
    update.error = "no_rule_match";
    await supabaseAdmin.from("bot_reply_log").update(update).eq("comment_id", ev.commentId);
    return "no_rule_match";
  }

  const errors: string[] = [];

  // 1) Public reply.
  if (config.reply_public) {
    const text = rule.public_reply || config.default_public_reply;
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

  // 2) Private reply (DM) with attachments.
  if (config.reply_private && (rule.private_reply || rule.attachments?.length)) {
    const res = await withRotation(config.id, (tok) =>
      sendPrivateReply(ev.pageId, ev.commentId, rule.private_reply || "", tok, rule.attachments || [])
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
