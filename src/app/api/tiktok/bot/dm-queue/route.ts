import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";

export const dynamic = "force-dynamic";

/** One screenful. The point is to clear the queue, not to browse it. */
const PAGE = 50;

/**
 * «طابور الرسائل» — the assisted private reply.
 *
 * The staff member sends from the real TikTok app, so this endpoint never talks
 * to TikTok at all. It hands over three things they would otherwise go and find
 * themselves -- who asked, what they asked, and the exact message to send -- and
 * then records that it went.
 *
 * Every query is scoped to the caller's own user_id, so a guessed configId
 * returns an empty list rather than another merchant's customers.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const configId = req.nextUrl.searchParams.get("configId");
  const status = req.nextUrl.searchParams.get("status") || "pending";

  let q = supabaseAdmin
    .from("dm_tasks")
    .select("id, commenter, comment_text, body, status, created_at, sent_at, video_id")
    .eq("user_id", user.id)
    .eq("platform", "tiktok")
    .eq("status", status)
    // Oldest first for pending: the customer who has waited longest is answered
    // first. Newest first for history, which is read as a log.
    .order("created_at", { ascending: status === "pending" })
    .limit(PAGE);
  if (configId) q = q.eq("config_id", configId);

  const { data: rows } = await q;

  const counts = async (st: string) => {
    let c = supabaseAdmin.from("dm_tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id).eq("platform", "tiktok").eq("status", st);
    if (configId) c = c.eq("config_id", configId);
    return (await c).count ?? 0;
  };
  const [pending, sent, skipped] = await Promise.all([
    counts("pending"), counts("sent"), counts("skipped"),
  ]);

  return NextResponse.json({
    counts: { pending, sent, skipped },
    tasks: (rows || []).map((t) => ({
      id: t.id,
      commenter: t.commenter,
      question: (t.comment_text || "").replace(/\s+/g, " ").slice(0, 120),
      body: t.body,
      status: t.status,
      createdAt: t.created_at,
      sentAt: t.sent_at,
      // Opens the person's profile in the TikTok app, where the Message button is.
      profileUrl: t.commenter ? `https://www.tiktok.com/@${encodeURIComponent(t.commenter)}` : null,
    })),
  });
}

/**
 * Marks tasks sent or skipped. Accepts a list, because the staff member works
 * through several and the screen should not fire one request per tap.
 *
 * It records a human's claim that they sent it -- there is no way to verify from
 * outside TikTok, and pretending otherwise would be a lie in the report. The
 * number this produces is "messages the team says it sent", and the UI says so.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : [];
  const status = body.status === "skipped" ? "skipped" : "sent";
  if (!ids.length) return NextResponse.json({ error: "no_ids" }, { status: 400 });
  if (ids.length > 200) return NextResponse.json({ error: "too_many" }, { status: 400 });

  // The user_id filter is the authorisation: ids belonging to anyone else simply
  // match no rows, so a forged id changes nothing.
  const { data, error } = await supabaseAdmin
    .from("dm_tasks")
    .update({ status, sent_at: new Date().toISOString(), sent_by: user.id })
    .in("id", ids)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .select("id");

  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
  return NextResponse.json({ ok: true, updated: data?.length ?? 0 });
}
