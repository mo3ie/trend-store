import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getPagePosts } from "@/services/meta";

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

// GET — list the connected Page's recent posts (?pageId=...)
// Uses the stored page_access_token → demonstrates pages_read_engagement.
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const pageId = searchParams.get("pageId");
  if (!pageId) return NextResponse.json({ error: "pageId مطلوب" }, { status: 400 });

  // Verify the page belongs to this user and load its token
  const { data: page } = await supabaseAdmin
    .from("connected_pages")
    .select("page_access_token")
    .eq("user_id", user.id)
    .eq("page_id", pageId)
    .single();

  if (!page) return NextResponse.json({ error: "الصفحة غير مرتبطة بحسابك" }, { status: 403 });

  try {
    const posts = await getPagePosts(pageId, page.page_access_token);
    return NextResponse.json({ posts, source: "page_token" });
  } catch (err: unknown) {
    // The stored OAuth page token can expire or be invalidated (code 190 /
    // subcode 460 after a password change or Meta security reset). Retry with the
    // store's system-user token (omit the token → graph() uses SYS_TOKEN) — this
    // works for Pages the system user manages, without forcing a reconnect.
    let sysErr = "";
    try {
      const posts = await getPagePosts(pageId, undefined);
      return NextResponse.json({ posts, source: "system_token" });
    } catch (e) { sysErr = e instanceof Error ? e.message : String(e); }
    // Both the stored token and the system-user retry failed. If the stored
    // token was invalidated, tell the client to have the user reconnect this Page
    // (its posts can't be read until the OAuth token is refreshed).
    const msg = err instanceof Error ? err.message : "Meta API error";
    const invalidated = /invalidat|expired|session|OAuth|code.?190|malformed|190/i.test(msg);
    return NextResponse.json(
      { posts: [], error: msg, reason: invalidated ? "reconnect" : "error", debug: { pageTokenError: msg.slice(0, 200), systemTokenError: sysErr.slice(0, 200) } },
      { status: 200 }
    );
  }
}
