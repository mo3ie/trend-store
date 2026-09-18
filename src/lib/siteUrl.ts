/**
 * Canonical public origin of the storefront.
 *
 * Verified 2026-09-16: https://trendstore-ly.com/* returns 308 → https://www.trendstore-ly.com/*,
 * so **www is canonical**. NEXT_PUBLIC_BASE_URL is currently EMPTY in Vercel production,
 * which means every `process.env.NEXT_PUBLIC_BASE_URL || "https://trendstore-ly.com"`
 * fallback in the codebase resolves to the NON-canonical apex.
 *
 * OAuth providers match redirect_uri exactly, so the TikTok flow must not be built on the
 * apex. This helper is intentionally scoped to the TikTok routes for now — the Meta/ads and
 * payment routes keep their existing fallback untouched, because changing a live redirect
 * URI would require re-registering it with those providers first.
 */

const CANONICAL_ORIGIN = "https://www.trendstore-ly.com";

function normalize(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

/** Canonical origin, overridable by NEXT_PUBLIC_BASE_URL when it is actually set. */
export function siteOrigin(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_BASE_URL || "").trim();
  return fromEnv ? normalize(fromEnv) : CANONICAL_ORIGIN;
}

/** Absolute URL for an in-app path, e.g. siteUrl("/tiktok-bot"). */
export function siteUrl(path: string): string {
  return `${siteOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * The redirect URI registered in the TikTok developer portal.
 *
 * TikTok's redirect-URL rules (verified): absolute, https, **ends with `/`**, no query
 * parameters, no fragment, no port, 10–512 chars. The trailing slash is therefore part of
 * the registered value and must be sent byte-identically as `redirect_uri` in the token
 * exchange. next.config.ts serves this exact path directly, with no redirect hop.
 */
export const TIKTOK_REDIRECT_PATH = "/api/tiktok/callback/";

export function tiktokRedirectUri(): string {
  return siteUrl(TIKTOK_REDIRECT_PATH);
}

/**
 * The ADVERTISER redirect URL registered in the portal (My Apps → Basic Information →
 * Advertiser redirect URL). Deliberately distinct from the organic callback: TikTok allows up
 * to 10 advertiser redirect URLs, and the two flows must stay isolated.
 */
export const TIKTOK_ADS_REDIRECT_PATH = "/api/tiktok/ads/callback/";

export function tiktokAdsRedirectUri(): string {
  return siteUrl(TIKTOK_ADS_REDIRECT_PATH);
}

/** The app-level webhook callback registered via /business/webhook/update/. Same URL rules. */
export const TIKTOK_WEBHOOK_PATH = "/api/tiktok/webhook/";

export function tiktokWebhookUrl(): string {
  return siteUrl(TIKTOK_WEBHOOK_PATH);
}
