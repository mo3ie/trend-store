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
    const posts = await getPagePosts(page.page_access_token);
    return NextResponse.json({ posts });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Meta API error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
