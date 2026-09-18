import { createHmac, timingSafeEqual } from "node:crypto";
import { parseJsonLossless, idToString, TIKTOK_ID_FIELDS } from "@/lib/losslessJson";

/**
 * TikTok webhook signature verification and payload parsing.
 *
 * Verified against the official "Webhook verification" and "Comment update event" pages
 * (docs/TIKTOK_PHASE2.1_API_SPEC.md §10).
 *
 * The signature covers `timestamp + "." + RAW REQUEST BODY`. Re-serializing the parsed JSON
 * would change byte-for-byte content (key order, spacing, unicode escaping) and break
 * verification — so the raw body string is what gets verified, and JSON.parse happens only
 * afterwards.
 */

export const SIGNATURE_HEADER = "tiktok-signature";
/** Max age of a delivery we will accept, to bound replay. */
export const DEFAULT_TOLERANCE_SEC = 300;

export type VerifyFailure =
  | "missing_signature"
  | "malformed_signature"
  | "no_secret"
  | "bad_signature"
  | "stale_timestamp";

export type VerifyResult =
  | { ok: true; timestamp: number }
  | { ok: false; reason: VerifyFailure };

/** Parses `t=1633174587,s=1849...` into its parts, order-independently. */
export function parseSignatureHeader(header: string | null): { t: number; s: string } | null {
  if (!header) return null;
  let t: number | null = null;
  let s: string | null = null;
  for (const part of header.split(",")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === "t") t = Number(value);
    else if (key === "s") s = value;
  }
  if (t === null || !Number.isFinite(t) || !s) return null;
  return { t, s };
}

function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/**
 * Verifies a webhook delivery.
 *
 * @param rawBody the EXACT bytes received — never a re-serialized object
 * @param signatureHeader value of the `Tiktok-Signature` header
 * @param secret the developer app secret (server-only)
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  opts: { toleranceSec?: number; nowSec?: number } = {},
): VerifyResult {
  if (!secret) return { ok: false, reason: "no_secret" };
  if (!signatureHeader) return { ok: false, reason: "missing_signature" };

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return { ok: false, reason: "malformed_signature" };

  const expected = createHmac("sha256", secret).update(`${parsed.t}.${rawBody}`).digest("hex");
  if (!constantTimeEqualHex(expected, parsed.s)) return { ok: false, reason: "bad_signature" };

  // Signature first, freshness second: a stale but validly signed delivery is a replay,
  // while an unsigned one is not ours at all.
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
  const tolerance = opts.toleranceSec ?? DEFAULT_TOLERANCE_SEC;
  if (Math.abs(now - parsed.t) > tolerance) return { ok: false, reason: "stale_timestamp" };

  return { ok: true, timestamp: parsed.t };
}

// ── Payload ───────────────────────────────────────────────────────────────────

export interface WebhookEnvelope {
  client_key?: string;
  event?: string;
  create_time?: number;
  user_openid?: string;
  /** A JSON-ENCODED STRING, not an object — it must be parsed a second time. */
  content?: string;
}

export type CommentAction =
  | "insert" | "delete" | "set_to_hidden" | "set_to_friends_only" | "set_to_public";

export interface CommentUpdateEvent {
  /** Account open_id — maps to tiktok_accounts.open_id. */
  userOpenId: string;
  commentId: string;
  videoId: string;
  parentCommentId: string | null;
  commentType: "comment" | "reply" | string;
  action: CommentAction | string;
  /** Unix seconds when the action happened. */
  timestamp: number;
  uniqueIdentifier: string | null;
  text: string;
  createTime: number;
}

export const COMMENT_UPDATE_EVENT = "comment.update";

/**
 * Parses a verified delivery into a comment update event.
 *
 * ⚠️ IDS MUST NOT PASS THROUGH A PLAIN JSON.parse. TikTok types comment_id/video_id as JSON
 * NUMBERS and they are 19 digits, beyond Number.MAX_SAFE_INTEGER, so a naive parse silently
 * rounds them (6990565363377392901 -> 6990565363377393000) — corrupting both the reply
 * target and the deduplication key. parseJsonLossless captures the exact source text.
 *
 * Returns null for another event type or an unusable payload: the caller acknowledges those,
 * because a 4xx/5xx would make TikTok retry a delivery we can never use.
 */
export function parseCommentUpdate(rawBody: string): CommentUpdateEvent | null {
  let envelope: WebhookEnvelope;
  try {
    // One parsing path for everything TikTok sends, so a future large id cannot slip through.
    envelope = parseJsonLossless<WebhookEnvelope>(rawBody, TIKTOK_ID_FIELDS);
  } catch {
    return null;
  }
  if (envelope.event !== COMMENT_UPDATE_EVENT) return null;
  if (!envelope.content || typeof envelope.content !== "string") return null;

  // `content` is a JSON-ENCODED STRING and must be parsed a second time — this is where the
  // large ids actually live.
  let content: Record<string, unknown>;
  try {
    content = parseJsonLossless<Record<string, unknown>>(envelope.content, TIKTOK_ID_FIELDS);
  } catch {
    return null;
  }

  let commentId: string | null;
  let videoId: string | null;
  let parentCommentId: string | null;
  try {
    commentId = idToString(content.comment_id);
    videoId = idToString(content.video_id);
    parentCommentId = idToString(content.parent_comment_id);
  } catch {
    // idToString throws when an id arrived as an unsafe number, i.e. precision was already
    // lost. Refuse the event rather than reply to the wrong comment.
    return null;
  }
  if (!commentId || !videoId || !envelope.user_openid) return null;

  return {
    userOpenId: String(envelope.user_openid),
    commentId,
    videoId,
    parentCommentId,
    commentType: String(content.comment_type ?? ""),
    action: String(content.comment_action ?? ""),
    timestamp: Number(content.timestamp ?? 0),
    uniqueIdentifier: (content.unique_identifier as string | undefined) ?? null,
    text: String(content.text ?? ""),
    createTime: Number(envelope.create_time ?? 0),
  };
}

/** Only newly created comments/replies drive the bot. The rest are moderation signals. */
export function isReplyableEvent(event: CommentUpdateEvent): boolean {
  return event.action === "insert";
}
