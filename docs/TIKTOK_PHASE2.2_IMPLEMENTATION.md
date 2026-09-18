# TikTok Organic Accounts API — Phase 2.2 Implementation Report

**Project:** Trend Store (Next.js 16 · Supabase · Vercel) — https://www.trendstore-ly.com
**Date:** 2026-09-16
**Scope:** TikTok API for Business **v1.3 Organic Accounts API** only.
**Status:** code complete, 50/50 tests pass, production build green.
**Not connected to TikTok:** no developer app, no credentials, and **no TikTok API call has ever
been made**. Nothing in this document claims a working production connection.

---

## 0. Scope boundaries honoured

Implemented: OAuth start/callback, token lifecycle, profile, videos, all seven organic comment
endpoints, the `comment.update` webhook, app-level webhook subscription, rate limiting, UI.

Deliberately **not** implemented: Business Messaging, DMs, Comment-to-Message, AI features.
Untouched: Meta/Facebook integration, wallet/payment logic, storefront, authentication.

Spec source: `docs/TIKTOK_PHASE2.1_API_SPEC.md` (field-level, verified from the official
documentation portal).

---

## A. Files changed

### New (9)

| File | Purpose |
|---|---|
| `src/services/tiktokWebhook.ts` | Signature verification (HMAC-SHA256 over raw body) + envelope/nested-content parsing + id normalisation |
| `src/app/api/tiktok/webhook/route.ts` | `comment.update` receiver: raw body → verify → parse → fast 200 |
| `src/app/api/tiktok/admin/webhook/route.ts` | Admin-gated management of the **app-level** webhook configuration |
| `src/lib/tokenCrypto.ts` | AES-256-GCM envelope encryption, `randomToken`, `sha256`, constant-time compare, `redact` |
| `src/lib/oauthState.ts` | CSRF-safe OAuth state: create + atomic single-use consume |
| `src/lib/rateLimit.ts` | DB-backed limiter + per-account and **app-wide** TikTok budgets |
| `src/lib/siteUrl.ts` | Canonical origin + the registered redirect/webhook URLs (single source of truth) |
| `src/lib/tiktokTokens.ts` | Encrypted credential store, refresh lock, revoke-on-disconnect, account records |
| `tests/tiktok/static.test.mjs`, `tests/tiktok/live.test.mjs` | 32 static contract tests + 18 live route tests |

### Rewritten / modified (10)

| File | Change |
|---|---|
| `src/services/tiktok.ts` | **Full rewrite** to the verified v1.3 Accounts API |
| `src/services/tiktokEngine.ts` | Webhook-primary (`handleCommentEvent`) + polling demoted to reconciliation backstop |
| `src/app/api/tiktok/connect/route.ts` | Portal-issued authorization URL + opaque state + rate limits |
| `src/app/api/tiktok/callback/route.ts` | Session + state verification, then exchange, then `tiktok_accounts`/`tiktok_tokens` |
| `src/app/api/tiktok/configs/route.ts` | Account metadata + scopes + token status + webhook state; disconnect revokes |
| `src/app/api/tiktok/cron/poll/route.ts` | Documented as backstop; fail-closed `CRON_SECRET` |
| `src/app/api/bot/cron/drain/route.ts` | Fail-closed `CRON_SECRET` (shared Meta endpoint; behaviour unchanged when configured) |
| `src/app/tiktok-bot/page.tsx` | Webhook status banner, granted-scope count, reconnect hint |
| `src/app/tiktok-bot/[accountId]/page.tsx` | Granted-permissions panel, disconnect by account id |
| `next.config.ts` | `skipTrailingSlashRedirect` + `beforeFiles` rewrites for the two TikTok URLs |

---

## B. Files deliberately NOT changed

`src/services/meta.ts`, `botEngine.ts`, `botAi.ts`, `/api/bot/{configs,rules,logs,webhook,subscribe,tokens,upload,admin}`,
all payment routes (Moamalat, MobiCash, Masarafi, Yusor, Edfali), `/api/wallet/*`, `/api/orders`,
`/api/products`, `/api/promo/*`, `src/middleware.ts`, `src/lib/{authUser,apiAuth,supabaseClient,supabaseAdmin}.ts`.

Verified by `git status`: no diff outside the TikTok surface, except the shared cron fail-closed fix.

---

## C. Database migrations — created, **NOT applied**

Run order (all additive and idempotent):

1. `supabase/security-rate-limits.sql` — `security_rate_limits`, RLS on, zero policies
2. `supabase/tiktok-oauth-phase1.sql` — `tiktok_oauth_states`, `tiktok_accounts`, `tiktok_tokens`
3. `supabase/tiktok-phase2-2.sql` — **new in this phase**

```sql
-- business_id can never drift from open_id: both are GENERATED from one stored identifier
alter table tiktok_accounts
  add column if not exists open_id     text generated always as (tiktok_account_id) stored;
alter table tiktok_accounts
  add column if not exists business_id text generated always as (tiktok_account_id) stored;
alter table tiktok_accounts
  add column if not exists status text not null default 'active';   -- active|revoked|reauth_required

-- app-level webhook configuration (one row; TikTok webhooks are per developer app)
create table if not exists tiktok_webhook_config (
  id int primary key default 1, event_type text not null default 'COMMENT',
  callback_url text, subscribed boolean not null default false,
  last_event_at timestamptz, last_error text, updated_at timestamptz not null default now()
);
alter table tiktok_webhook_config enable row level security;  -- zero policies

-- link the existing rule engine to the TikTok account
alter table bot_configs
  add column if not exists tiktok_account_id uuid references tiktok_accounts (id) on delete set null;
```

Not held back for review only — **no SQL was executed**, because the target is the shared
production Supabase project and that authorisation has not been given.

---

## D. Environment variables (all server-only)

| Variable | Purpose |
|---|---|
| `TIKTOK_CLIENT_ID` | App ID. Sent as `client_id` on the oauth2 endpoints and as `app_id` on `token_info/get/` and the webhook endpoints (the naming inconsistency is TikTok's) |
| `TIKTOK_CLIENT_SECRET` | App secret. Also the HMAC key for webhook signatures |
| `TIKTOK_AUTH_URL` | **The portal-issued TikTok account holder authorization URL.** It cannot be constructed; we only append `state` |
| `TOKEN_ENCRYPTION_KEY` | 32-byte base64 AES-256-GCM key for credentials at rest |
| `TIKTOK_APP_QPM` (opt, 400) · `TIKTOK_ACCOUNT_QPM` (opt, 30) | Rate-limit budgets |

None is `NEXT_PUBLIC_*`. Generate the encryption key with:
`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

---

## E. OAuth flow implemented

```
/tiktok-bot  ── GET /api/tiktok/connect ──────────────────────────────────────────
                 auth required · rate limited (per-user + app-wide)
                 503 when TIKTOK_CLIENT_ID/SECRET/AUTH_URL are unset
                 creates state row: sha256(state) + sha256(cookie binding), 10-min TTL
                 sets HttpOnly · Secure · SameSite=Lax cookie (path /api/tiktok)
                 returns  TIKTOK_AUTH_URL + "&state=<32 random bytes, base64url>"
                        ↓ user approves on TikTok
              ── GET /api/tiktok/callback/  (registered redirect URL, trailing slash) ──
                 1. resolve the signed-in user from the Supabase server-side session
                 2. atomic single-use consume of the state row
                 3. compare cookie binding (constant-time) and session user === row user
                 4. ONLY THEN exchange the auth_code (10-min, single-use)
                 5. business_id := open_id → upsert tiktok_accounts (+ granted scopes)
                 6. encrypt + store tokens in tiktok_tokens
                 7. upsert bot_configs row (rules/log/subscription stay in the one engine)
                 8. 302 → /tiktok-bot?success=1
```

Failure returns fixed codes only (`invalid_state`, `expired`, `not_signed_in`, `cancelled`,
`not_configured`, `oauth_failed`). No upstream text, no `auth_code`, no state and no token is ever
logged or reflected into a URL.

**Trailing slash.** TikTok requires the registered URL to end with `/`, carry no query, no fragment
and no port. Next.js normally 308-redirects `/x/` → `/x`. Measured behaviour of three options:

| Approach | `/api/tiktok/callback/` | `/products/` |
|---|---|---|
| default | 308 → bare path | 308 → bare path |
| `beforeFiles` rewrite alone | **still 308** | 308 |
| `skipTrailingSlashRedirect` + rewrite (**chosen**) | **200/307 handled directly** | 200 |

Confirmed on the production build, not only in dev.

## F. Token lifecycle implemented

- Access token **1 day**, refresh token **1 year** (documented values), both persisted with expiry.
- Stored as AES-256-GCM ciphertext in `tiktok_tokens`; `storeTikTokTokens` **throws** rather than
  writing plaintext if the key is missing.
- `getValidAccessToken()` refreshes inside an **atomic lock claim**
  (`update … where refresh_lock_at is null or refresh_lock_at < now()-60s returning id`), so two
  concurrent serverless invocations cannot refresh the same account; the loser reuses the current
  token. Stale locks are reclaimable; the lock is released in `finally`.
- Refresh rejected by TikTok → `status = 'expired'` → re-authorisation required (no retry storm).
- Disconnect → `POST /tt_user/oauth2/revoke/`, then local teardown **regardless of the remote
  result** (`access_token = NULL, refresh_token = NULL, status = 'revoked'`, `revoked_at` set).

## G. Organic comment endpoints implemented

| Operation | Endpoint | Method | Notes |
|---|---|---|---|
| Profile | `/business/get/` | GET | identity fields only, no analytics |
| Videos | `/business/video/list/` | GET | `item_id` → normalised to `videoId`; cursor pagination |
| List comments | `/business/comment/list/` | GET | `cursor`/`has_more`, `max_count ≤ 30`, `include_replies`, `status`, sorting |
| List replies | `/business/comment/reply/list/` | GET | same pagination |
| Reply (bot) | `/business/comment/reply/create/` | POST | primary bot operation |
| Create comment | `/business/comment/create/` | POST | images deferred |
| Like | `/business/comment/like/` | POST | `action: "like"`; unlike ready when documented |
| Hide | `/business/comment/hide/` | POST | `action: "HIDE"` **plus `video_id`** — replaces the incorrect `/business/comment/status/update/` |
| Delete | `/business/comment/delete/` | POST | owned comments only; no UI implies otherwise |

`business_id` always comes from `open_id`; all ids are strings at the service boundary (TikTok ids
exceed `Number.MAX_SAFE_INTEGER`).

## H. Webhook implemented

`POST /api/tiktok/webhook/` — order is the security property:

1. `await req.text()` — the **raw** body (re-serialising would change bytes and break the HMAC)
2. `Tiktok-Signature: t=<unix>,s=<hex>` → `HMAC_SHA256(app_secret, t + "." + rawBody)`, compared in
   constant time → then timestamp freshness (default 300 s) → else **401**
3. only then `JSON.parse(rawBody)`, then a second parse of the nested `content` **string**
4. ids normalised to strings; only `event === "comment.update"` and
   `comment_action === "insert"` drive a reply; `delete`/`set_to_hidden`/`set_to_friends_only`/
   `set_to_public` are acknowledged and ignored
5. fast **200**, processing detached; unusable deliveries are acked (never retried forever), while
   unverifiable ones are rejected
6. no secret is configured → **503**, fail closed

Subscription is **app-level**: `POST /business/webhook/update/` with
`{app_id, secret, event_type: "COMMENT", callback_url}` — one configuration for every customer,
managed only through the admin route; the secret comes from the environment, never the request body.

## I. Polling status

Kept, role changed: **webhook = primary, poll = reconciliation backstop** at 15–30 minutes (because
events fire "within five minutes", delivery is at-least-once, and retry behaviour is undocumented).
Both paths claim comments through the same `UNIQUE(comment_id)` constraint on `bot_reply_log`, so an
overlap can never produce a double reply. One rule engine throughout (`matchRule` from `botEngine`).

## J. Rate limiting status

| Plane | Limit | Keyed by |
|---|---|---|
| TikTok documented | 40 QPM per account per endpoint | — |
| TikTok documented | 600 QPM (Basic) for all Accounts endpoints **per developer app** | — |
| Implemented | `TIKTOK_ACCOUNT_QPM` (30) | account + endpoint |
| Implemented | `TIKTOK_APP_QPM` (400) | **one global bucket** (`app:all`), independent of any customer |

Built on the existing `security_rate_limits` infrastructure; no unrelated rate limiting was redesigned.

---

## K. Tests executed and results — **50/50 pass**

```
node --test tests/tiktok/static.test.mjs        →  32 pass / 0 fail
# live suite needs a server:
TIKTOK_CLIENT_SECRET=phase22-test-secret npx next dev -p 3212
node --test tests/tiktok/live.test.mjs          →  18 pass / 0 fail
```

| # | Requirement | Result |
|---|---|---|
| 1 | Unauthenticated OAuth start rejected | ✅ live — 401 |
| 2 | Invalid OAuth state rejected | ✅ live — forged `base64(uuid)` → `error=invalid_state`, no exchange |
| 3 | Expired state rejected | ⚠️ **not executed** — needs the migrations applied |
| 4 | Reused state rejected | ⚠️ **not executed** — needs the migrations applied |
| 5 | Callback requires a matching authenticated session | ✅ live |
| 6 | Tokens never in the client bundle | ✅ build scan — no TikTok endpoint/table/secret in `.next/static` |
| 7 | Token columns unselectable by the browser | ⚠️ **not executed** — asserted statically (RLS on, zero policies) |
| 8 | Invalid webhook signature rejected | ✅ live — invalid, missing, **and re-serialised-JSON** all 401 |
| 9 | Stale timestamp rejected | ✅ live — 401 |
| 10 | Valid signature accepted | ✅ live — 200 |
| 11 | Nested `content` JSON parsed | ✅ live |
| 12 | `comment_id` normalised to string | ✅ live — 19-digit id survives |
| 13 | Duplicate comment → no duplicate reply | ✅ static — both paths claim via `UNIQUE(comment_id)` |
| 14 | Hide uses `/business/comment/hide/` | ✅ static — old endpoint absent from code |
| 15 | Reply uses `/business/comment/reply/create/` | ✅ static |
| 16 | Refresh lock prevents concurrent refresh | ✅ static (structure); ⚠️ not exercised against a live DB |
| 17 | Revoke called on disconnect | ✅ static (structure); ⚠️ not exercised against a live DB |
| 18 | Both account and app-wide limiters apply | ✅ static — both called in the engine |

Regression checks (live): Meta bot routes unchanged (`/api/bot/configs` 401, `/api/bot/settings` 200,
`/api/bot/webhook` wrong token → 403), storefront unchanged (`/api/products`, `/api/site-settings` 200),
cron endpoints fail closed.

Build: `next build` compiles successfully; all six TikTok routes registered. `tsc --noEmit` clean
except one **pre-existing unrelated** error (`src/app/bot/page.tsx:98`). ESLint clean on all changed
files.

> Note on the `access_token` strings found in client chunks: these are the app's own
> **Supabase session** handling (`supabase.auth.getSession()`), pre-existing and unrelated to TikTok.
> No TikTok token, endpoint or table appears in the client bundle.

---

## L. Remaining blockers

1. Migrations not applied (3 files, order above).
2. No TikTok developer app, so no credentials — every outbound call is untested against TikTok.
3. Webhook cannot be registered until the app exists.
4. Three test items (3, 4, 7) remain unexecuted until the tables exist.
5. **One global behaviour change:** with `skipTrailingSlashRedirect`, trailing-slash URLs across the
   whole site now return 200 directly instead of 308-redirecting to the bare path. No route broke,
   but URL canonicalisation is gone; it can be restored selectively if SEO duplication matters.

---

## M. Manual steps required in the TikTok Developer Portal

1. Create the developer app; under **Authorization → Scope of permission** select **TikTok Accounts**,
   then **Business Comment → Get Business Comment** and **Manage Business Comment**,
   **Business Media**, **Get Business User Basic Info**.
2. Upload an **App logo** (JPG/JPEG/PNG ≤ 512×512). Without it, users see an error page when
   authorising.
3. Set the **TikTok account holder redirect URL** to exactly:
   `https://www.trendstore-ly.com/api/tiktok/callback/`
   (absolute, https, **trailing slash**, no query, no fragment, no port, 10–512 chars).
4. Copy into Vercel production: **TikTok account holder authorization URL** → `TIKTOK_AUTH_URL`,
   **App ID** → `TIKTOK_CLIENT_ID`, **Secret** → `TIKTOK_CLIENT_SECRET`; and set
   `TOKEN_ENCRYPTION_KEY`.
5. Apply the three migrations.
6. Deploy, then as an admin call `POST /api/tiktok/admin/webhook` to register `event_type=COMMENT`
   on `https://www.trendstore-ly.com/api/tiktok/webhook/`.
7. Permission changes are self-service and reviewed by TikTok in **2–3 business days**.

---

## Final status

**IMPLEMENTED** — service layer, OAuth start/callback, token lifecycle (encrypt/refresh/revoke),
all seven organic comment endpoints, webhook receiver + verification, app-level subscription
management, reconciliation backstop, two-plane rate limiting, UI, migrations as files, 50 tests.

**REQUIRES DEVELOPER PORTAL CONFIGURATION** — authorization URL, redirect URL, app logo, permission
scopes, webhook registration.

**REQUIRES REAL TIKTOK CREDENTIALS** — every outbound TikTok call: token exchange, refresh, revoke,
profile, videos, comment list/reply/create/like/hide/delete, and webhook delivery.

No TikTok API call has been made. No production connection has been demonstrated.
