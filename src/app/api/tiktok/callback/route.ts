import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import {
  exchangeAuthCode, getProfile, businessIdFromOpenId, TikTokError, tiktokConfigured,
} from "@/services/tiktok";
import { upsertTikTokAccount, storeTikTokTokens } from "@/lib/tiktokTokens";
import { consumeOAuthState, stateCookieOptions, OAUTH_STATE_COOKIE, type ConsumeFailure } from "@/lib/oauthState";
import { checkRateLimit, rateLimitedJson, identifierFor, RATE_RULES } from "@/lib/rateLimit";
import { siteUrl, tiktokRedirectUri } from "@/lib/siteUrl";

/**
 * GET — TikTok OAuth callback. Registered in the developer portal as
 *   https://www.trendstore-ly.com/api/tiktok/callback/
 * (TikTok requires a trailing slash, no query, no port). next.config.ts serves that exact
 * URL directly via skipTrailingSlashRedirect + a beforeFiles rewrite, so no redirect hop
 * happens between TikTok and this handler.
 *
 * Security (Phase 1, unchanged): the session user is resolved server-side, the state must
 * match an unconsumed/unexpired row AND the HttpOnly binding cookie AND that session user,
 * and only then is the single-use auth_code (10-minute lifetime) exchanged.
 *
 * Nothing here logs the auth code, the state, the binding or any token.
 */

function fail(code: string): NextResponse {
  const res = NextResponse.redirect(siteUrl(`/tiktok-bot?error=${code}`));
  res.cookies.set(OAUTH_STATE_COOKIE, "", stateCookieOptions(0));
  return res;
}

function codeFor(reason: ConsumeFailure): string {
  switch (reason) {
    case "not_signed_in": return "not_signed_in";
    case "expired_state": return "expired";
    default: return "invalid_state";
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("auth_code") || searchParams.get("code");
  const state = searchParams.get("state");

  const limit = await checkRateLimit(RATE_RULES.tiktokOauthCallback, identifierFor(req, null));
  if (!limit.allowed) return rateLimitedJson(limit);

  if (!code || !state) return fail("cancelled");
  if (!tiktokConfigured()) return fail("not_configured");

  // 1) Who is signed in on THIS browser (server-side Supabase session).
  const user = await getAuthUser();

  // 2) Single-use state, bound to the cookie and to that session user.
  const binding = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  const consumed = await consumeOAuthState({
    state, binding, sessionUserId: user?.id ?? null,
    // Organic only: an advertiser state must never be accepted here.
    expectedFlows: ["connect", "reconnect", "scope_upgrade"],
  });
  if (!consumed.ok) return fail(codeFor(consumed.reason));

  const userId = consumed.userId;
  const returnPath = consumed.redirectPath ?? "/tiktok-bot";

  try {
    // 3) Exchange the code. redirect_uri must be byte-identical to the registered URL.
    const tokens = await exchangeAuthCode(code, tiktokRedirectUri());
    const businessId = businessIdFromOpenId(tokens.openId);
    if (!businessId) throw new TikTokError("no_open_id", "token response had no open_id");

    // 4) Profile is best-effort: a missing display name must not fail a valid connection.
    const profile = await getProfile(tokens.accessToken, businessId).catch((err) => {
      if (err instanceof TikTokError) console.error(err.toLogLine());
      return null;
    });

    // 5) Account metadata (browser-readable) and credentials (service-role only) are stored
    //    in separate tables; nothing goes to bot_page_tokens.
    const accountId = await upsertTikTokAccount({
      userId,
      openId: tokens.openId,
      username: profile?.username ?? null,
      displayName: profile?.displayName ?? null,
      avatarUrl: profile?.profileImage ?? null,
      scope: tokens.scope,
    });

    await storeTikTokTokens({
      accountId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
      refreshExpiresAt: tokens.refreshExpiresIn
        ? new Date(Date.now() + tokens.refreshExpiresIn * 1000)
        : null,
    });

    // 6) The bot's rules/log/subscription stay in the existing engine's tables, keyed by the
    //    same identifier. One rule engine, one set of rules — no second bot.
    await supabaseAdmin.from("bot_configs").upsert(
      {
        user_id: userId,
        page_id: businessId,
        page_name: profile?.displayName || profile?.username || "TikTok",
        page_picture: profile?.profileImage ?? null,
        platform: "tiktok",
        tiktok_account_id: accountId,
      },
      { onConflict: "user_id,page_id,platform" },
    );

    const res = NextResponse.redirect(siteUrl(`${returnPath}?success=1`));
    res.cookies.set(OAUTH_STATE_COOKIE, "", stateCookieOptions(0));
    return res;
  } catch (err) {
    // Safe server-side log (endpoint, status, TikTok code, request_id) — never the upstream
    // message to the browser, never the code or any token.
    if (err instanceof TikTokError) console.error(err.toLogLine());
    else console.error("tiktok_callback_failed kind=internal");
    return fail("oauth_failed");
  }
}
