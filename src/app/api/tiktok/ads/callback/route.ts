import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/authUser";
import { exchangeAdvertiserAuthCode, adsConfigured, TikTokAdsError } from "@/services/tiktokAds";
import { storeAdvertiserGrant } from "@/lib/tiktokAdsTokens";
import { consumeOAuthState, stateCookieOptions, OAUTH_STATE_COOKIE, type ConsumeFailure } from "@/lib/oauthState";
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

function fail(code: string): NextResponse {
  const res = NextResponse.redirect(siteUrl(`/tiktok?ads_error=${code}`));
  res.cookies.set(OAUTH_STATE_COOKIE, "", stateCookieOptions(0));
  return res;
}

function codeFor(reason: ConsumeFailure): string {
  switch (reason) {
    case "not_signed_in": return "not_signed_in";
    case "expired_state": return "expired";
    default: return "invalid_state";   // covers flow_mismatch, reuse, binding mismatch, forgery
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
  const binding = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  const consumed = await consumeOAuthState({
    state,
    binding,
    sessionUserId: user?.id ?? null,
    expectedFlows: ["advertiser_connect", "advertiser_reconnect"],
  });
  if (!consumed.ok) return fail(codeFor(consumed.reason));

  const userId = consumed.userId;
  const returnPath = consumed.redirectPath ?? "/tiktok";

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
    res.cookies.set(OAUTH_STATE_COOKIE, "", stateCookieOptions(0));
    return res;
  } catch (err) {
    // Safe server-side log only: endpoint, HTTP status, TikTok code, request id.
    if (err instanceof TikTokAdsError) console.error(err.toLogLine(userId));
    else console.error("tiktok_ads_callback_failed kind=internal");
    return fail("exchange_failed");
  }
}
