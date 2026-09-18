# TikTok Advertiser (Marketing API) OAuth — Implementation Report

**Project:** Trend Store (Next.js 16 · TypeScript · Supabase · Vercel)
**Date:** 2026-09-17
**Scope:** advertiser OAuth callback preparation ONLY. No ads creation, no reporting, no
audiences, no messaging, no AI.
**Status:** implemented, migration applied, **131/131 tests pass**, production build green.
**No TikTok API call has been made** — the token exchange is exercised against a local mock.

---

## 0. Verification before coding

The advertiser flow was verified against the current official documentation
(Marketing API → *Authorization*, doc `1738373141733378`; *Authentication*, doc
`1738373164380162`) before any code was written. **It is materially different from the organic
account flow** — assuming they were the same would have produced a broken integration:

| | **A) Account Holder (organic)** | **B) Advertiser (this task)** |
|---|---|---|
| Authorization URL | "TikTok account holder authorization URL" (portal) | **"Advertiser authorization URL"** (portal, a *different* field) |
| Token endpoint | `/tt_user/oauth2/token/` | **`/oauth2/access_token/`** |
| Credential params | `client_id` / `client_secret` | **`app_id` / `secret`** |
| `redirect_uri` in exchange | required | **not sent at all** |
| `auth_code` lifetime | 10 minutes, single use | **1 hour**, single use |
| Token lifetime | access 1 day + refresh 1 year | **long-term, never expires, no refresh token** |
| Identity returned | `open_id` (= `business_id`) | **`advertiser_ids: string[]`** |
| Scope format | comma-separated strings | **numeric scope IDs** |
| Revoke | `/tt_user/oauth2/revoke/` | **`/oauth2/revoke_token/`** |
| Callback params | `auth_code`, `state` | `auth_code`, `code`, `state`, **`id`** |

No conflict with the existing architecture was found, so implementation proceeded. One design
note is recorded in §4 (shared vs separate app credentials).

---

## 1. Files created

| File | Purpose |
|---|---|
| `src/services/tiktokAds.ts` | Advertiser service: portal-URL builder, `/oauth2/access_token/` exchange, `/oauth2/revoke_token/`, typed error. Contains the A-vs-B contrast table at the top |
| `src/lib/tiktokAdsTokens.ts` | Encrypted advertiser credential store, active-grant read, disconnect-with-revoke |
| `src/app/api/tiktok/ads/connect/route.ts` | Authenticated OAuth start |
| `src/app/api/tiktok/ads/callback/route.ts` | **The advertiser callback** |
| `supabase/tiktok-ads-oauth.sql` | Additive migration (applied — see §3) |
| `tests/tiktok/ads.test.mjs` | 25 tests incl. a mocked TikTok API |

## 2. Files modified (all additive; organic behaviour preserved)

| File | Change |
|---|---|
| `src/lib/oauthState.ts` | Added the `OAuthFlow` type with `advertiser_connect` / `advertiser_reconnect`, and an optional `expectedFlows` check returning `flow_mismatch`. Existing behaviour is unchanged when the option is omitted |
| `src/app/api/tiktok/callback/route.ts` | **6 lines**: declares `expectedFlows: ["connect","reconnect","scope_upgrade"]` so an advertiser state can never be replayed against the organic callback |
| `src/lib/siteUrl.ts` | Added `TIKTOK_ADS_REDIRECT_PATH` + `tiktokAdsRedirectUri()` |
| `next.config.ts` | **1 line**: rewrite so `/api/tiktok/ads/callback/` is served on its exact trailing-slash URL |

Verified by diffing against the pre-task snapshot: `tiktok.ts`, `tiktokWebhook.ts`,
`tiktokEngine.ts`, `tiktokEvents.ts`, `tiktokTokens.ts`, `tokenCrypto.ts`, and the organic
`connect`, `webhook`, `cron/poll` and `configs` routes are **byte-identical**.

## 3. Database migration — created **and applied**

`supabase/tiktok-ads-oauth.sql`, applied to the production project and verified:

| Table | RLS | Policies | Notes |
|---|---|---|---|
| `tiktok_ads_authorizations` | ✅ on | **0** | Credentials. Service-role only |
| `tiktok_ad_accounts` | ✅ on | 2 (owner + admin, **SELECT only**) | Metadata only, no credentials |

```
flow check now: CHECK (flow = ANY (ARRAY['connect','reconnect','scope_upgrade',
                                          'advertiser_connect','advertiser_reconnect']))
organic data after migration: tiktok_accounts 0 · tiktok_tokens 0 · bot_configs(meta) 7 · bot_reply_log 2
new tables after migration:   tiktok_ads_authorizations 0 · tiktok_ad_accounts 0
```

**A separate credential table was required.** Reusing `tiktok_tokens` would have been wrong: it
models a 1-day access token + 1-year refresh token for one `open_id`, whereas an advertiser
grant is a single non-expiring token covering many `advertiser_ids`. The advertiser schema
therefore has **no refresh columns at all**, and a partial unique index keeps one active grant
per user.

## 4. Environment variables (server-only)

| Variable | Purpose |
|---|---|
| `TIKTOK_ADS_AUTH_URL` | **Required.** The portal-issued *Advertiser authorization URL*. It cannot be constructed by us |
| `TIKTOK_ADS_APP_ID` | Optional — falls back to `TIKTOK_CLIENT_ID` |
| `TIKTOK_ADS_APP_SECRET` | Optional — falls back to `TIKTOK_CLIENT_SECRET` |
| `TIKTOK_API_BASE` | **Test only.** Points the service at a local mock; unset in production |

The portal exposes one **App ID / Secret** pair per developer app, and the organic flow reads
the same pair under the names `client_id` / `client_secret`. The `TIKTOK_ADS_*` variables
therefore default to the organic ones (one app serving both flows) while allowing a **separate
advertiser app** if the portal requires one — the decision can be made at configuration time
without a code change. No secret is exposed through `NEXT_PUBLIC_*`.

## 5. Exact URLs and endpoints

| Item | Value |
|---|---|
| Advertiser authorization URL | Portal-issued (`My Apps → App Detail → Basic Information → Advertiser authorization URL`); we append **only** `&state=<opaque>` |
| **Token endpoint** | `POST https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/` — body `{app_id, secret, auth_code}`, `Content-Type: application/json` |
| Revoke endpoint | `POST https://business-api.tiktok.com/open_api/v1.3/oauth2/revoke_token/` |
| **Advertiser callback** | `https://www.trendstore-ly.com/api/tiktok/ads/callback/` |
| Organic callback (unchanged) | `https://www.trendstore-ly.com/api/tiktok/callback/` |

## 6. How state security works

The advertiser flow reuses the hardened state machinery, with an added isolation dimension:

1. **32 cryptographically random bytes** (`randomToken(32)`), base64url. Only `sha256(state)` is
   stored — a dump of the table cannot be replayed.
2. **Short-lived:** 10-minute TTL, enforced in code and by a DB CHECK.
3. **Single-use:** consumption is one atomic `UPDATE … WHERE consumed_at IS NULL`; a second
   attempt claims zero rows.
4. **Browser-bound:** an HttpOnly + Secure + SameSite=Lax cookie must return with the callback
   and match `sha256(binding)`, compared in constant time.
5. **Session-bound:** the user comes from the **Supabase server-side session**. The `id` query
   parameter TikTok appends is never treated as identity.
6. **Flow-bound (new):** the state records its flow, and each callback declares which flows it
   accepts — so an organic state cannot be used on the advertiser callback, or vice versa.

Rejections: missing state, unknown/reused state, expired state, binding mismatch, user
mismatch, flow mismatch, and missing `auth_code` — each mapped to a fixed error code
(`invalid_state`, `expired`, `not_signed_in`, `cancelled`, `declined`, `exchange_failed`).
**No upstream TikTok text is ever placed in the URL**, and the code is exchanged only after
every check passes.

## 7. How credentials are stored

- AES-256-GCM via the project's existing `tokenCrypto` (key from server-only
  `TOKEN_ENCRYPTION_KEY`); the store **throws** rather than writing plaintext if the key is absent.
- Written to `tiktok_ads_authorizations` — RLS on, **zero policies** → unreadable by the browser
  even with a valid session; only the service-role key reaches it.
- The UI-facing read (`getActiveGrant`) never selects the token column; the callback returns a
  redirect, never a body containing credentials.
- Disconnect revokes at TikTok first, then destroys the local credential **regardless** of the
  remote result.

## 8. Tests — 131/131 pass

| Suite | Tests | Result |
|---|---|---|
| **`tests/tiktok/ads.test.mjs`** (new) | **25** | ✅ |
| `tests/tiktok/lossless.test.mjs` | 21 | ✅ |
| `tests/tiktok/ack.test.mjs` | 7 | ✅ |
| `tests/tiktok/static.test.mjs` | 41 | ✅ |
| `tests/tiktok/db.test.mjs` | 15 | ✅ |
| `tests/tiktok/live.test.mjs` | 22 | ✅ |

Your 15 items:

| # | Requirement | Result |
|---|---|---|
| 1 | Unauthenticated access rejected | ✅ live — `/api/tiktok/ads/connect` → 401 |
| 2 | OAuth start generates state | ✅ state row + binding cookie |
| 3 | State is random | ✅ 32 random bytes, stored only as sha256 |
| 4 | State expires | ✅ proven against the live DB (10-min TTL + CHECK) |
| 5 | State cannot be reused | ✅ atomic claim: 1st wins, 2nd gets zero rows |
| 6 | State bound to the initiating session | ✅ cookie + Supabase session + flow |
| 7 | Missing `auth_code` rejected | ✅ live → `ads_error=cancelled` |
| 8 | TikTok error callback handled safely | ✅ live → `ads_error=declined`, upstream text **not** leaked |
| 9 | Token-exchange failure handled safely | ✅ mocked `code: 40002` → typed error, no credential in the log line |
| 10 | Successful callback stores encrypted credentials | ✅ mocked exchange asserts the exact request body; a real DB round-trip proves ciphertext ≠ plaintext and decrypts back |
| 11 | Credentials never in a JSON response | ✅ `getActiveGrant` excludes the column; anon read returns 0 rows |
| 12 | Credentials never in logs | ✅ asserted across service, store and both routes |
| 13 | Organic callback unchanged | ✅ byte-identical services + live organic callback still answers with its own error codes |
| 14 | Advertiser callback isolated | ✅ separate route, table, endpoint, and flow-mismatch rejection |
| 15 | Production build passes | ✅ see §9 |

The TikTok API is **mocked** by a local `node:http` server selected through `TIKTOK_API_BASE`;
the mock asserts that the request body is exactly `{app_id, secret, auth_code}` — with **no**
`redirect_uri` and **no** `client_id`.

## 9. Production build

`✓ Compiled successfully in 22.8s`. Both advertiser routes registered alongside the organic
ones (`/api/tiktok/ads/callback`, `/api/tiktok/ads/connect`). `tsc` clean except one
pre-existing unrelated error (`src/app/bot/page.tsx:98`); ESLint clean; no advertiser secret or
endpoint appears in the client bundle.

## 10. Remaining manual TikTok Developer Portal steps

1. In **My Apps → App Detail → Basic Information**, add the **Advertiser redirect URL**:
   `https://www.trendstore-ly.com/api/tiktok/ads/callback/`
   (up to 10 advertiser redirect URLs are allowed, so this can coexist with any other).
2. Copy the regenerated **Advertiser authorization URL** → `TIKTOK_ADS_AUTH_URL` in Vercel
   production.
3. Decide whether the advertiser flow uses the same developer app as the organic one. If a
   separate app is created, set `TIKTOK_ADS_APP_ID` / `TIKTOK_ADS_APP_SECRET`; otherwise leave
   them unset and the organic credentials are used.
4. Select the Marketing API permission scopes the app needs (advertiser management scopes are
   separate from the TikTok Accounts scopes used by the organic bot).
5. Set `TOKEN_ENCRYPTION_KEY` in production if not already set — the advertiser store refuses to
   save a credential without it.
6. The advertiser completes an email verification during authorization (valid 48 hours for
   repeat authorizations to the same app) — expect that step in the flow.

---

## Status

**IMPLEMENTED** — advertiser OAuth start + callback, official token exchange, encrypted
separate storage, revoke-on-disconnect, flow isolation, migration applied, 25 new tests.

**NOT IMPLEMENTED (by instruction)** — campaigns, ad groups, ads, reporting, audiences, ad
comments, messaging, TikTok Shop, AI.

**REQUIRES PORTAL CONFIGURATION** — advertiser redirect URL, advertiser authorization URL, scopes.

**REQUIRES REAL CREDENTIALS** — every outbound advertiser call. No TikTok API call has been made,
and no advertiser connection has been demonstrated against production.
