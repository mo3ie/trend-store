import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/authUser";
import { exchangeAdvertiserAuthCode, adsConfigured, TikTokAdsError } from "@/services/tiktokAds";
import { storeAdvertiserGrant } from "@/lib/tiktokAdsTokens";
import { consumeOAuthState, stateCookieOptions, ADS_OAUTH_STATE_COOKIE, recordOAuthFailure, type ConsumeFailure } from "@/lib/oauthState";
import { checkRateLimit, rateLimitedJson, identifierFor, RATE_RULES } from "@/lib/rateLimit";
import { siteUrl } from "@/lib/siteUrl";

/**
 * GET /api/tiktok/ads/callback/ — the ADVERTISER (Marketing API) OAuth callback.
 *
 * Registered in the developer portal as the Advertiser redirect URL:
 *   https://www.trendstore-ly.com/api/tiktok/ads/callback/
 * The trailing slash is part of the registered value and is served directly (next.config.ts),
 * so TikTok's redirect lands here without a redirect hop.
 *
 * ⚠️ Separate from the organic account callback at /api/tiktok/callback/, which is untouched.
 * TikTok appends `auth_code`, `code`, `state` and `id` to this URL; the advertiser `auth_code`
 * is valid for ONE HOUR and can be used only once.
 *
 * Order: rate limit → session → single-use state (bound to cookie, user AND advertiser flow)
 * → only then exchange the code → encrypt and store.
 *
 * Nothing here logs the auth_code, the state, the binding or any token, and no upstream error
 * text is reflected into the URL.
 */

/**
 * `tt` carries TikTok's own numeric error code when there is one.
 *
 * The rule in this file is that no upstream TEXT is reflected into the URL, and
 * it stands — error text can carry request values. A numeric code carries
 * nothing but the cause, and it is the single most useful fact there is: 40001
 * means the app secret is wrong, 40002 that the auth code is spent or invalid.
 *
 * Without it the operator saw "تعذّر إكمال الربط. أعد المحاولة." four times and
 * had no way to know whether to re-press the button or fix an environment
 * variable, and I had to read production tables to guess.
 */
function fail(code: string, tt?: number | null): NextResponse {
  const q = tt ? `&tt=${encodeURIComponent(String(tt))}` : "";
  const res = NextResponse.redirect(siteUrl(`/tiktok-ads?ads_error=${code}${q}`));
  res.cookies.set(ADS_OAUTH_STATE_COOKIE, "", stateCookieOptions(0));
  return res;
}

/**
 * One code per cause. It used to collapse four different failures into
 * `invalid_state`, and that cost a whole diagnosis round: the operator
 * authorized successfully at TikTok, landed back on `?ads_error=invalid_state`,
 * and nothing — not the URL, not the logs — could say which of the four it was.
 * The state rows had to be read out of the database to narrow it down.
 *
 * These strings reach the browser, so each one names a cause and nothing else:
 * no state, no binding, no user id.
 */
function codeFor(reason: ConsumeFailure): string {
  switch (reason) {
    case "not_signed_in":        return "not_signed_in";
    case "expired_state":        return "expired";
    case "missing_binding":      return "no_cookie";
    case "binding_mismatch":     return "cookie_mismatch";
    case "user_mismatch":        return "wrong_account";
    case "flow_mismatch":        return "wrong_flow";
    case "unknown_or_used_state":return "already_used";
    default:                     return "invalid_state";
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  // The advertiser redirect carries `auth_code` (and a `code` alias); prefer the documented one.
  const authCode = searchParams.get("auth_code") || searchParams.get("code");
  const state = searchParams.get("state");

  // TikTok may report a failure on the redirect instead of an auth code.
  const upstreamError = searchParams.get("error") || searchParams.get("error_description");

  const limit = await checkRateLimit(RATE_RULES.tiktokOauthCallback, identifierFor(req, null));
  if (!limit.allowed) return rateLimitedJson(limit);

  if (upstreamError) {
    // Logged as a fixed marker; the upstream text is never echoed to the browser.
    console.error("tiktok_ads_callback_upstream_error");
    return fail("declined");
  }
  if (!authCode || !state) return fail("cancelled");
  if (!adsConfigured()) return fail("not_configured");

  // 1) Who is actually signed in on THIS browser (server-side Supabase session).
  //    The `id` query parameter TikTok appends is NOT used as proof of identity.
  const user = await getAuthUser();

  // 2) Single-use state, bound to the cookie, to that session user, and to the ADVERTISER flow.
  const binding = req.cookies.get(ADS_OAUTH_STATE_COOKIE)?.value;
  const consumed = await consumeOAuthState({
    state,
    binding,
    sessionUserId: user?.id ?? null,
    expectedFlows: ["advertiser_connect", "advertiser_reconnect"],
  });
  if (!consumed.ok) {
    await recordOAuthFailure(state, "state", consumed.reason);
    return fail(codeFor(consumed.reason));
  }

  const userId = consumed.userId;
  const returnPath = consumed.redirectPath ?? "/tiktok-ads";

  try {
    // 3) Only now is it safe to exchange. Note the advertiser exchange takes app_id/secret and
    //    NO redirect_uri — see src/services/tiktokAds.ts for the full contrast with organic.
    const grant = await exchangeAdvertiserAuthCode(authCode);

    // 4) Encrypted at rest; the token never leaves the server.
    await storeAdvertiserGrant({
      userId,
      accessToken: grant.accessToken,
      advertiserIds: grant.advertiserIds,
      scope: grant.scope,
    });

    const res = NextResponse.redirect(siteUrl(`${returnPath}?ads_connected=1`));
    res.cookies.set(ADS_OAUTH_STATE_COOKIE, "", stateCookieOptions(0));
    return res;
  } catch (err) {
    // Safe server-side log only: endpoint, HTTP status, TikTok code, request id.
    if (err instanceof TikTokAdsError) {
      console.error(err.toLogLine(userId));
      await recordOAuthFailure(state, "exchange", err.ttCode ?? err.kind);
      return fail("exchange_failed", err.ttCode ?? null);
    }
    console.error("tiktok_ads_callback_failed kind=internal");
    // The store step raises plain errors; naming it separately is the difference
    // between "TikTok refused us" and "we could not save what TikTok gave us".
    await recordOAuthFailure(state, "store", err instanceof Error ? err.message.slice(0, 40) : "internal");
    return fail("exchange_failed");
  }
}
