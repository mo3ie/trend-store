import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";

// The rotation pool of Page access tokens (multiple admin FB accounts on one page).
// Adding a NEW account happens through the OAuth flow (the callback appends any token
// for a page that already has a bot config). Here we list / toggle / remove tokens.

// GET — pool tokens for a config. ?configId=  (token strings are never returned)
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const configId = req.nextUrl.searchParams.get("configId");
  if (!configId) return NextResponse.json({ error: "configId مطلوب" }, { status: 400 });

  const { data: tokens } = await supabaseAdmin
    .from("bot_page_tokens")
    .select("id, label, status, cooldown_until, fail_count, last_used_at, created_at")
    .eq("config_id", configId).eq("user_id", user.id)
    .order("created_at", { ascending: true });
  return NextResponse.json({ tokens: tokens || [] });
}

// PATCH — enable/disable a token in the pool (manual switch). Body: { id, status }
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { id, status, label } = await req.json();
  if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (status === "active") { patch.status = "active"; patch.cooldown_until = null; patch.fail_count = 0; }
  else if (status === "dead") { patch.status = "dead"; }
  if (typeof label === "string") patch.label = label;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "لا تغيير" }, { status: 400 });

  await supabaseAdmin.from("bot_page_tokens").update(patch).eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}

// DELETE — remove a token from the pool. ?id=
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

  await supabaseAdmin.from("bot_page_tokens").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
