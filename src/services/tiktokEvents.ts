import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { EnqueueOutcome } from "@/lib/tiktokAck";
import type { CommentUpdateEvent } from "@/services/tiktokWebhook";
import { loadTarget, processClaimedComment, type TikTokTarget } from "@/services/tiktokEngine";

/**
 * Durable intake for TikTok webhook deliveries.
 *
 * WHY NOT A NEW QUEUE SYSTEM
 * This project already has a durable, Supabase-backed job mechanism: the Meta bot parks work
 * in `bot_reply_log` (`public_status = 'deferred'`) and a cron drains it. TikTok reuses that
 * exact pattern with its own status value, so there is no Redis/SQS/Kafka, no second
 * database, and — critically — no second deduplication system.
 *
 * ONE DEDUPLICATION AUTHORITY
 * The durable record IS the deduplication claim: the row inserted here is the same
 * `bot_reply_log` row whose UNIQUE(comment_id) constraint the reconciliation poll competes
 * for. Whichever path inserts first owns the comment; the loser gets a unique violation and
 * stops. A duplicate webhook delivery therefore cannot produce a second job OR a second
 * reply, and the webhook and the poll can never disagree, because they are contending for
 * the same row.
 *
 * Status lifecycle for TikTok rows:
 *   queued -> processing -> sent | skipped | failed
 * Meta's drain selects only `public_status = 'deferred'`, so it never sees these rows.
 *
 * No access token, refresh token or secret is ever written into a queue row.
 */

/** Postgres unique-violation. A duplicate delivery lands here, which is a success, not an error. */
const UNIQUE_VIOLATION = "23505";

export interface EnqueueResult {
  outcome: EnqueueOutcome;
  target?: TikTokTarget;
}

/**
 * Durably records a verified comment.update event.
 *
 * Returns "storage_unavailable" when the write fails for any reason other than a duplicate —
 * the caller must then answer with a retryable status rather than acknowledge the event.
 */
export async function enqueueCommentEvent(event: CommentUpdateEvent): Promise<EnqueueResult> {
  let target: TikTokTarget | null;
  try {
    target = await loadTarget(event.userOpenId);
  } catch {
    // The lookup itself failed — the event may well be ours, so ask for a retry.
    return { outcome: "storage_unavailable" };
  }

  // Not an account we manage, or the bot is off / unsubscribed / public replies disabled.
  if (!target) return { outcome: "unknown_account" };
  if (!target.replyPublic) return { outcome: "not_actionable", target };

  const { error } = await supabaseAdmin.from("bot_reply_log").insert({
    config_id: target.configId,
    page_id: target.openId,          // == open_id == business_id
    comment_id: event.commentId,     // exact 19-digit text, never a rounded number
    post_id: event.videoId,
    commenter_name: event.uniqueIdentifier ?? null,
    comment_message: event.text,
    public_status: "queued",
    private_status: "skipped",       // organic TikTok has no DM path
    event_action: event.action,
    event_type: event.commentType,
    received_at: new Date().toISOString(),
    attempts: 0,
  });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { outcome: "duplicate", target };
    // Anything else (table missing, DB unavailable, constraint problem) is infrastructure:
    // never acknowledge a valid event we failed to store.
    console.error(`tiktok_enqueue_failed code=${error.code ?? "unknown"}`);
    return { outcome: "storage_unavailable" };
  }

  return { outcome: "queued", target };
}

/**
 * Processes one already-claimed queued row.
 * Used by the inline fast path and by the cron drain — same code, so a reply cannot differ
 * depending on which path delivered it.
 */
export async function processQueuedComment(
  target: TikTokTarget,
  row: { comment_id: string; post_id: string | null; comment_message: string | null },
): Promise<void> {
  await processClaimedComment(target, {
    commentId: row.comment_id,
    videoId: row.post_id ?? "",
    text: row.comment_message ?? "",
  });
}

/**
 * Drains queued TikTok events. Run from the cron — this is the reliability guarantee behind
 * the webhook's fast path, and what makes it safe for a serverless invocation to be killed
 * immediately after responding 200.
 */
export async function drainQueuedTikTokEvents(limit = 50): Promise<{ processed: number; failed: number }> {
  const { data: rows, error } = await supabaseAdmin
    .from("bot_reply_log")
    .select("comment_id, post_id, page_id, comment_message, config_id, attempts")
    .eq("public_status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !rows?.length) return { processed: 0, failed: 0 };

  let processed = 0, failed = 0;
  const targets = new Map<string, TikTokTarget | null>();

  for (const row of rows) {
    const pageId = row.page_id as string;

    // Atomically take ownership: the filter on public_status='queued' means a concurrent
    // drain (or the inline fast path) cannot process the same row twice.
    const { data: claimed } = await supabaseAdmin
      .from("bot_reply_log")
      .update({ public_status: "processing", attempts: (row.attempts ?? 0) + 1 })
      .eq("comment_id", row.comment_id)
      .eq("public_status", "queued")
      .select("comment_id");
    if (!claimed || claimed.length === 0) continue;

    if (!targets.has(pageId)) targets.set(pageId, await loadTarget(pageId));
    const target = targets.get(pageId) ?? null;

    if (!target) {
      // Disconnected or unsubscribed since the event arrived — close the row out instead of
      // leaving it to be retried forever.
      await supabaseAdmin.from("bot_reply_log")
        .update({ public_status: "skipped", error: "no_active_target", processed_at: new Date().toISOString() })
        .eq("comment_id", row.comment_id);
      continue;
    }

    try {
      await processQueuedComment(target, {
        comment_id: row.comment_id as string,
        post_id: row.post_id as string | null,
        comment_message: row.comment_message as string | null,
      });
      processed++;
    } catch {
      failed++;
      await supabaseAdmin.from("bot_reply_log")
        .update({ public_status: "failed", error: "processing_error", processed_at: new Date().toISOString() })
        .eq("comment_id", row.comment_id);
    }
  }

  return { processed, failed };
}
