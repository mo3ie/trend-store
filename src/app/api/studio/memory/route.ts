import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";

// GET ?pageId= — the AI "brain" (style + accumulated notes) for this Page.
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const pageId = req.nextUrl.searchParams.get("pageId") || "*";
  const { data } = await supabaseAdmin
    .from("studio_memory").select("*")
    .eq("user_id", user.id).eq("page_id", pageId).maybeSingle();
  return NextResponse.json({ memory: data || null });
}

// PUT — save style/notes. Body: { pageId, style, notes }
export async function PUT(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const b = await req.json();
  const pageId = String(b.pageId || "*");
  const { data, error } = await supabaseAdmin
    .from("studio_memory").upsert({
      user_id: user.id, page_id: pageId,
      style: typeof b.style === "string" ? b.style.slice(0, 2000) : null,
      notes: typeof b.notes === "string" ? b.notes.slice(0, 4000) : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,page_id" }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ memory: data });
}
