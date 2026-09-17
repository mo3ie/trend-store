import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isPageTokenAlive } from "@/services/meta";

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

// GET — check each connected Page's stored token. Returns { statuses: { pageId: "alive"|"dead" } }.
// "dead" means the OAuth token was invalidated (usually the Facebook account lost its
// admin role on the Page, or a password change) → the Page must be re-authorized.
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { data: pages } = await supabaseAdmin
    .from("connected_pages")
    .select("page_id, page_access_token")
    .eq("user_id", user.id);

  const list = pages || [];
  const results = await Promise.all(list.map(async (p) => {
    const alive = await isPageTokenAlive(p.page_id, p.page_access_token as string | null);
    return [p.page_id, alive ? "alive" : "dead"] as const;
  }));

  const statuses: Record<string, string> = {};
  for (const [id, st] of results) statuses[id] = st;
  const dead = results.filter(([, st]) => st === "dead").length;
  return NextResponse.json({ statuses, total: list.length, dead });
}
