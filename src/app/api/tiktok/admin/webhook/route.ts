import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/apiAuth";
import { tiktokWebhookUrl } from "@/lib/siteUrl";
import {
  updateWebhookConfig, listWebhookConfigs, deleteWebhookConfig, tiktokConfigured, TikTokError,
} from "@/services/tiktok";

/**
 * Admin-only management of the APP-LEVEL TikTok webhook configuration.
 *
 * TikTok webhook configuration belongs to the developer app, not to a customer: one
 * callback URL receives `comment.update` for every connected account. So this is an
 * operator action, gated on profiles.role — customers never call it, and there is
 * deliberately no per-customer subscribe endpoint.
 *
 * The app secret is read server-side from the environment and is never accepted from the
 * request body, so a webhook secret can never be set from the browser.
 */

const EVENT_TYPE = "COMMENT" as const;

function configuredGuard(): NextResponse | null {
  if (!tiktokConfigured()) {
    return NextResponse.json(
      { error: "tiktok_not_configured", message: "TikTok credentials are not configured" },
      { status: 503 },
    );
  }
  return null;
}

/** GET — what TikTok currently has registered, plus our local record of it. */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const guard = configuredGuard();
  if (guard) return guard;

  try {
    const [remote, { data: local }] = await Promise.all([
      listWebhookConfigs(),
      supabaseAdmin.from("tiktok_webhook_config").select("*").eq("id", 1).maybeSingle(),
    ]);
    return NextResponse.json({
      expected_callback_url: tiktokWebhookUrl(),
      remote,
      local: local ?? null,
    });
  } catch (err) {
    if (err instanceof TikTokError) console.error(err.toLogLine());
    return NextResponse.json({ error: "tiktok_request_failed" }, { status: 502 });
  }
}

/** POST — register/refresh the comment webhook on the canonical callback URL. */
export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const guard = configuredGuard();
  if (guard) return guard;

  const callbackUrl = tiktokWebhookUrl();
  try {
    const config = await updateWebhookConfig(EVENT_TYPE, callbackUrl);
    await supabaseAdmin.from("tiktok_webhook_config").upsert({
      id: 1,
      event_type: EVENT_TYPE,
      callback_url: config.callbackUrl,
      subscribed: true,
      last_error: null,
      updated_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, callback_url: config.callbackUrl, event_type: config.eventType });
  } catch (err) {
    const note = err instanceof TikTokError ? `${err.kind}:${err.ttCode ?? ""}` : "internal";
    if (err instanceof TikTokError) console.error(err.toLogLine());
    await supabaseAdmin.from("tiktok_webhook_config").upsert({
      id: 1, event_type: EVENT_TYPE, callback_url: callbackUrl,
      subscribed: false, last_error: note, updated_at: new Date().toISOString(),
    });
    return NextResponse.json({ error: "subscribe_failed" }, { status: 502 });
  }
}

/** DELETE — unsubscribe the app from comment webhooks. */
export async function DELETE() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const guard = configuredGuard();
  if (guard) return guard;

  try {
    await deleteWebhookConfig(EVENT_TYPE);
    await supabaseAdmin.from("tiktok_webhook_config")
      .update({ subscribed: false, updated_at: new Date().toISOString() }).eq("id", 1);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof TikTokError) console.error(err.toLogLine());
    return NextResponse.json({ error: "unsubscribe_failed" }, { status: 502 });
  }
}
