# TikTok Integration — Security Audit & Phase 1 Hardening Report

**Project:** Trend Store — e-commerce storefront + social-marketing tools for a Libyan electronics shop
**Live site:** https://www.trendstore-ly.com
**Date:** 2026-09-16
**Status:** Phase 1 (security hardening) complete. TikTok integration NOT started.

---

## 0. How to use this document

This is a self-contained report for an external reviewer (e.g. ChatGPT). You do not have
access to the codebase, so every relevant fact is restated below.

**What we want reviewed:**

1. Is the OAuth CSRF design (§4.1) actually sound? Any bypass we missed?
2. Is the token-at-rest + RLS design (§4.3) the right shape for a multi-tenant SaaS on Supabase?
3. Is the refresh-locking approach (§4.6) correct for serverless (multiple concurrent instances)?
4. Anything in "Remaining issues" (§6) that should be raised in priority?
5. TikTok-specific: which official **TikTok API for Business** endpoints/scopes are correct today
   for *organic* video comment listing + replying, and for OAuth (authorize host, token host,
   refresh grant, revoke)? See §7 — our current code is **unverified** and must be corrected.

**Hard constraints on this project (non-negotiable):**

- Official TikTok API for Business only. No unofficial APIs, no scraping, no browser automation.
- No mock/fake TikTok responses.
- No TikTok secret or access token may ever reach the browser.
- Do not break: existing Meta (Facebook) bot, payment system, storefront.
- No AI features in this phase.

**Redactions:** secrets, keys, project identifiers and internal tokens are removed or replaced
with `<redacted>`. No credential appears in this document.

---

## 1. System overview

| Layer | Technology |
|---|---|
| Frontend | Next.js **16.2.4** (App Router), React 19.2.4, TypeScript 5, Tailwind CSS v4 |
| Backend | Next.js Route Handlers only (`src/app/api/**/route.ts`), Node runtime. No separate backend service |
| Database / Auth | Supabase (Postgres + Supabase Auth), `@supabase/ssr` cookie sessions |
| Hosting | Vercel (manual production deploys) |
| Scheduling | External cron service calling HTTP endpoints with `Authorization: Bearer <CRON_SECRET>` |
| Locale | Arabic-first, RTL, bilingual AR/EN UI |

**Two Supabase clients, never mixed:**

- Browser: anon key, subject to Row Level Security (RLS).
- Server (API routes): **service-role key, bypasses RLS entirely**.

Consequence, and the root of several findings: *RLS is the only thing standing between a
signed-in user's browser and any table column*, while API routes are unconstrained and must
authenticate every caller themselves.

**Authentication:** Supabase Auth. A helper resolves the user from request cookies server-side.
Middleware guards `/admin/*` **pages** only — it does **not** run on `/api/*`, so every API
route authenticates independently. Admin role is stored in `profiles.role`.

**Relevant pre-existing tables:**

| Table | Notes |
|---|---|
| `profiles` | user metadata + `role` |
| `wallets`, `wallet_transactions` | in-app LYD balance used by ads and bot subscriptions |
| `connected_pages` | Facebook Pages, includes `page_access_token` **in plaintext** |
| `bot_configs` | one row per (user, page/account, platform: `meta` \| `tiktok`) |
| `bot_page_tokens` | token pool (Meta), `access_token` / `refresh_token` **in plaintext** |
| `bot_rules`, `bot_reply_log`, `bot_subscriptions`, `bot_settings` | auto-reply bot: rules, idempotency log, billing |

Live row counts at audit time: `bot_configs` platform=meta **7**, platform=tiktok **0**;
`bot_page_tokens` **30**; `connected_pages` **87**.

---

## 2. What existed for TikTok before this work

A previous session wrote a TikTok track *from documentation only*, never executed against a
real approved app:

- UI: `/tiktok` (tools hub), `/tiktok-bot` (accounts dashboard), `/tiktok-bot/[accountId]` (console).
- API: `GET /api/tiktok/connect`, `GET /api/tiktok/callback`, `GET|PATCH|DELETE /api/tiktok/configs`,
  `GET /api/tiktok/cron/poll`.
- Service layer: `src/services/tiktok.ts` (OAuth + comment endpoints), `src/services/tiktokEngine.ts`
  (polling engine — TikTok has no comment webhook, so comments must be polled).
- Storage: TikTok reused the Meta tables (`bot_configs` + `bot_page_tokens`).
- Environment: **no TikTok credentials configured anywhere** (so the flow could never have run).

---

## 3. Audit findings (the "before" state)

Ordered by severity.

### 3.1 CRITICAL — Forgeable OAuth state → account-linking CSRF

```ts
// /api/tiktok/connect  (BEFORE)
const state = Buffer.from(user.id).toString("base64");

// /api/tiktok/callback (BEFORE)
userId = Buffer.from(state, "base64").toString("utf-8");   // sole source of identity
```

The state was a base64 of the user's UUID: guessable from any leaked/known user id, reusable
forever, no expiry, no single-use, and **it alone decided which Trend account the TikTok account
was bound to**. An attacker could bind an account they control to a victim's Trend account (or
be phished into the reverse).

### 3.2 CRITICAL — Callback never verified the signed-in user

The callback did not read the Supabase session at all. Identity came only from the attacker-
controllable `state` parameter.

### 3.3 CRITICAL — Credentials readable by the browser

Both token tables had this RLS policy:

```sql
create policy "users_own_bot_tokens" on bot_page_tokens
  for all using (auth.uid() = user_id);
```

`FOR ALL ... USING (auth.uid() = user_id)` permits `SELECT`, so any signed-in user's browser
(anon key) could read their own `access_token` / `refresh_token` / `page_access_token`. The API
routes never returned these, but RLS allowed direct table reads. This directly violates
"no token may reach the browser".

### 3.4 HIGH — Tokens stored in plaintext

No encryption at rest; a database dump or console access yields live third-party credentials.

### 3.5 HIGH — Cron endpoints fail **open**

```ts
const secret = (process.env.CRON_SECRET || "").trim();
if (secret && auth !== `Bearer ${secret}`) return 401;   // secret missing ⇒ no check at all
```

A missing/misspelled env var silently made the endpoints public — and these endpoints trigger
real outbound API traffic (posting replies).

### 3.6 MEDIUM — Upstream error text reflected into the URL

```ts
const reason = encodeURIComponent(msg.slice(0, 180));
return NextResponse.redirect(`${base}/tiktok-bot?error=oauth_failed&reason=${reason}`);
```

Provider error strings landed in the user's address bar (information disclosure, log pollution).

### 3.7 MEDIUM — Concurrent token refresh race

The polling engine refreshed a near-expiry token with no lock. Two concurrent serverless
invocations could refresh simultaneously; with rotating refresh tokens, one invalidates the other.

### 3.8 MEDIUM — Disconnect never revokes remotely

Deleting the local config deleted local rows but never called the provider's revoke endpoint,
leaving a live authorization. No user-data-deletion endpoint existed either (required for
TikTok app review).

### 3.9 MEDIUM — Non-atomic wallet debit (billing integrity)

```ts
const { data: wallet } = await db.from("wallets").select("balance")...;
if (balance < price) return 402;
await db.from("wallets").update({ balance: balance - price })...;   // read-modify-write
```

Concurrent requests can double-spend, and **no ledger row** is written to `wallet_transactions`
for bot subscriptions.

### 3.10 LOW/MEDIUM — Build safety nets disabled

```ts
// next.config.ts
typescript: { ignoreBuildErrors: true },
eslint:     { ignoreDuringBuilds: true },
```

Type errors ship to production silently (one unrelated error was live at audit time).

### 3.11 LOW — No rate limiting anywhere, including OAuth entry points.

### 3.12 Canonical-URL mismatch (blocking for OAuth)

- `https://trendstore-ly.com/*` → **308 redirect** → `https://www.trendstore-ly.com/*`, so **www is canonical**.
- `NEXT_PUBLIC_BASE_URL` is an **empty string** in production, so every
  `process.env.NEXT_PUBLIC_BASE_URL || "https://trendstore-ly.com"` fallback resolved to the
  **non-canonical apex**.
- OAuth providers match `redirect_uri` **exactly** → registering the wrong host breaks the flow
  or forces a re-registration later.

---

## 4. Phase 1 — what was implemented

Guiding rule: harden first, integrate later. **No TikTok API call, no developer app, no
credentials, no SQL executed.**

### 4.1 New OAuth state system (fixes 3.1, 3.2)

Three independent checks must **all** pass in the callback:

1. `state` (32 cryptographically random bytes, base64url) hashes to a row that is
   **unconsumed and unexpired**;
2. an **HttpOnly, Secure, SameSite=Lax** cookie set at start hashes to the same row's binding;
3. the **Supabase server-side session user** equals the row's `user_id`.

Design notes:

- Neither the state nor the cookie value is stored — only `sha256` of each — so a dump of the
  state table cannot be replayed.
- The state contains **no user id in any form**.
- TTL is 10 minutes, enforced in code *and* by a DB `CHECK` (`expires_at < created_at + 1 hour`).
- Single-use is an **atomic claim**: one `UPDATE ... SET consumed_at = now() WHERE state_hash = $1
  AND consumed_at IS NULL RETURNING ...`. Two concurrent callbacks cannot both win; the loser
  gets zero rows.
- Expiry is checked **after** the claim, so an expired state is burned rather than left replayable.
- `redirect_path` is constrained to relative paths (`CHECK redirect_path LIKE '/%'`) to block
  open redirects.
- The authorization code is exchanged **only after** all checks pass.
- Failures return fixed codes (`invalid_state`, `expired`, `not_signed_in`, `oauth_failed`,
  `cancelled`) — never upstream text (fixes 3.6). The binding cookie is cleared on every path.

Verified live against the local server: a forged old-style `base64(user-uuid)` state produced
`?error=invalid_state`, cookie cleared, **no code exchange attempted**.

### 4.2 Dedicated TikTok storage (fixes 3.3 scope-wise)

Split metadata from credentials:

- `tiktok_accounts` — safe metadata only (account id, username, display name, avatar, granted
  scopes, `connected_at`, `revoked_at`). Owner + admin **SELECT-only** RLS policies.
- `tiktok_tokens` — credentials only, one row per account. **RLS enabled with ZERO policies.**
  Under Postgres RLS, a table with no policy denies every `anon`/`authenticated` request, so a
  valid user session cannot read a token; only the service-role key (server) bypasses RLS.
- `tiktok_oauth_states` — RLS on, zero policies.

### 4.3 Encryption at rest (fixes 3.4)

- AES-256-GCM, format `v1.<iv b64url>.<authTag b64url>.<ciphertext b64url>` (version prefix
  allows key rotation).
- Key from a **server-only** env var (`TOKEN_ENCRYPTION_KEY`, 32 bytes base64). Never a
  `NEXT_PUBLIC_*` variable, so it cannot be inlined into the client bundle.
- The store function **throws** if the key is missing rather than silently writing plaintext.
- A `redact()` helper exists; no token, refresh token, authorization code, client secret or
  state is logged anywhere in our code.
- Both crypto and token modules throw if they are ever evaluated in a browser context.

### 4.4 Cron fail-closed (fixes 3.5)

```ts
const secret = (process.env.CRON_SECRET || "").trim();
if (!secret) return new NextResponse("Cron secret not configured", { status: 503 });
if (auth !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
```

Applied to both the TikTok poll and the Meta drain endpoint. Behaviour with a correctly
configured secret is unchanged.

### 4.5 Rate limiting (fixes 3.11)

Database-backed fixed-window limiter, **no new npm dependency**. Hits are `INSERT`ed and counted
(rather than incrementing a counter row), so parallel serverless invocations cannot lose
increments. Limits: OAuth start 10 / 10 min, OAuth callback 20 / 10 min, config writes 60 / 10 min,
keyed by user id when signed in, else client IP. It **fails open** on limiter/database failure —
deliberate: a limiter outage must not lock users out, and no authentication decision depends on it.

### 4.6 Refresh locking (fixes 3.7)

One atomic stamped claim:

```sql
UPDATE tiktok_tokens
   SET refresh_lock_at = now()
 WHERE account_id = $1
   AND (refresh_lock_at IS NULL OR refresh_lock_at < now() - interval '60 seconds')
RETURNING id;
```

Postgres serializes the row write, so only one caller gets a row back. Losers reuse the current
token instead of refreshing in parallel. A stale lock (crashed refresher) is reclaimable after
the TTL. The lock is released in a `finally` block.
**The actual refresh call is deliberately not implemented** (see §7).

### 4.7 Disconnect architecture (fixes 3.8, partially)

`disconnectTikTokAccount(accountId, userId)`:

1. verifies ownership;
2. *(plug-in point)* calls TikTok's official revoke endpoint — **not implemented yet**;
3. destroys local credentials (`access_token = NULL, refresh_token = NULL, status = 'revoked'`);
4. sets `revoked_at` on the account;
5. returns `{ ok, remoteRevoked: false }` — reporting honestly which half ran.

Local teardown happens regardless, so no credential survives a disconnect even before the remote
step exists.

### 4.8 Canonical URL (fixes 3.12)

A single helper pins `https://www.trendstore-ly.com` (overridable by `NEXT_PUBLIC_BASE_URL` when
actually set) and exports one function for the TikTok redirect URI, so the portal value and the
code value cannot drift. Scoped to TikTok only — Meta/ads and payment routes keep their existing
fallback, because changing a live redirect URI requires re-registering it with those providers first.

---

## 5. Database migrations (written, **not executed**)

Order matters; both are additive and idempotent.

**1. Rate limiting**

```sql
create table if not exists security_rate_limits (
  id         bigserial primary key,
  bucket     text        not null,
  identifier text        not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_security_rate_limits_lookup
  on security_rate_limits (bucket, identifier, created_at desc);
create index if not exists idx_security_rate_limits_created
  on security_rate_limits (created_at);
alter table security_rate_limits enable row level security;   -- zero policies
```

**2. TikTok OAuth + accounts + tokens** (abridged; constraints shown)

```sql
create table if not exists tiktok_oauth_states (
  id            uuid primary key default gen_random_uuid(),
  state_hash    text not null unique,            -- sha256(state), 64 hex
  binding_hash  text not null,                   -- sha256(cookie value)
  user_id       uuid not null references auth.users on delete cascade,
  provider      text not null default 'tiktok',
  flow          text not null default 'connect',
  redirect_path text,
  scopes        text[] not null default '{}',
  expires_at    timestamptz not null,
  consumed_at   timestamptz,
  created_at    timestamptz not null default now(),
  constraint state_hash_len   check (char_length(state_hash) = 64),
  constraint binding_hash_len check (char_length(binding_hash) = 64),
  constraint provider_chk     check (provider in ('tiktok')),
  constraint flow_chk         check (flow in ('connect','reconnect','scope_upgrade')),
  constraint redirect_rel     check (redirect_path is null or redirect_path like '/%'),
  constraint ttl_chk          check (expires_at > created_at
                                     and expires_at < created_at + interval '1 hour')
);
alter table tiktok_oauth_states enable row level security;   -- zero policies

create table if not exists tiktok_accounts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users on delete cascade,
  tiktok_account_id text not null,
  union_id          text,
  username          text,
  display_name      text,
  avatar_url        text,
  granted_scopes    text[] not null default '{}',
  connected_at      timestamptz not null default now(),
  revoked_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, tiktok_account_id)
);
alter table tiktok_accounts enable row level security;
-- owner SELECT + admin SELECT policies only; all writes via service role

create table if not exists tiktok_tokens (
  id                 uuid primary key default gen_random_uuid(),
  account_id         uuid not null references tiktok_accounts on delete cascade,
  access_token       text,          -- AES-256-GCM ciphertext
  refresh_token      text,          -- AES-256-GCM ciphertext
  access_expires_at  timestamptz,
  refresh_expires_at timestamptz,
  status             text not null default 'active',
  last_refreshed_at  timestamptz,
  refresh_lock_at    timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (account_id),
  constraint status_chk check (status in ('active','expired','revoked','error'))
);
alter table tiktok_tokens enable row level security;   -- INTENTIONALLY zero policies
```

Plus `set_updated_at()` trigger function with triggers on both tables, and indexes on
`tiktok_accounts(user_id)`, partial index where `revoked_at is null`, `tiktok_tokens(account_id)`,
partial index on `access_expires_at` where `status = 'active'`, `tiktok_oauth_states(user_id)`
and `(expires_at)`.

**3. Proposed, NOT applied — hide existing plaintext credential columns from the browser**

```sql
revoke select (access_token, refresh_token) on table bot_page_tokens  from anon, authenticated;
revoke select (page_access_token)           on table connected_pages  from anon, authenticated;
-- plus the matching insert/update revokes
```

Column-level `REVOKE` was chosen over dropping the row policies, so non-credential columns keep
working for the browser while secrets become unreadable; the service role is unaffected.
**Held back** because the Supabase project is shared by several applications and a different app
reading those columns with the anon key would break the moment it runs. Pre-flight checklist,
verification queries and rollback are included in the file.

**Data migration:** none needed — there are **0 TikTok rows** today. Documented rule: any future
TikTok rows must be **re-linked through OAuth, never copied**, because the legacy rows are
plaintext and SQL cannot encrypt them (the key lives only in the application).

---

## 6. Remaining issues (open)

| # | Issue | Status / reason |
|---|---|---|
| 1 | Plaintext credential columns in `bot_page_tokens` / `connected_pages` still browser-readable | Migration written, **deliberately not applied** — 117 live rows, shared Supabase project, needs a cross-application check first |
| 2 | Non-atomic wallet debit + missing ledger row (3.9) | Out of scope: payment system must not be modified in this phase. Needs an atomic Postgres function |
| 3 | `ignoreBuildErrors` / `ignoreDuringBuilds` still enabled | Left deliberately; one pre-existing unrelated type error blocks re-enabling |
| 4 | OAuth `code` and `state` appear in platform request logs | Inherent to redirect-based OAuth; mitigated by single-use, 10-min TTL and hashed storage. Is there a stronger mitigation worth taking? |
| 5 | No TikTok user-data-deletion endpoint | Required for TikTok app review; Phase 2 |
| 6 | Pre-existing React lint warnings in the TikTok UI pages | Cosmetic; unrelated to security |

---

## 7. ⚠️ Unverified TikTok API assumptions — the main question for the reviewer

`src/services/tiktok.ts` was written **from documentation and has never run against an approved
live TikTok app**. It is kept (not deleted) but marked unverified. Every item below must be
confirmed against the **current official TikTok API for Business documentation** before Phase 2:

1. **Authorize host** — currently `https://www.tiktok.com/v2/auth/authorize` with `client_key`.
2. **Token exchange host** — currently `POST https://business-api.tiktok.com/open_api/v1.3/tt_user/oauth2/token/`
   with `{ client_id, client_secret, grant_type: "authorization_code", auth_code, redirect_uri }`.
   Is pairing the Login-Kit-style authorize URL with this business token endpoint correct, or
   should both sides come from one family (Login Kit `open.tiktokapis.com`, **or** the Business
   portal auth flow)?
3. **Refresh grant** — currently `.../tt_user/oauth2/refresh_token/` with
   `{ client_id, client_secret, grant_type: "refresh_token", refresh_token }`.
4. **Revoke endpoint** — not implemented; what is the official one?
5. **Scopes** — currently `user.info.basic,video.list,comment.list,comment.list.manage`.
   Which scopes are actually required for listing and replying to comments on **organic**
   (non-ad) videos, and which require app review?
6. **Identifiers** — the code assumes the `open_id` returned by the token exchange can be used as
   `business_id` in subsequent calls. Correct?
7. **Endpoints used** (all `open_api/v1.3`, `Access-Token` header, non-zero `code` in a 200 body
   means failure): `business/get/`, `business/video/list/`, `business/comment/list/`,
   `business/comment/reply/create/`, `business/comment/status/update/`. Are these the current
   correct paths, field names and pagination parameters for organic comment management?
8. **No comment webhook** — our design polls on a schedule because we believe TikTok offers no
   push delivery for organic comments. Still true?
9. **No organic DM API** — we believe there is no automated private-reply capability for organic
   comments (unlike Meta), so the bot replies publicly. Still true?

Please answer with citations to current official documentation, and flag anything that is
deprecated or that requires a specific app type / review track.

---

## 8. Planned next steps (in order)

1. Set `NEXT_PUBLIC_BASE_URL=https://www.trendstore-ly.com` in production and verify the generated
   `redirect_uri`.
2. Run migration 1, then migration 2.
3. Generate and set `TOKEN_ENCRYPTION_KEY` (32 bytes, base64), server-only.
4. Create the TikTok developer app; register redirect URI
   **`https://www.trendstore-ly.com/api/tiktok/callback`** (exact match).
5. Correct `src/services/tiktok.ts` from current official documentation (§7).
6. Switch the callback's storage from the legacy Meta tables to `tiktok_accounts` / `tiktok_tokens`.
7. Implement the two plug-in points: token refresh under the existing lock, and official remote revoke.
8. Add the user-data-deletion endpoint; complete TikTok app review.
9. Run the cross-application check, then apply the proposed column lockdown migration.

## 9. Verification performed at the end of Phase 1

- TypeScript check: clean except one pre-existing unrelated error.
- ESLint on all new/changed server files: clean.
- Production build: compiled successfully, all routes present.
- Live endpoint smoke tests: Meta bot routes, storefront routes and settings routes unchanged;
  TikTok routes reject unauthenticated callers; forged state rejected without a code exchange;
  cron endpoints return 503 when the secret is absent.
- No `TIKTOK_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY` or service-role string in the client bundle.
- No API route serializes a token column; no client component imports a server-only module.
- Payment, wallet and Meta-bot source files: zero diff.
