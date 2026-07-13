import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";

const EDITABLE = ["enabled", "reply_public", "ai_enabled", "ai_persona", "throttle_per_min"] as const;

// GET — the user's connected TikTok accounts, each with its bot config + subscription.
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const [{ data: configs }, { data: subs }] = await Promise.all([
    supabaseAdmin.from("bot_configs").select("*")
      .eq("user_id", user.id).eq("platform", "tiktok"),
    supabaseAdmin.from("bot_subscriptions").select("*")
      .eq("user_id", user.id).eq("platform", "tiktok"),
  ]);

  const subByPage = new Map((subs || []).map((s) => [s.page_id, s]));
  const accounts = (configs || []).map((c) => ({
    page_id:      c.page_id,
    page_name:    c.page_name,
    page_picture: c.page_picture,
    config:       c,
    subscription: subByPage.get(c.page_id) ?? null,
  }));

  return NextResponse.json({ accounts });
}

// PATCH — update a TikTok bot config / toggle it on. Body: { id, ...fields }
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const body = await req.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

  const { data: config } = await supabaseAdmin.from("bot_configs")
    .select("*").eq("id", id).eq("user_id", user.id).eq("platform", "tiktok").single();
  if (!config) return NextResponse.json({ error: "الإعداد غير موجود" }, { status: 404 });

  // Turning it on requires an active subscription (same gate as Meta).
  if (body.enabled === true && !config.enabled) {
    const { data: sub } = await supabaseAdmin.from("bot_subscriptions")
      .select("status, expires_at")
      .eq("user_id", user.id).eq("page_id", config.page_id).eq("platform", "tiktok").maybeSingle();
    const active = sub && sub.status === "active" &&
      (!sub.expires_at || new Date(sub.expires_at).getTime() > Date.now());
    if (!active) {
      return NextResponse.json({ error: "no_subscription", message: "يلزم اشتراك فعّال لتشغيل البوت" }, { status: 402 });
    }
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of EDITABLE) if (k in body) patch[k] = body[k];

  const { data: updated, error } = await supabaseAdmin
    .from("bot_configs").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: updated });
}

// DELETE — disconnect a TikTok account. ?id=
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

  await supabaseAdmin.from("bot_configs").delete()
    .eq("id", id).eq("user_id", user.id).eq("platform", "tiktok");
  return NextResponse.json({ ok: true });
}
