import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

// GET — the user's saved audiences.
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const { data } = await supabaseAdmin
    .from("ad_audiences").select("id, name, targeting, created_at")
    .eq("user_id", user.id).order("created_at", { ascending: false });
  return NextResponse.json({ audiences: data || [] });
}

// POST — save an audience. Body: { name, targeting }.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const { name, targeting } = await req.json();
  if (!name || typeof name !== "string") return NextResponse.json({ error: "الاسم مطلوب" }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from("ad_audiences")
    .insert({ user_id: user.id, name: name.slice(0, 80), targeting: targeting || {} })
    .select("id, name, targeting, created_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ audience: data });
}

// DELETE — ?id=
export async function DELETE(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });
  await supabaseAdmin.from("ad_audiences").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
