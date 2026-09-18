import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { tiktokClientSecret } from "@/services/tiktok";
import {
  verifyWebhookSignature, parseCommentUpdate, isReplyableEvent, SIGNATURE_HEADER,
} from "@/services/tiktokWebhook";
import { ackFor, ackRejected, type AckDecision } from "@/lib/tiktokAck";
import { enqueueCommentEvent, processQueuedComment } from "@/services/tiktokEvents";

/**
 * POST /api/tiktok/webhook/ — the app-level TikTok callback for `comment.update`.
 *
 * Registered once for the whole developer app via /business/webhook/update/ with
 * event_type = COMMENT; it serves every connected customer account. The trailing slash is
 * part of the registered URL and is served directly (see next.config.ts).
 *
 * ORDER IS THE SECURITY PROPERTY:
 *   1. read the RAW body — never JSON.parse first, because re-serializing changes bytes and
 *      the signature covers `timestamp + "." + raw body`;
 *   2. verify the HMAC-SHA256 signature in constant time, then timestamp freshness;
 *   3. parse LOSSLESSLY (19-digit ids would be destroyed by a plain JSON.parse), then parse
 *      the nested `content` JSON string;
 *   4. DURABLY record the event (the same bot_reply_log claim the poll competes for);
 *   5. only then acknowledge.
 *
 * ACKNOWLEDGEMENT IS NOT A BACKGROUND-WORK PROMISE. On Vercel, work after the response may
 * be killed, so 200 is returned only once the event is stored and the cron drain can finish
 * it. The inline processing below is a latency optimisation, never the reliability mechanism:
 * if this invocation dies mid-reply, the row is still `queued`/`processing` and gets drained.
 *
 * Nothing here logs the raw body, the signature, or any token.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function respond(decision: AckDecision): NextResponse {
  if (decision.status === 200) {
    return NextResponse.json({ ok: true, note: decision.note }, { status: 200 });
  }
  // Non-2xx: TikTok should deliver this event again.
  return NextResponse.json({ ok: false, note: decision.note }, { status: decision.status });
}

export async function POST(req: NextRequest) {
  const secret = tiktokClientSecret();
  if (!secret) {
    // Fail closed: without the app secret no signature can be trusted.
    return new NextResponse("Not configured", { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get(SIGNATURE_HEADER);

  const verified = verifyWebhookSignature(rawBody, signature, secret);
  if (!verified.ok) {
    console.error(`tiktok_webhook_rejected reason=${verified.reason}`);
    return respond(ackRejected());
  }

  const event = parseCommentUpdate(rawBody);
  if (!event) return respond(ackFor("ignored_event"));

  // Liveness for the UI ("instant replies active"). Best-effort; never blocks the ack.
  void supabaseAdmin
    .from("tiktok_webhook_config")
    .update({ last_event_at: new Date().toISOString(), last_error: null })
    .eq("id", 1)
    .then(() => undefined, () => undefined);

  if (!isReplyableEvent(event)) {
    // delete / set_to_hidden / set_to_friends_only / set_to_public are moderation signals;
    // the bot only acts on newly created comments.
    return respond(ackFor("ignored_action", event.action));
  }

  // Durable intake. A duplicate delivery loses the UNIQUE(comment_id) race here and is
  // acknowledged without producing a second job or a second reply.
  const result = await enqueueCommentEvent(event);

  if (result.outcome === "storage_unavailable") {
    // A VALID event we could not store — ask for a retry instead of dropping it.
    return respond(ackFor("storage_unavailable"));
  }

  if (result.outcome === "queued" && result.target) {
    // Fast path: try to answer now so the customer sees a reply in seconds rather than at
    // the next drain. Detached on purpose — the durable row is what guarantees delivery.
    void processQueuedComment(result.target, {
      comment_id: event.commentId,
      post_id: event.videoId,
      comment_message: event.text,
    }).catch(() => {
      // Left `queued`/`processing` for the drain; no secret material in this log line.
      console.error("tiktok_webhook_inline_processing_failed");
    });
  }

  return respond(ackFor(result.outcome));
}

/** TikTok only POSTs here; anything else is a misconfiguration worth surfacing plainly. */
export async function GET() {
  return new NextResponse("Method Not Allowed", { status: 405 });
}
