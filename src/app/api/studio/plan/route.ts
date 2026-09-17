import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";

// GET ?pageId= — the latest content plan + its posts for a Page.
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const pageId = req.nextUrl.searchParams.get("pageId");
  if (!pageId) return NextResponse.json({ error: "pageId مطلوب" }, { status: 400 });

  const { data: plan } = await supabaseAdmin
    .from("studio_plans").select("*")
    .eq("user_id", user.id).eq("page_id", pageId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!plan) return NextResponse.json({ plan: null, posts: [] });

  const { data: posts } = await supabaseAdmin
    .from("studio_posts").select("*")
    .eq("plan_id", plan.id).order("scheduled_for", { ascending: true });
  return NextResponse.json({ plan, posts: posts || [] });
}

// PATCH — approve the whole plan. Body: { id, status }
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const b = await req.json();
  if (!b.id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });
  const status = ["draft", "approved", "active", "done"].includes(b.status) ? b.status : "approved";
  const { data } = await supabaseAdmin
    .from("studio_plans").update({ status }).eq("id", b.id).eq("user_id", user.id).select().single();
  // Approving the plan marks its still-draft posts approved too.
  if (status === "approved") {
    await supabaseAdmin.from("studio_posts").update({ status: "approved" }).eq("plan_id", b.id).eq("status", "draft");
  }
  return NextResponse.json({ plan: data });
}

// DELETE ?id= — discard a plan (cascades to its posts).
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });
  await supabaseAdmin.from("studio_plans").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
