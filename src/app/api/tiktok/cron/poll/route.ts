import { NextRequest, NextResponse } from "next/server";
import { pollAllTikTok } from "@/services/tiktokEngine";
import { drainQueuedTikTokEvents } from "@/services/tiktokEvents";

/**
 * DURABLE DRAIN + RECONCILIATION BACKSTOP — not the primary path.
 *
 * The primary trigger is the `comment.update` webhook (/api/tiktok/webhook/). This sweep
 * exists because delivery is at-least-once, fires "within five minutes", and TikTok's retry
 * behaviour is undocumented — so a missed delivery needs a second chance.
 *
 * Schedule it every 15-30 MINUTES, not every 1-2 minutes: TikTok's app-wide QPM ceiling is
 * shared by every customer we onboard. Both paths claim comments through the same
 * UNIQUE(comment_id) constraint, so an overlap can never double-reply.
 *
 * Protected by CRON_SECRET (fail-closed).
 */
export async function GET(req: NextRequest) {
  // FAIL CLOSED: a missing CRON_SECRET must never leave this endpoint open (audit #5).
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) {
    return new NextResponse("Cron secret not configured", { status: 503 });
  }
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // 1) Finish webhook events that were durably queued but not completed inline (the
  //    invocation was killed, the reply failed, or the bot was briefly off). This is the
  //    reliability guarantee behind the webhook's fast 200.
  const drained = await drainQueuedTikTokEvents();

  // 2) Then reconcile: catch comments whose webhook delivery never arrived at all.
  const reconciled = await pollAllTikTok();

  return NextResponse.json({ ok: true, drained, reconciled });
}
