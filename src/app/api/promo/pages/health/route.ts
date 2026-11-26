import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { pageTokenStatus, canPublishToPage } from "@/services/meta";

async function getUser() {
  const store = await cookies();
  const anon = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => store.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await anon.auth.getUser();
  return user;
}

/*
 * GET — what each connected Page's stored token can still do.
 *
 * Two different problems, which need two different answers from the owner:
 *
 *   "dead"       — the token was invalidated (the Facebook account usually lost its
 *                  admin role on the Page, or the password changed) → re-authorize.
 *   canPublish   — the token is alive but was minted before `pages_manage_posts` was
 *                  approved. A token never gains permissions after it is issued, so
 *                  publishing keeps failing until the Page is RE-CONNECTED. Without
 *                  this check that shows up one post at a time as a generic
 *                  "(#200) Permissions error".
 */
// Graph quota guard: the app's hourly Graph budget is small (it scales with daily
// users), and this endpoint used to spend 2 calls × every Page × every visit — 82 Pages
// opened 5 times exhausted it and blocked OAuth ("(#4) Application request limit").
// Now: a Page is re-checked at most every 12 h, at most 15 per visit, 4 at a time,
// and the run stops at the first throttling answer. Throttling is never "dead".
const RECHECK_MS = 12 * 60 * 60 * 1000;
const MAX_PER_VISIT = 15;

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { data: pages } = await supabaseAdmin
    .from("connected_pages")
    .select("page_id, page_access_token, token_status, can_publish, health_checked_at")
    .eq("user_id", user.id);

  const list = pages || [];
  const now = Date.now();
  const stale = list
    .filter((p) => !p.health_checked_at || now - new Date(p.health_checked_at).getTime() > RECHECK_MS)
    .sort((a, b) => (a.health_checked_at ? new Date(a.health_checked_at).getTime() : 0) - (b.health_checked_at ? new Date(b.health_checked_at).getTime() : 0))
    .slice(0, MAX_PER_VISIT);

  let throttled = false;
  const fresh = new Map<string, { status: string | null; canPublish: boolean | null }>();
  for (let i = 0; i < stale.length && !throttled; i += 4) {
    const batch = stale.slice(i, i + 4);
    const res = await Promise.all(batch.map(async (p) => {
      const token = p.page_access_token as string | null;
      const st = await pageTokenStatus(p.page_id, token);
      if (st === "throttled") return { p, st, canPublish: null as boolean | null };
      // Only worth asking of a live token — a dead one needs re-authorizing anyway.
      const canPublish = st === "alive" && token ? await canPublishToPage(token) : null;
      return { p, st, canPublish };
    }));
    for (const r of res) {
      if (r.st === "throttled") { throttled = true; continue; }
      if (r.st === "unknown") continue;
      fresh.set(r.p.page_id, { status: r.st, canPublish: r.canPublish });
      await supabaseAdmin.from("connected_pages")
        .update({ token_status: r.st, can_publish: r.canPublish, health_checked_at: new Date().toISOString() })
        .eq("user_id", user.id).eq("page_id", r.p.page_id);
    }
  }

  const statuses: Record<string, string> = {};
  const publishing: Record<string, boolean | null> = {};
  for (const p of list) {
    const f = fresh.get(p.page_id);
    const status = f?.status ?? p.token_status ?? null;
    if (status === "alive" || status === "dead") statuses[p.page_id] = status;   // unknown → no badge, never "dead"
    publishing[p.page_id] = f ? f.canPublish : (p.can_publish ?? null);
  }

  const dead = Object.values(statuses).filter((v) => v === "dead").length;
  const needsReconnect = list.filter((p) => statuses[p.page_id] === "alive" && publishing[p.page_id] === false).length;
  const unchecked = list.length - Object.keys(statuses).length;

  return NextResponse.json({
    statuses, publishing, total: list.length, dead, needsReconnect, unchecked, throttled,
    message: throttled
      ? "فيسبوك يحدّ الطلبات مؤقتاً، فأجّلنا فحص بقية الصفحات. ستُفحص تلقائياً لاحقاً."
      : needsReconnect > 0
        ? "بعض الصفحات مرتبطة قبل اعتماد صلاحية النشر — أعد ربطها ليعمل نشر الموظف الذكي."
        : null,
  });
}
