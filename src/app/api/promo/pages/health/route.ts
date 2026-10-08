import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isPageTokenAlive, canPublishToPage } from "@/services/meta";

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
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { data: pages } = await supabaseAdmin
    .from("connected_pages")
    .select("page_id, page_access_token")
    .eq("user_id", user.id);

  const list = pages || [];
  const results = await Promise.all(list.map(async (p) => {
    const token = p.page_access_token as string | null;
    const alive = await isPageTokenAlive(p.page_id, token);
    // Only worth asking of a live token — a dead one needs re-authorizing anyway.
    const canPublish = alive && token ? await canPublishToPage(token) : null;
    return { pageId: p.page_id, alive, canPublish };
  }));

  const statuses: Record<string, string> = {};
  const publishing: Record<string, boolean | null> = {};
  for (const r of results) {
    statuses[r.pageId] = r.alive ? "alive" : "dead";
    publishing[r.pageId] = r.canPublish;
  }

  const dead = results.filter((r) => !r.alive).length;
  // Alive, but cannot publish: the specific case that re-connecting fixes.
  const needsReconnect = results.filter((r) => r.alive && r.canPublish === false).length;

  return NextResponse.json({
    statuses, publishing, total: list.length, dead, needsReconnect,
    message: needsReconnect > 0
      ? "بعض الصفحات مرتبطة قبل اعتماد صلاحية النشر — أعد ربطها ليعمل نشر الموظف الذكي."
      : null,
  });
}
