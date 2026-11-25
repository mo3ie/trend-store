import { parseJsonLossless, TIKTOK_ID_FIELDS, idToString } from "@/lib/losslessJson";

/**
 * Parsing an inbound TikTok direct message.
 *
 * ## Why this parser is written defensively, and is not a guess dressed up as a spec
 *
 * The `comment.update` parser next door is exact, because that event is documented
 * and we have received thousands of them. This one is not in that position:
 * TikTok's Business Messaging docs render client-side and could not be read
 * programmatically, and the approval process was frozen on 2026-11-07, so no real
 * delivery has ever reached us to check a shape against.
 *
 * Two ways to handle that. Hard-code one guessed field layout, and discover it was
 * wrong on the day the scope is finally granted — when the failure looks exactly
 * like "the feature does not work". Or accept the field names TikTok plausibly
 * uses, take the first that is present, and make `recognised` tell the truth about
 * which it found. The second is what this does, and the event is logged either way,
 * so the first real delivery TEACHES us the shape instead of being lost to it.
 *
 * This is the only file in the flow that is uncertain. Everything downstream —
 * the code lookup, the single-open guard, the reply — is exact and already proven
 * in production.
 */

/** Event names TikTok could plausibly use for an inbound message. */
const MESSAGE_EVENTS = new Set([
  "message.update",
  "message.receive",
  "message_received",
  "conversation.message",
  "business_message",
]);

export interface InboundMessageEvent {
  /** Account open_id — maps to tiktok_accounts.tiktok_account_id. */
  userOpenId: string;
  messageId: string;
  conversationId: string | null;
  senderId: string | null;
  text: string;
  createTime: number;
  /** The envelope's event name, recorded verbatim for diagnosis. */
  event: string;
}

interface Envelope {
  event?: string;
  create_time?: number;
  user_openid?: string;
  content?: string | Record<string, unknown>;
}

/** True when the envelope looks like an inbound message rather than a comment. */
export function isMessageEvent(rawBody: string): boolean {
  try {
    const e = parseJsonLossless<Envelope>(rawBody, TIKTOK_ID_FIELDS);
    const name = String(e.event ?? "").toLowerCase();
    return MESSAGE_EVENTS.has(name) || (name.includes("message") && !name.includes("comment"));
  } catch {
    return false;
  }
}

/** First present, non-empty value among several candidate keys. */
function pick(o: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && String(v) !== "") return v;
  }
  return undefined;
}

/**
 * Parses a verified delivery into an inbound message.
 *
 * Ids go through `idToString` for the same reason comments do: TikTok types them as
 * JSON numbers at 19 digits, past Number.MAX_SAFE_INTEGER, and a plain JSON.parse
 * rounds them. Here a rounded id would corrupt the deduplication key — the one thing
 * standing between a redelivery and a customer's single open being spent twice.
 *
 * Returns null when there is no usable message id. That is not caution for its own
 * sake: without a stable id this cannot be made idempotent, and a non-idempotent
 * handler is worse than no handler.
 */
export function parseInboundMessage(rawBody: string): InboundMessageEvent | null {
  let envelope: Envelope;
  try {
    envelope = parseJsonLossless<Envelope>(rawBody, TIKTOK_ID_FIELDS);
  } catch {
    return null;
  }

  // `content` is a JSON-encoded STRING on the comment event. Accept both, because a
  // different product team may well have shipped it as an object.
  let content: Record<string, unknown> = {};
  if (typeof envelope.content === "string") {
    try {
      content = parseJsonLossless<Record<string, unknown>>(envelope.content, TIKTOK_ID_FIELDS);
    } catch {
      return null;
    }
  } else if (envelope.content && typeof envelope.content === "object") {
    content = envelope.content as Record<string, unknown>;
  }

  // Some shapes nest the message one level down.
  const inner = (content.message && typeof content.message === "object")
    ? (content.message as Record<string, unknown>) : content;

  let messageId: string | null;
  let conversationId: string | null;
  let senderId: string | null;
  try {
    messageId = idToString(pick(inner, ["message_id", "msg_id", "id"]));
    conversationId = idToString(pick(inner, ["conversation_id", "thread_id", "chat_id"])
      ?? pick(content, ["conversation_id", "thread_id", "chat_id"]));
    senderId = idToString(pick(inner, ["sender_id", "from_user_id", "participant_id", "user_id"])
      ?? pick(content, ["sender_id", "from_user_id", "participant_id"]));
  } catch {
    // Precision was already lost before we saw it. Refuse rather than deduplicate
    // against an id that is not the real one.
    return null;
  }

  const text = String(
    pick(inner, ["text", "content", "message_text", "body"]) ?? "",
  );

  if (!messageId || !envelope.user_openid) return null;

  return {
    userOpenId: String(envelope.user_openid),
    messageId,
    conversationId,
    senderId,
    text,
    createTime: Number(envelope.create_time ?? 0),
    event: String(envelope.event ?? ""),
  };
}

/**
 * Messages the business itself sent, echoed back.
 *
 * The comment bot once answered its own replies in a 100-deep loop because TikTok
 * delivers events for everything on an owned object, including our own writes. A
 * messaging webhook will do the same, and the consequence here is worse than noise:
 * our own outgoing price contains no code, so each echo would be logged as a
 * customer who wrote nonsense. Anything we can identify as ours is dropped.
 */
export function isEcho(event: InboundMessageEvent): boolean {
  return !!event.senderId && event.senderId === event.userOpenId;
}
