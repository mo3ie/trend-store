import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/authUser";
import { buildAdvertiserAuthorizeUrl, adsConfigured } from "@/services/tiktokAds";
import { createOAuthState, stateCookieOptions, OAUTH_STATE_COOKIE, OAUTH_STATE_TTL_SEC } from "@/lib/oauthState";
import { checkRateLimit, rateLimitedJson, identifierFor, RATE_RULES } from "@/lib/rateLimit";

/**
 * GET /api/tiktok/ads/connect — starts the ADVERTISER (Marketing API) authorization.
 *
 * This is NOT the organic account flow (/api/tiktok/connect). The URL here is the portal's
 * **Advertiser authorization URL**, a different field from the account-holder URL, and the
 * callback is /api/tiktok/ads/callback/.
 *
 * Security is the same hardened state machinery the organic flow uses, with a distinct flow
 * value so the two can never be crossed:
 *   * 32 cryptographically random bytes, stored only as sha256
 *   * HttpOnly + Secure + SameSite=Lax cookie binding this browser
 *   * 10-minute TTL, single-use atomic consume
 *   * bound to the authenticated Supabase user
 *
 * No client secret, and no internal user id, ever appears in the URL.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const limit = await checkRateLimit(RATE_RULES.tiktokOauthStart, identifierFor(req, user.id));
  if (!limit.allowed) return rateLimitedJson(limit);

  if (!adsConfigured()) {
    return NextResponse.json(
      { error: "tiktok_ads_not_configured", message: "ربط حساب الإعلانات غير مفعّل بعد" },
      { status: 503 },
    );
  }

  let created;
  try {
    created = await createOAuthState({
      userId: user.id,
      redirectPath: "/tiktok",
      flow: "advertiser_connect",
    });
  } catch {
    // Never echo the underlying error — it can contain row values.
    return NextResponse.json({ error: "oauth_state_failed", message: "تعذّر بدء الربط" }, { status: 500 });
  }

  const res = NextResponse.json({ url: buildAdvertiserAuthorizeUrl(created.state) });
  res.cookies.set(OAUTH_STATE_COOKIE, created.binding, stateCookieOptions(OAUTH_STATE_TTL_SEC));
  return res;
}
