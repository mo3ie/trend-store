import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { tiktokWebhookUrl } from "@/lib/siteUrl";
import { updateWebhookConfig, tiktokConfigured, TikTokError } from "@/services/tiktok";

/**
 * Registers the app's comment webhook, so replies go out in seconds rather than
 * waiting for the next sweep.
 *
 * This was an admin-only action behind a button, which made real-time delivery an
 * opt-in that every owner had to discover. It is the wrong default twice over: the
 * configuration is APP-level — one callback URL receives `comment.update` for every
 * account that will ever link — so the first owner to press it would silently have
 * been fixing it for everyone else, and the ones who never pressed it would wonder why
 * their bot was a day behind.
 *
 * Extracted here so linking an account can just do it. The admin route keeps its
 * explicit POST for re-registering after a URL change or a failure.
 */

const EVENT_TYPE = "COMMENT" as const;

export interface WebhookSetupResult {
  ok: boolean;
  /** True when it was already registered and nothing needed doing. */
  skipped?: boolean;
  reason?: string;
}

/**
 * Makes sure the webhook is registered. Safe to call on every link: it checks the
 * stored state first, and TikTok's own call is an upsert.
 *
 * Never throws — a registration problem must not cost an owner the account link they
 * just completed, and the daily sweep still covers them while it is sorted out.
 */
export async function ensureCommentWebhook(force = false): Promise<WebhookSetupResult> {
  if (!tiktokConfigured()) return { ok: false, reason: "not_configured" };

  if (!force) {
    const { data } = await supabaseAdmin
      .from("tiktok_webhook_config")
      .select("subscribed, callback_url")
      .eq("id", 1).maybeSingle();
    // Already pointing at the URL we would register — nothing to do.
    if (data?.subscribed && data.callback_url === tiktokWebhookUrl()) {
      return { ok: true, skipped: true };
    }
  }

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
    return { ok: true };
  } catch (err) {
    const note = err instanceof TikTokError ? `${err.kind}:${err.ttCode ?? ""}` : "internal";
    if (err instanceof TikTokError) console.error(err.toLogLine());
    await supabaseAdmin.from("tiktok_webhook_config").upsert({
      id: 1, event_type: EVENT_TYPE, callback_url: callbackUrl,
      subscribed: false, last_error: note, updated_at: new Date().toISOString(),
    });
    return { ok: false, reason: note };
  }
}
