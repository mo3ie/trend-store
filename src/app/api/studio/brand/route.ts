import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";

// GET ?pageId= — load the store/brand profile for a connected Page.
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const pageId = req.nextUrl.searchParams.get("pageId");
  if (!pageId) return NextResponse.json({ error: "pageId مطلوب" }, { status: 400 });

  const { data } = await supabaseAdmin
    .from("studio_brands").select("*")
    .eq("user_id", user.id).eq("page_id", pageId).maybeSingle();
  return NextResponse.json({ brand: data });
}

// PUT — upsert the brand profile. Body: { pageId, brand_name, phones[], addresses[], links[], hours, tone, logo_url, colors, extra }
export async function PUT(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const b = await req.json();
  if (!b.pageId) return NextResponse.json({ error: "pageId مطلوب" }, { status: 400 });

  const arr = (v: unknown) => Array.isArray(v) ? v.map(String).filter((x) => x.trim()) : [];
  const row = {
    user_id:    user.id,
    page_id:    String(b.pageId),
    brand_name: b.brand_name ?? null,
    phones:     arr(b.phones),
    addresses:  arr(b.addresses),
    links:      arr(b.links),
    hours:      b.hours ?? null,
    tone:       b.tone ?? null,
    logo_url:   b.logo_url ?? null,
    colors:     b.colors ?? null,
    extra:      b.extra ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabaseAdmin
    .from("studio_brands").upsert(row, { onConflict: "user_id,page_id" })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ brand: data });
}
