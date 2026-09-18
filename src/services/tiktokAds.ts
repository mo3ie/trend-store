// TikTok for Business — ADVERTISER / Marketing API OAuth (v1.3).
//
// ⚠️ THIS IS NOT THE ORGANIC FLOW. Keep the two apart; they differ in every meaningful way.
// Verified against the official documentation on 2026-09-17
// (Marketing API → Authorization, doc 1738373141733378; Authentication, doc 1738373164380162).
//
//                        A) Account Holder (organic)        B) Advertiser (this file)
//   authorize URL        "TikTok account holder             "Advertiser authorization URL"
//                         authorization URL" (portal)        (portal, a DIFFERENT field)
//   token endpoint       /tt_user/oauth2/token/             /oauth2/access_token/
//   credential params    client_id / client_secret          app_id / secret
//   redirect_uri in      required                           NOT sent
//     the exchange
//   auth_code lifetime   10 minutes, single use             1 HOUR, single use
//   token lifetime       access 1 day + refresh 1 year      long-term, DOES NOT EXPIRE,
//                                                            no refresh token exists
//   identity returned    open_id (== business_id)           advertiser_ids: string[]
//   scope format         comma-separated strings            numeric scope IDs
//   revoke               /tt_user/oauth2/revoke/            /oauth2/revoke_token/
//
// Because the advertiser token never expires and has no refresh token, there is deliberately
// no refresh logic here: the only lifecycle events are "granted" and "revoked".
//
// SERVER ONLY — this module reads the app secret.

const DEFAULT_BASE = "https://business-api.tiktok.com/open_api/v1.3";

function cleanEnv(v: string | undefined): string {
  return (v ?? "").replace(/^﻿/, "").trim();
}

/**
 * API base. Overridable ONLY so automated tests can point at a local mock — no test ever
 * calls TikTok. Production leaves it unset and uses the official host.
 */
function apiBase(): string {
  return cleanEnv(process.env.TIKTOK_API_BASE) || DEFAULT_BASE;
}

/**
 * The Marketing API app credentials.
 *
 * The portal calls these "App ID" and "Secret" — the same Basic Information fields the
 * organic flow reads as client_id/client_secret. They fall back to the organic variables so a
 * single developer app can serve both flows, while TIKTOK_ADS_* allows a SEPARATE advertiser
 * app if the portal ends up requiring one.
 */
export function adsAppId(): string {
  return cleanEnv(process.env.TIKTOK_ADS_APP_ID) || cleanEnv(process.env.TIKTOK_CLIENT_ID);
}
export function adsAppSecret(): string {
  return cleanEnv(process.env.TIKTOK_ADS_APP_SECRET) || cleanEnv(process.env.TIKTOK_CLIENT_SECRET);
}

/**
 * The portal-issued **Advertiser authorization URL**
 * (My Apps → App Detail → Basic Information → Advertiser authorization URL).
 * It is not constructed by us: it already embeds the app id and the redirect URL, and we only
 * append our opaque `state`.
 */
export function adsAuthorizeBaseUrl(): string {
  return cleanEnv(process.env.TIKTOK_ADS_AUTH_URL);
}

export function adsConfigured(): boolean {
  return !!adsAppId() && !!adsAppSecret() && !!adsAuthorizeBaseUrl();
}

/** Appends only the opaque state to the portal-issued URL. No secret ever goes in a URL. */
export function buildAdvertiserAuthorizeUrl(state: string): string {
  const base = adsAuthorizeBaseUrl();
  if (!base) throw new TikTokAdsError("not_configured", "TIKTOK_ADS_AUTH_URL is not set");
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}state=${encodeURIComponent(state)}`;
}

// ── Errors ────────────────────────────────────────────────────────────────────

/**
 * Carries only what is safe to log: endpoint, HTTP status, TikTok code, request id.
 *
 * Fields are declared and assigned explicitly rather than via constructor parameter
 * properties, so this module stays plain-erasable TypeScript and the unit tests can import it
 * directly (Node's type stripping rejects parameter properties).
 */
export class TikTokAdsError extends Error {
  readonly kind: string;
  readonly endpoint?: string;
  readonly httpStatus?: number;
  readonly ttCode?: number;
  readonly requestId?: string;

  constructor(
    kind: string,
    message: string,
    endpoint?: string,
    httpStatus?: number,
    ttCode?: number,
    requestId?: string,
  ) {
    super(message);
    this.name = "TikTokAdsError";
    this.kind = kind;
    this.endpoint = endpoint;
    this.httpStatus = httpStatus;
    this.ttCode = ttCode;
    this.requestId = requestId;
  }

  toLogLine(userId?: string): string {
    return [
      `tiktok_ads_error kind=${this.kind}`,
      this.endpoint ? `endpoint=${this.endpoint}` : "",
      this.httpStatus ? `http=${this.httpStatus}` : "",
      this.ttCode !== undefined ? `tt_code=${this.ttCode}` : "",
      this.requestId ? `request_id=${this.requestId}` : "",
      userId ? `user=${userId}` : "",
    ].filter(Boolean).join(" ");
  }
}

interface Envelope<T> { code: number; message?: string; request_id?: string; data?: T; }

async function post<T>(path: string, body: Record<string, unknown>, accessToken?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers["Access-Token"] = accessToken;

  let res: Response;
  try {
    res = await fetch(`${apiBase()}/${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new TikTokAdsError("network_error", "TikTok request failed", path);
  }

  let json: Envelope<T>;
  try {
    json = (await res.json()) as Envelope<T>;
  } catch {
    throw new TikTokAdsError("bad_response", "TikTok returned a non-JSON response", path, res.status);
  }

  // TikTok signals failure with a non-zero `code` inside an HTTP 200 body.
  if (json.code !== 0) {
    throw new TikTokAdsError(
      "api_error",
      json.message || `TikTok API error (code ${json.code})`,
      path, res.status, json.code, json.request_id,
    );
  }
  return (json.data ?? ({} as T));
}

// ── Token exchange ────────────────────────────────────────────────────────────

export interface AdvertiserGrant {
  /** Long-term token. Does not expire; becomes invalid only if the advertiser revokes. */
  accessToken: string;
  /** Ad accounts this token can access. Strings in v1.3 (numbers in the retired v1.2). */
  advertiserIds: string[];
  /** Numeric permission scope IDs (NOT the dotted strings the organic flow returns). */
  scope: number[];
}

/**
 * POST /oauth2/access_token/ — exchange the advertiser auth_code for a long-term token.
 *
 * Note the parameter names: `app_id` / `secret` / `auth_code`, and NO redirect_uri — the
 * advertiser exchange does not take one, unlike the organic account exchange.
 */
export async function exchangeAdvertiserAuthCode(authCode: string): Promise<AdvertiserGrant> {
  const data = await post<{ access_token?: string; advertiser_ids?: string[]; scope?: number[] }>(
    "oauth2/access_token/",
    { app_id: adsAppId(), secret: adsAppSecret(), auth_code: authCode },
  );

  if (!data.access_token) {
    throw new TikTokAdsError("no_access_token", "token response carried no access_token", "oauth2/access_token/");
  }

  return {
    accessToken: data.access_token,
    advertiserIds: (data.advertiser_ids ?? []).map(String),
    scope: (data.scope ?? []).map(Number),
  };
}

/**
 * POST /oauth2/revoke_token/ — invalidate a long-term advertiser token.
 * Sends the token both as the Access-Token header and in the body, as documented.
 */
export async function revokeAdvertiserToken(accessToken: string): Promise<void> {
  await post<Record<string, never>>(
    "oauth2/revoke_token/",
    { app_id: adsAppId(), secret: adsAppSecret(), access_token: accessToken },
    accessToken,
  );
}
