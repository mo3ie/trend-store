import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import { subscribePageToWebhook } from "@/services/meta";

// Fields a user is allowed to change on their bot config.
const EDITABLE = [
  "enabled", "reply_public", "reply_private", "ai_enabled", "ai_persona",
  "default_public_reply", "throttle_per_min",
] as const;

// GET — the user's Meta Pages, each merged with its bot config + subscription state.
// Drives the /bot dashboard: which pages have a bot, whether it's on, and sub status.
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const [{ data: pages }, { data: configs }, { data: subs }] = await Promise.all([
    supabaseAdmin.from("connected_pages")
      .select("page_id, page_name, page_picture")
      .eq("user_id", user.id).eq("platform", "meta"),
    supabaseAdmin.from("bot_configs")
      .select("*").eq("user_id", user.id).eq("platform", "meta"),
    supabaseAdmin.from("bot_subscriptions")
      .select("*").eq("user_id", user.id).eq("platform", "meta"),
  ]);

  const cfgByPage = new Map((configs || []).map((c) => [c.page_id, c]));
  const subByPage = new Map((subs || []).map((s) => [s.page_id, s]));

  // De-dup pages by page_id (same page can be linked from multiple FB accounts).
  const seen = new Set<string>();
  const merged = (pages || []).filter((p) => {
    if (seen.has(p.page_id)) return false;
    seen.add(p.page_id);
    return true;
  }).map((p) => ({
    page_id:      p.page_id,
    page_name:    p.page_name,
    page_picture: p.page_picture,
    config:       cfgByPage.get(p.page_id) ?? null,
    subscription: subByPage.get(p.page_id) ?? null,
  }));

  return NextResponse.json({ pages: merged });
}

// POST — create a bot config for a page (disabled by default) and seed the token pool
// from the page's OAuth token. Body: { pageId }.
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { pageId } = await req.json();
  if (!pageId) return NextResponse.json({ error: "pageId مطلوب" }, { status: 400 });

  const { data: page } = await supabaseAdmin
    .from("connected_pages")
    .select("page_id, page_name, page_picture, page_access_token")
    .eq("user_id", user.id).eq("page_id", pageId).eq("platform", "meta")
    .single();
  if (!page) return NextResponse.json({ error: "الصفحة غير مرتبطة بحسابك" }, { status: 403 });

  const { data: config, error } = await supabaseAdmin
    .from("bot_configs")
    .upsert({
      user_id:      user.id,
      page_id:      page.page_id,
      page_name:    page.page_name,
      page_picture: page.page_picture,
      platform:     "meta",
    }, { onConflict: "user_id,page_id,platform" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Seed the rotation pool with this page's token (idempotent-ish: skip if present).
  const { data: existingTok } = await supabaseAdmin
    .from("bot_page_tokens")
    .select("id").eq("config_id", config.id).eq("access_token", page.page_access_token).maybeSingle();
  if (!existingTok) {
    await supabaseAdmin.from("bot_page_tokens").insert({
      config_id:    config.id,
      user_id:      user.id,
      page_id:      page.page_id,
      label:        page.page_name || "الحساب الأساسي",
      access_token: page.page_access_token,
    });
  }

  return NextResponse.json({ config });
}

// PATCH — update config settings / toggle the bot. Body: { id, ...fields }.
// Enabling requires an active subscription and subscribes the Page to webhooks.
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const body = await req.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

  const { data: config } = await supabaseAdmin
    .from("bot_configs").select("*").eq("id", id).eq("user_id", user.id).single();
  if (!config) return NextResponse.json({ error: "الإعداد غير موجود" }, { status: 404 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of EDITABLE) if (k in body) patch[k] = body[k];

  // Turning the bot ON: require an active subscription, then make sure the Page is
  // subscribed to our webhook so comment events start arriving.
  if (patch.enabled === true && !config.enabled) {
    const { data: sub } = await supabaseAdmin
      .from("bot_subscriptions").select("status, expires_at")
      .eq("user_id", user.id).eq("page_id", config.page_id).maybeSingle();
    const active = sub && sub.status === "active" &&
      (!sub.expires_at || new Date(sub.expires_at).getTime() > Date.now());
    if (!active) {
      return NextResponse.json({ error: "no_subscription", message: "يلزم اشتراك فعّال لتشغيل البوت" }, { status: 402 });
    }

    if (!config.webhook_subscribed) {
      const { data: tok } = await supabaseAdmin
        .from("bot_page_tokens").select("access_token")
        .eq("config_id", config.id).eq("status", "active").limit(1).maybeSingle();
      if (tok?.access_token) {
        try {
          await subscribePageToWebhook(config.page_id, tok.access_token);
          patch.webhook_subscribed = true;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "webhook subscribe failed";
          return NextResponse.json({ error: msg }, { status: 500 });
        }
      }
    }
  }

  const { data: updated, error } = await supabaseAdmin
    .from("bot_configs").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: updated });
}

// DELETE — remove a bot config (cascades rules, log, tokens). ?id=
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

  await supabaseAdmin.from("bot_configs").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
