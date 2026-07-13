// TikTok comment auto-reply engine.
//
// Mirrors botEngine (same rule matching, same idempotency, same throttle philosophy)
// but PULLS instead of being pushed: TikTok has no comment webhook, so a cron job
// polls each connected account's recent videos for new comments.
//
// TikTok also has no organic DM API, so there is no private reply — the bot answers
// publicly, and the reply text carries the price/details.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { matchRule, type BotRule } from "@/services/botEngine";
import { generateAiReply, aiAvailable } from "@/services/botAi";
import {
  getTikTokVideos, getTikTokComments, replyToTikTokComment, refreshTikTokToken,
} from "@/services/tiktok";

interface TikTokConfig {
  id:               string;
  user_id:          string;
  page_id:          string;   // TikTok business_id
  page_name:        string | null;
  ai_enabled:       boolean;
  ai_persona:       string | null;
  reply_public:     boolean;
  throttle_per_min: number;
}

// Returns a valid access token for the account, refreshing it if it's near expiry.
async function tokenFor(config: TikTokConfig): Promise<string | null> {
  const { data: tok } = await supabaseAdmin
    .from("bot_page_tokens")
    .select("id, access_token, refresh_token, expires_at")
    .eq("config_id", config.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!tok) return null;

  const nearExpiry =
    tok.expires_at && new Date(tok.expires_at).getTime() - Date.now() < 5 * 60_000;
  if (!nearExpiry || !tok.refresh_token) return tok.access_token;

  try {
    const fresh = await refreshTikTokToken(tok.refresh_token);
    await supabaseAdmin.from("bot_page_tokens").update({
      access_token:  fresh.accessToken,
      refresh_token: fresh.refreshToken,
      expires_at:    new Date(Date.now() + fresh.expiresIn * 1000).toISOString(),
    }).eq("id", tok.id);
    return fresh.accessToken;
  } catch {
    return tok.access_token; // try the old one; a hard failure surfaces in the log
  }
}

// Polls one account: recent videos → their comments → reply to any we haven't seen.
// Idempotency is the UNIQUE(comment_id) claim in bot_reply_log, exactly as on Meta.
async function pollAccount(config: TikTokConfig): Promise<number> {
  const token = await tokenFor(config);
  if (!token) return 0;

  const { data: rules } = await supabaseAdmin
    .from("bot_rules")
    .select("id, keywords, match_type, public_reply, private_reply, attachments, enabled, priority")
    .eq("config_id", config.id);

  let sent = 0;
  const budget = config.throttle_per_min || 20;

  const videos = await getTikTokVideos(token, config.page_id, 10);
  for (const video of videos) {
    if (sent >= budget) break;

    const comments = await getTikTokComments(token, config.page_id, video.id, 30);
    for (const c of comments) {
      if (sent >= budget) break;
      if (c.replied) continue; // the account already answered this one

      // Claim it — a duplicate insert means we handled it on an earlier poll.
      const { error: claimErr } = await supabaseAdmin.from("bot_reply_log").insert({
        config_id:       config.id,
        page_id:         config.page_id,
        comment_id:      c.id,
        post_id:         video.id,
        commenter_name:  c.username,
        comment_message: c.text,
      });
      if (claimErr) continue;

      // Decide the reply: keyword rule first, AI as the fallback.
      const rule = matchRule(c.text, (rules || []) as BotRule[]);
      let text = rule?.public_reply || rule?.private_reply || null;
      if (!text && config.ai_enabled && aiAvailable()) {
        text = await generateAiReply(c.text, config.ai_persona, config.page_name);
      }

      const update: Record<string, unknown> = {
        matched_rule_id: rule?.id ?? null,
        private_status:  "skipped",   // TikTok has no organic DM API
        sent_at:         new Date().toISOString(),
      };

      if (!text || !config.reply_public) {
        update.public_status = "skipped";
        update.error = text ? null : "no_rule_match";
        await supabaseAdmin.from("bot_reply_log").update(update).eq("comment_id", c.id);
        continue;
      }

      try {
        await replyToTikTokComment(token, config.page_id, video.id, c.id, text);
        update.public_status = "sent";
        sent++;
        // Human-like pacing between replies — same anti-block reasoning as Meta.
        await new Promise((r) => setTimeout(r, 500 + Math.random() * 1200));
      } catch (err: unknown) {
        update.public_status = "failed";
        update.error = err instanceof Error ? err.message : "TikTok error";
      }
      await supabaseAdmin.from("bot_reply_log").update(update).eq("comment_id", c.id);
    }
  }
  return sent;
}

// Polls every enabled TikTok account with an active subscription. Run on a cron.
export async function pollAllTikTok(): Promise<{ accounts: number; replies: number }> {
  const { data: configs } = await supabaseAdmin
    .from("bot_configs")
    .select("id, user_id, page_id, page_name, ai_enabled, ai_persona, reply_public, throttle_per_min")
    .eq("platform", "tiktok")
    .eq("enabled", true);
  if (!configs?.length) return { accounts: 0, replies: 0 };

  let replies = 0, accounts = 0;
  for (const config of configs as TikTokConfig[]) {
    // Subscription gate, same as Meta.
    const { data: sub } = await supabaseAdmin
      .from("bot_subscriptions")
      .select("status, expires_at")
      .eq("user_id", config.user_id)
      .eq("page_id", config.page_id)
      .eq("platform", "tiktok")
      .maybeSingle();
    const active = sub && sub.status === "active" &&
      (!sub.expires_at || new Date(sub.expires_at).getTime() > Date.now());
    if (!active) continue;

    accounts++;
    try {
      replies += await pollAccount(config);
    } catch {
      // One bad account must not stop the others.
    }
  }
  return { accounts, replies };
}
