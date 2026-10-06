import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";

/**
 * GET — every destination the AI Employee can work on: Facebook Pages and TikTok
 * accounts, in one list, each tagged with its platform.
 *
 * The Studio's tables are keyed by (user_id, page_id), and a TikTok account id is
 * just another page_id, so the brand profile, catalog, plans and posts need no
 * second home. Only this list and the publish step care which platform a
 * destination belongs to.
 */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const [fb, tt] = await Promise.all([
    supabaseAdmin.from("connected_pages")
      .select("page_id, page_name, page_picture")
      .eq("user_id", user.id).eq("platform", "meta"),
    supabaseAdmin.from("tiktok_accounts")
      .select("id, tiktok_account_id, display_name, avatar_url")
      .eq("user_id", user.id).is("revoked_at", null),
  ]);

  const pages = [
    ...(fb.data || []).map((p) => ({
      platform: "meta" as const,
      page_id: p.page_id,
      page_name: p.page_name,
      page_picture: p.page_picture,
      account_id: null as string | null,
    })),
    ...(tt.data || []).map((a) => ({
      platform: "tiktok" as const,
      page_id: a.tiktok_account_id,
      page_name: a.display_name || "TikTok",
      page_picture: a.avatar_url,
      account_id: a.id,
    })),
  ];

  // De-duplicate: the same Page can be linked under more than one store account.
  const seen = new Set<string>();
  return NextResponse.json({
    pages: pages.filter((p) => (seen.has(`${p.platform}:${p.page_id}`) ? false : (seen.add(`${p.platform}:${p.page_id}`), true))),
  });
}
