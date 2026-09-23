/**
 * Start Facebook Page authorisation from wherever the user already is.
 *
 * Connecting used to mean a detour through `/ads/connect` — the ads section's own
 * landing screen — even when the user was in the Studio or the bot, and Facebook
 * then returned them there too. This sends them straight to the Facebook dialog
 * and brings them back to the screen they started from.
 *
 * `next` must be one of the destinations the OAuth callback allowlists.
 */
export async function startPageConnect(next: "/studio" | "/bot" | "/tiktok-bot" | "/ads/connect"): Promise<string | null> {
  try {
    const r = await fetch(`/api/promo/pages/connect?next=${encodeURIComponent(next)}`);
    const d = await r.json();
    if (d?.url) {
      window.location.href = d.url as string;
      return null;
    }
    return d?.error || "تعذّر بدء الربط";
  } catch {
    return "تعذّر الاتصال بفيسبوك";
  }
}
