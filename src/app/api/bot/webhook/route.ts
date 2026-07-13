import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/services/meta";
import { processComment, type CommentEvent } from "@/services/botEngine";

// GET — Meta webhook verification handshake.
// Meta calls this once with hub.mode=subscribe & hub.challenge; echo the challenge
// back when the verify token matches.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (mode === "subscribe" && token && expected && token === expected) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// POST — real-time page feed events (new comments). We verify the signature, ACK
// immediately, and process each comment (idempotent, token-rotating).
export async function POST(req: NextRequest) {
  const raw = await req.text();

  // Reject forged payloads — only trust bodies signed with our app secret.
  const sig = req.headers.get("x-hub-signature-256");
  if (!verifyWebhookSignature(raw, sig)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let body: { object?: string; entry?: Array<{ id: string; changes?: Array<{ field: string; value: Record<string, unknown> }> }> };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true }); // ACK malformed bodies so Meta stops retrying
  }

  if (body.object !== "page") return NextResponse.json({ ok: true });

  const events: CommentEvent[] = [];
  for (const entry of body.entry || []) {
    const pageId = entry.id;
    for (const change of entry.changes || []) {
      if (change.field !== "feed") continue;
      const v = change.value || {};
      // Only brand-new comments (not edits/removes, not likes/posts).
      if (v.item !== "comment" || v.verb !== "add") continue;
      const from = (v.from ?? {}) as { id?: string; name?: string };
      events.push({
        pageId,
        commentId: String(v.comment_id ?? ""),
        postId:    String(v.post_id ?? ""),
        message:   String(v.message ?? ""),
        fromId:    String(from.id ?? ""),
        fromName:  String(from.name ?? ""),
      });
    }
  }

  // Process inline (serverless has no reliable post-response execution). Failures are
  // logged per-comment inside processComment; we always ACK so Meta doesn't retry-storm.
  await Promise.allSettled(
    events.filter((e) => e.commentId).map((e) => processComment(e))
  );

  return NextResponse.json({ ok: true });
}
