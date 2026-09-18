import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/authUser";
import { buildTikTokAuthorizeUrl, tiktokConfigured } from "@/services/tiktok";
import { createOAuthState, stateCookieOptions, OAUTH_STATE_COOKIE, OAUTH_STATE_TTL_SEC } from "@/lib/oauthState";
import { checkRateLimit, rateLimitedJson, identifierFor, RATE_RULES, checkAppRateLimit } from "@/lib/rateLimit";

/**
 * GET — starts the TikTok Accounts API authorization flow.
 *
 * The authorization URL is ISSUED BY THE DEVELOPER PORTAL (My Apps > App Detail > Basic
 * Information > TikTok account holder authorization URL) and supplied through TIKTOK_AUTH_URL.
 * We do not construct it, there is no client_key, and scopes are not a request parameter —
 * they come from the app's permission set and are returned in the token response.
 *
 * The Phase 1 state security model is unchanged: 32 random bytes, only the hash stored,
 * HttpOnly+Secure+SameSite=Lax cookie binding, 10-minute TTL, single-use atomic consume,
 * bound to the authenticated Supabase user.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const limit = await checkRateLimit(RATE_RULES.tiktokOauthStart, identifierFor(req, user.id));
  if (!limit.allowed) return rateLimitedJson(limit);

  const appLimit = await checkAppRateLimit("tiktok_oauth_start");
  if (!appLimit.allowed) return rateLimitedJson(appLimit);

  if (!tiktokConfigured()) {
    return NextResponse.json(
      { error: "tiktok_not_configured", message: "ربط تيك توك غير مفعّل بعد" },
      { status: 503 },
    );
  }

  let created;
  try {
    created = await createOAuthState({ userId: user.id, redirectPath: "/tiktok-bot", flow: "connect" });
  } catch {
    return NextResponse.json({ error: "oauth_state_failed", message: "تعذّر بدء الربط" }, { status: 500 });
  }

  // Only the opaque state is appended. The URL itself is never logged (it identifies the app).
  const res = NextResponse.json({ url: buildTikTokAuthorizeUrl(created.state) });
  res.cookies.set(OAUTH_STATE_COOKIE, created.binding, stateCookieOptions(OAUTH_STATE_TTL_SEC));
  return res;
}
