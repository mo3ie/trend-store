import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * The anti-block pacing both bots share.
 *
 * When a post goes viral, hundreds of comments land at once, and answering them all
 * instantly is precisely what trips a platform's spam detection and gets the account
 * blocked. Two defences: a per-minute cap counted from `bot_reply_log` (durable across
 * serverless instances), and a small human-like wait before each reply.
 *
 * This lived inside the Facebook engine, where TikTok could not reach it — so the
 * TikTok bot capped its replies per sweep but never paced them, which is the weaker
 * half of the protection on the platform whose rate limits are the stricter of the
 * two. Extracted here so one change to the pacing changes it for both.
 */

/** The defaults, used when a config leaves the columns null. */
export const DEFAULT_PER_MIN = 20;
export const DEFAULT_MIN_DELAY_SEC = 2;
export const DEFAULT_MAX_DELAY_SEC = 6;

/**
 * True when this reply may proceed; false when the per-minute budget is spent and the
 * comment should be deferred to the drain job rather than dropped.
 *
 * On success it has already waited the human-like interval, so the caller may send
 * immediately afterwards.
 */
export async function throttleGate(
  configId: string,
  perMin: number,
  minDelaySec: number,
  maxDelaySec: number,
): Promise<boolean> {
  const since = new Date(Date.now() - 60_000).toISOString();
  // Counted by sent_at (when we actually called the platform), NOT created_at (when
  // the comment arrived) — otherwise drained rows carry an old created_at, never count
  // toward the current minute, and the drain blows straight through the cap.
  const { count } = await supabaseAdmin
    .from("bot_reply_log")
    .select("id", { count: "exact", head: true })
    .eq("config_id", configId)
    .gte("sent_at", since);

  if ((count ?? 0) >= perMin) return false;

  await humanPause(minDelaySec, maxDelaySec);
  return true;
}

/** The human-like wait on its own, for callers that count their own budget. */
export async function humanPause(minDelaySec: number, maxDelaySec: number): Promise<void> {
  const lo = Math.max(0, Math.min(minDelaySec, maxDelaySec));
  const hi = Math.max(lo, maxDelaySec);
  const waitMs = (lo + Math.random() * (hi - lo)) * 1000;
  if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
}

/**
 * Whether the bot should answer a comment on this post/video.
 *
 * An owner who restricted the bot to specific items expects silence everywhere else.
 * The id is matched both whole and by its numeric suffix, because the webhook and the
 * stored ids can differ in shape ("{pageId}_{postId}" versus the bare id).
 *
 * An item with its own custom reply is always answered, even in "selected only" mode:
 * writing a reply for a post is a clearer statement of intent than a filter list the
 * owner may have forgotten to update.
 */
export function isItemTargeted(
  itemId: string,
  filterEnabled: boolean,
  filter: string[] | null | undefined,
  hasOwnReply: boolean,
): boolean {
  if (!filterEnabled || !(filter?.length)) return true;
  if (hasOwnReply) return true;
  const suffix = (s: string) => (s.includes("_") ? s.split("_")[1] : s);
  const want = suffix(itemId || "");
  return filter.some((f) => f === itemId || suffix(f) === want);
}

/**
 * How many replies this config has sent in the last minute.
 *
 * Exposed separately from `throttleGate` because the two bots reach their budget from
 * opposite directions. The Facebook bot is pushed comments by a webhook, so when it is
 * over budget it must park the comment and drain it later. The TikTok bot pulls on a
 * sweep, so it can simply stop early and let the next sweep find the comment — but
 * only if it checks BEFORE claiming it, since a claimed comment is never re-offered.
 */
export async function repliesInLastMinute(configId: string): Promise<number> {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabaseAdmin
    .from("bot_reply_log")
    .select("id", { count: "exact", head: true })
    .eq("config_id", configId)
    .gte("sent_at", since);
  return count ?? 0;
}
