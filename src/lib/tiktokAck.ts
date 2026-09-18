/**
 * Webhook acknowledgement policy.
 *
 * Separating the decision from the route makes it directly testable, and keeps one rule in
 * one place: a valid event is acknowledged ONLY once it is durably recorded.
 *
 * TikTok retries non-2xx deliveries, so the mapping is deliberate:
 *   * 200 — the event is durably stored, already stored (duplicate), or is not ours to act
 *     on. Retrying would change nothing.
 *   * 401 — the delivery could not be cryptographically verified. Not ours.
 *   * 503 — we could not durably store a VALID event. Retry is exactly what we want; we
 *     must never answer 200 and drop it.
 *
 * This file intentionally has NO imports, so tests can load it directly.
 */

export type EnqueueOutcome =
  /** Newly recorded in the durable queue. */
  | "queued"
  /** Already recorded — a duplicate delivery, or the poll got there first. */
  | "duplicate"
  /** The event is for an open_id we do not manage (disconnected, or another app's account). */
  | "unknown_account"
  /** The bot is off, unsubscribed, or public replies are disabled for this account. */
  | "not_actionable"
  /** Not a comment.update event. */
  | "ignored_event"
  /** A comment.update, but not a newly created comment (delete/hide/visibility changes). */
  | "ignored_action"
  /** The payload was signed but structurally unusable — retrying cannot help. */
  | "unparseable"
  /** The durable store rejected the write. The event is VALID and must be retried. */
  | "storage_unavailable";

export interface AckDecision {
  status: number;
  note: string;
  /** True when we are asking TikTok to deliver this event again. */
  retry: boolean;
}

export function ackFor(outcome: EnqueueOutcome, detail?: string): AckDecision {
  const note = detail ? `${outcome}:${detail}` : outcome;
  if (outcome === "storage_unavailable") {
    return { status: 503, note, retry: true };
  }
  return { status: 200, note, retry: false };
}

/** Invalid signature / timestamp — never acknowledged as success. */
export function ackRejected(): AckDecision {
  return { status: 401, note: "invalid_signature", retry: false };
}
