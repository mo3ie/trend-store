import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";

/**
 * Saved TikTok audiences — a targeting set the advertiser names once and reuses.
 *
 * Separate from the Facebook list on purpose. A saved audience stores raw platform
 * identifiers, and TikTok location / interest-category ids are not Meta geo keys and
 * interest ids. One shared list would let an advertiser apply a Facebook audience to a
 * TikTok campaign, which does not error — it just sends TikTok identifiers it has
 * never seen and targets nobody, after the campaign is paid for.
 */

/** GET — this advertiser's saved TikTok audiences. */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { data } = await supabaseAdmin
    .from("ad_audiences").select("id, name, targeting, created_at")
    .eq("user_id", user.id).eq("platform", "tiktok")
    .order("created_at", { ascending: false });

  return NextResponse.json({ audiences: data || [] });
}

/** POST { name, targeting } — save one. */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { name, targeting } = await req.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "اسم الجمهور مطلوب" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("ad_audiences")
    .insert({
      user_id: user.id, platform: "tiktok",
      name: name.trim().slice(0, 80),
      targeting: targeting && typeof targeting === "object" ? targeting : {},
    })
    .select("id, name, targeting, created_at").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ audience: data });
}

/** DELETE ?id= */
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

  await supabaseAdmin.from("ad_audiences")
    .delete().eq("id", id).eq("user_id", user.id).eq("platform", "tiktok");
  return NextResponse.json({ ok: true });
}
