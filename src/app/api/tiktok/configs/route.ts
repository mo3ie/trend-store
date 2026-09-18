import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import { checkRateLimit, rateLimitedJson, identifierFor, RATE_RULES } from "@/lib/rateLimit";
import { listTikTokAccounts, tokenStatusFor, disconnectTikTokAccount } from "@/lib/tiktokTokens";

const EDITABLE = ["enabled", "reply_public", "ai_enabled", "ai_persona", "throttle_per_min"] as const;

/**
 * GET — the user's connected TikTok accounts.
 *
 * Joins three sources, and returns NO credential material of any kind:
 *   * tiktok_accounts  — identity + granted scopes (browser-safe metadata)
 *   * tiktok_tokens    — status/expiry only (never the token itself)
 *   * bot_configs      — the rule-engine settings + subscription for the same account
 */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const [tiktokAccounts, { data: configs }, { data: subs }, { data: webhook }] = await Promise.all([
    listTikTokAccounts(user.id),
    supabaseAdmin.from("bot_configs").select("*").eq("user_id", user.id).eq("platform", "tiktok"),
    supabaseAdmin.from("bot_subscriptions").select("*").eq("user_id", user.id).eq("platform", "tiktok"),
    supabaseAdmin.from("tiktok_webhook_config").select("subscribed, event_type, last_event_at").eq("id", 1).maybeSingle(),
  ]);

  const subByPage = new Map((subs || []).map((s) => [s.page_id, s]));
  const configByPage = new Map((configs || []).map((c) => [c.page_id, c]));

  const accounts = await Promise.all(
    tiktokAccounts.map(async (a) => {
      const credential = await tokenStatusFor(a.id);
      return {
        account_id: a.id,
        // open_id and business_id are the same value by definition (DB-generated columns).
        page_id: a.tiktok_account_id,
        open_id: a.tiktok_account_id,
        business_id: a.tiktok_account_id,
        page_name: a.display_name || a.username || "TikTok",
        page_picture: a.avatar_url,
        username: a.username,
        display_name: a.display_name,
        granted_scopes: a.granted_scopes ?? [],
        connected_at: a.connected_at,
        // Credential health, never the credential.
        token_status: credential?.status ?? "missing",
        token_expires_at: credential?.accessExpiresAt ?? null,
        config: configByPage.get(a.tiktok_account_id) ?? null,
        subscription: subByPage.get(a.tiktok_account_id) ?? null,
      };
    }),
  );

  return NextResponse.json({
    accounts,
    webhook: {
      // App-level: one configuration serves every connected account.
      subscribed: !!webhook?.subscribed,
      event_type: webhook?.event_type ?? "COMMENT",
      last_event_at: webhook?.last_event_at ?? null,
    },
  });
}

/** PATCH — update the bot config for a TikTok account. Body: { id, ...fields } */
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const limit = await checkRateLimit(RATE_RULES.tiktokConfigWrite, identifierFor(req, user.id));
  if (!limit.allowed) return rateLimitedJson(limit);

  const body = await req.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

  const { data: config } = await supabaseAdmin.from("bot_configs")
    .select("*").eq("id", id).eq("user_id", user.id).eq("platform", "tiktok").single();
  if (!config) return NextResponse.json({ error: "الإعداد غير موجود" }, { status: 404 });

  // Turning the bot on requires an active subscription (same gate as Meta).
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
  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
  return NextResponse.json({ config: updated });
}

/**
 * DELETE — disconnect a TikTok account. ?accountId= (preferred) or ?id= (bot config id).
 *
 * Revokes the token at TikTok first, then destroys the local credential and marks the
 * account revoked. The local teardown runs even if the remote revoke fails, so no
 * credential survives a disconnect.
 */
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const limit = await checkRateLimit(RATE_RULES.tiktokConfigWrite, identifierFor(req, user.id));
  if (!limit.allowed) return rateLimitedJson(limit);

  const accountId = req.nextUrl.searchParams.get("accountId");
  const configId = req.nextUrl.searchParams.get("id");
  if (!accountId && !configId) return NextResponse.json({ error: "accountId مطلوب" }, { status: 400 });

  // Resolve the tiktok_accounts row, whichever id the caller had.
  let resolvedAccountId = accountId;
  let openId: string | null = null;

  if (!resolvedAccountId && configId) {
    const { data: config } = await supabaseAdmin.from("bot_configs")
      .select("page_id, tiktok_account_id").eq("id", configId).eq("user_id", user.id)
      .eq("platform", "tiktok").maybeSingle();
    if (!config) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    resolvedAccountId = config.tiktok_account_id as string | null;
    openId = config.page_id as string;
  }

  if (resolvedAccountId) {
    const { data: account } = await supabaseAdmin.from("tiktok_accounts")
      .select("id, tiktok_account_id").eq("id", resolvedAccountId).eq("user_id", user.id).maybeSingle();
    if (!account) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    openId = account.tiktok_account_id as string;

    const result = await disconnectTikTokAccount(resolvedAccountId, user.id);
    if (!result.ok) return NextResponse.json({ error: "disconnect_failed" }, { status: 500 });
    await supabaseAdmin.from("tiktok_accounts")
      .update({ status: "revoked" }).eq("id", resolvedAccountId).eq("user_id", user.id);
  }

  // Turn the bot off for this account; rules and history are kept so a re-connect resumes.
  if (openId) {
    await supabaseAdmin.from("bot_configs")
      .update({ enabled: false, tiktok_account_id: null })
      .eq("user_id", user.id).eq("platform", "tiktok").eq("page_id", openId);
  }

  return NextResponse.json({ ok: true });
}
