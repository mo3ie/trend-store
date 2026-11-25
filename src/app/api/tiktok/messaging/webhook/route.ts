import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { tiktokClientSecret, businessIdFromOpenId } from "@/services/tiktok";
import { getValidAccessToken } from "@/lib/tiktokTokens";
import { verifyWebhookSignature, SIGNATURE_HEADER } from "@/services/tiktokWebhook";
import { parseInboundMessage, isMessageEvent, isEcho } from "@/services/tiktokMessageWebhook";
import { canMessage, sendMessage } from "@/services/tiktokMessaging";
import { handleInboundDm, dmAutoReplyArmed, type DmSender } from "@/services/dmCodeReply";

/**
 * POST /api/tiktok/messaging/webhook/ — a customer sent us their code.
 *
 * The last missing step of «من التعليق إلى الرسالة»:
 *
 *     comment → public code → customer DMs the code → THIS → the price, privately
 *
 * ## Why this is a separate URL and not a branch in the comment webhook
 *
 * The comment webhook is load-bearing and live: every reply every merchant sends
 * goes through it. This handler answers an event we have never actually received,
 * because TikTok froze Business Messaging approval on 2026-11-07. Putting unproven
 * parsing in front of the working bot would risk the thing that works to serve the
 * thing that cannot run yet. TikTok registers webhooks per event type, so the two
 * can be separate URLs — and this one is simply not registered until the scope
 * exists.
 *
 * ## It is inert, twice over
 *
 *   env  DM_CODE_AUTOREPLY=on          — the deployment-wide switch
 *   bot_configs.dm_code_autoreply      — the per-merchant switch
 *
 * With either off, the event is still verified, parsed, resolved against the code
 * table and LOGGED with the exact reply that would have been sent. So the path can
 * be proven end to end today, on real data, without a single message leaving.
 *
 * Security order is the comment webhook's, unchanged, because it is correct:
 * raw body → HMAC verify → freshness → lossless parse → durable claim → act.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = tiktokClientSecret();
  if (!secret) return new NextResponse("Not configured", { status: 503 });

  const rawBody = await req.text();
  const verified = verifyWebhookSignature(rawBody, req.headers.get(SIGNATURE_HEADER), secret);
  if (!verified.ok) {
    console.error(`tiktok_dm_webhook_rejected reason=${verified.reason}`);
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (!isMessageEvent(rawBody)) {
    // Another event type reached this URL. Acknowledge: a non-2xx would make TikTok
    // redeliver something we will never act on.
    return NextResponse.json({ ok: true, note: "ignored_event" });
  }

  const event = parseInboundMessage(rawBody);
  if (!event) return NextResponse.json({ ok: true, note: "unparsable" });
  if (isEcho(event)) return NextResponse.json({ ok: true, note: "echo" });

  // Acknowledge fast, work in after(). `after`, never a detached promise: on
  // serverless the instance is frozen the moment the response returns, and that
  // exact mistake is why the comment bot once queued replies it never sent.
  after(async () => {
    try {
      await processInboundMessage(event);
    } catch {
      console.error("tiktok_dm_webhook_processing_failed");
    }
  });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return new NextResponse("Method Not Allowed", { status: 405 });
}

/**
 * Resolves the receiving merchant, then runs the shared core.
 *
 * Exported so the simulator drives the identical path. A simulator that
 * approximates the handler is worse than none — the owner tunes against it and
 * then watches production disagree.
 */
export async function processInboundMessage(event: {
  userOpenId: string; messageId: string; conversationId: string | null;
  senderId: string | null; text: string;
}) {
  const { data: account } = await supabaseAdmin
    .from("tiktok_accounts")
    .select("id, user_id, tiktok_account_id, granted_scopes")
    .eq("tiktok_account_id", event.userOpenId)
    .is("revoked_at", null)
    .maybeSingle();

  const { data: config } = await supabaseAdmin
    .from("bot_configs")
    .select("id, user_id, dm_code_autoreply, dm_code_miss_text")
    .eq("platform", "tiktok")
    .eq("page_id", event.userOpenId)
    .maybeSingle();

  // The sender is built ONLY when every precondition holds. A null sender records
  // `unavailable` instead of throwing, which keeps the diagnosis in the log rather
  // than in a stack trace: "the scope is missing" and "the token expired" are
  // different problems that otherwise read identically.
  let send: DmSender | null = null;
  if (account && canMessage(account.granted_scopes as string[] | null)) {
    const token = await getValidAccessToken(account.id);
    if (token) {
      const businessId = businessIdFromOpenId(account.tiktok_account_id);
      send = async ({ conversationId, text }) => {
        if (!conversationId) throw new Error("no_conversation");
        await sendMessage(token, businessId, conversationId, text);
      };
    }
  }

  return handleInboundDm(
    {
      platform: "tiktok",
      messageId: event.messageId,
      conversationId: event.conversationId,
      senderId: event.senderId,
      pageId: event.userOpenId,
      text: event.text,
    },
    send,
    {
      configId: config?.id ?? null,
      userId: config?.user_id ?? account?.user_id ?? null,
      missText: config?.dm_code_miss_text ?? null,
      // Both switches, read at the moment of use rather than cached: a merchant
      // turning this off must take effect on the next message, not the next deploy.
      enabled: dmAutoReplyArmed() && config?.dm_code_autoreply === true,
    },
  );
}
