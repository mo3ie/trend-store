import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";

// GET ?pageId= — the reply-bot summary for a Page: whether it's subscribed, AI
// status, the linked accounts (tokens) and which is active.
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const pageId = req.nextUrl.searchParams.get("pageId");
  if (!pageId) return NextResponse.json({ error: "pageId مطلوب" }, { status: 400 });

  const { data: config } = await supabaseAdmin
    .from("bot_configs")
    .select("id, enabled, ai_enabled, like_comments, active_token_id")
    .eq("user_id", user.id).eq("page_id", pageId).eq("platform", "meta").maybeSingle();

  const { data: sub } = await supabaseAdmin
    .from("bot_subscriptions").select("status, expires_at")
    .eq("user_id", user.id).eq("page_id", pageId).maybeSingle();
  const subscribed = !!sub && sub.status === "active" && (!sub.expires_at || new Date(sub.expires_at).getTime() > Date.now());

  let tokens: { id: string; label: string }[] = [];
  if (config) {
    const { data: toks } = await supabaseAdmin
      .from("bot_page_tokens").select("id, label").eq("config_id", config.id);
    tokens = (toks || []).map((tk) => ({ id: tk.id, label: tk.label || "حساب" }));
  }

  return NextResponse.json({
    hasConfig:   !!config,
    enabled:     config?.enabled ?? false,
    subscribed,
    aiEnabled:   config?.ai_enabled ?? false,
    likeComments: config?.like_comments ?? false,
    activeTokenId: config?.active_token_id ?? null,
    configId:    config?.id ?? null,
    tokens,
  });
}

// POST { pageId, action } — switch the active linked account for replies.
// action: "set_token" { tokenId }
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const b = await req.json();
  if (!b.pageId) return NextResponse.json({ error: "pageId مطلوب" }, { status: 400 });

  const { data: config } = await supabaseAdmin
    .from("bot_configs").select("id").eq("user_id", user.id).eq("page_id", b.pageId).eq("platform", "meta").maybeSingle();
  if (!config) return NextResponse.json({ error: "لا يوجد بوت لهذه الصفحة" }, { status: 400 });

  if (b.action === "set_token" && b.tokenId) {
    await supabaseAdmin.from("bot_configs").update({ active_token_id: b.tokenId }).eq("id", config.id).eq("user_id", user.id);
    return NextResponse.json({ ok: true, activeTokenId: b.tokenId });
  }
  return NextResponse.json({ error: "action غير صحيح" }, { status: 400 });
}
