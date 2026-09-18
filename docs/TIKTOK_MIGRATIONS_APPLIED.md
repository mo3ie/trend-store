# TikTok Migrations — Applied & Verified

**Project:** Trend Store · Supabase project `grazynglhjuuxesgusgd` (PostgreSQL 17.6, eu-west-1)
**Date:** 2026-09-16
**Executed by:** Supabase Management API (`POST /v1/projects/{ref}/database/query`)
**Result:** all four migrations applied successfully · **106/106 tests pass** · no data lost.

> ⚠️ This is the **shared production database** used by four applications. Every statement
> executed was additive (CREATE / ADD COLUMN / ADD CONSTRAINT / CREATE INDEX). Nothing was
> dropped, altered destructively, or deleted.

---

## 1. Pre-flight snapshot (before any change)

| Check | Value |
|---|---|
| Target tables already present | only `bot_configs`, `bot_reply_log` |
| `security_rate_limits`, `tiktok_*` tables | **did not exist** — all four migrations were required |
| `bot_reply_log` | 2 rows · 15 columns |
| `bot_configs` | 7 rows, all `platform = 'meta'`, 0 TikTok |

---

## 2. Migrations executed, in order

| # | File | Result |
|---|---|---|
| 1 | `supabase/security-rate-limits.sql` | ✅ HTTP 201 |
| 2 | `supabase/tiktok-oauth-phase1.sql` | ✅ HTTP 201 |
| 3 | `supabase/tiktok-phase2-2.sql` | ✅ HTTP 201 |
| 4 | `supabase/tiktok-webhook-queue.sql` | ✅ HTTP 201 |

---

## 3. Objects created — verified state

| Table | RLS | Policies | Indexes | CHECK constraints |
|---|---|---|---|---|
| `security_rate_limits` | ✅ on | **0** | 3 | — |
| `tiktok_oauth_states` | ✅ on | **0** | 4 | 6 |
| `tiktok_tokens` | ✅ on | **0** | 4 | 1 |
| `tiktok_webhook_config` | ✅ on | **0** | 1 | 2 |
| `tiktok_accounts` | ✅ on | 2 (`owner_select`, `admin_select` — **SELECT only**) | 5 | 1 |

Zero policies on the credential, state, rate-limit and webhook-config tables is the intended
design: under RLS a table with no policy denies every `anon`/`authenticated` request, so only
the service-role key (server-side API routes) can reach them.

**Triggers:** `trg_tiktok_accounts_updated`, `trg_tiktok_tokens_updated` (both `set_updated_at`).

### Generated identifier columns

```
column_name  | is_generated | generation_expression
-------------+--------------+----------------------
business_id  | ALWAYS       | tiktok_account_id
open_id      | ALWAYS       | tiktok_account_id
```

`business_id == open_id` is now enforced **by the database**, not by convention. A second
identifier mapping cannot be introduced by accident — a direct write to either column is
rejected by Postgres.

### `bot_reply_log` (shared with the Meta bot)

| Before | After |
|---|---|
| 15 columns · 2 rows | 20 columns · 2 rows |

Added (all nullable, unused by Meta code paths): `event_action`, `event_type`, `received_at`,
`processed_at`, `attempts`.
Added index: `idx_bot_reply_log_queued` (partial, `where public_status in ('queued','processing')`).
Unique constraints: **exactly one** — `bot_reply_log_comment_id_key` on `comment_id`. The single
deduplication authority is intact and no second uniqueness rule was introduced.

---

## 4. Verification tests — 106/106 pass

| Suite | Tests | Result |
|---|---|---|
| `tests/tiktok/lossless.test.mjs` | 21 | ✅ |
| `tests/tiktok/ack.test.mjs` | 7 | ✅ |
| `tests/tiktok/static.test.mjs` | 41 | ✅ |
| `tests/tiktok/live.test.mjs` | 22 | ✅ |
| **`tests/tiktok/db.test.mjs` (new)** | **15** | ✅ |

### The three items that were blocked before this migration are now proven

| Item | Test | Result |
|---|---|---|
| **7 — token columns unreadable by the browser** | the `anon` key (exactly what a browser holds) selects `access_token, refresh_token` from `tiktok_tokens` | **0 rows returned** ✅ |
| 7b / 7c | same for `tiktok_oauth_states` and `security_rate_limits` | 0 rows ✅ |
| 7d | `anon` attempts to INSERT into `tiktok_tokens` | rejected, HTTP ≥ 400 ✅ |
| — | service role reads the same table | HTTP 200 ✅ (the server path works) |
| **4 — reused state rejected** | atomic claim `update … where consumed_at is null` run twice | 1st claim → 1 row, 2nd claim → **0 rows** ✅ |
| **3 — expired state rejected** | backdated row, then claimed | row burned by the claim and `expires_at` is in the past, so `consumeOAuthState` rejects it ✅ |

### Additional properties proven against the live database

- **Deduplication:** inserting the same `comment_id` twice → the second is rejected with
  Postgres error **`23505`** (unique violation). This is the exact mechanism the webhook's
  durable intake relies on.
- **19-digit id integrity:** a comment id ending `6990565363377392901` round-trips through the
  database unchanged.
- **TTL constraint:** a state with a 7-hour lifetime is **refused** by the CHECK constraint.
  (An already-expired row also cannot be created with `created_at = now()` — the constraint
  works, which is why the expiry test backdates `created_at` as production time would.)
- **Webhook config:** exactly one singleton row, `id = 1`, `event_type = 'COMMENT'`,
  `subscribed = false`.
- **Meta isolation:** a TikTok `queued` row never appears in Meta's `public_status = 'deferred'`
  drain query.

### Test-data hygiene

Every row created by the suite is tagged `phase221-dbtest-*` and deleted in the same run.
Post-run audit:

```
reply_log leftovers: 0 · states: 0 · accounts: 0 · tiktok_tokens: 0 · bot_reply_log total: 2
```

`bot_reply_log` is back to its original 2 rows.

---

## 5. Impact on the live Meta bot and other apps

| Table | Before | After | Note |
|---|---|---|---|
| `bot_configs` (meta) | 7 | **7** | unchanged |
| `connected_pages` | 87 | **87** | unchanged |
| `bot_page_tokens` | 30 | **75** | **grew** — the parallel ads workstream connected Pages during the day. Not caused by, and not affected by, these migrations |
| `bot_reply_log` | 2 rows / 15 cols | 2 rows / 20 cols | 5 nullable columns added |

The Meta bot reads `comment_id, public_status, private_status, sent_at, config_id` — all
verified still present and queryable. Its drain filters strictly on `public_status = 'deferred'`,
so the new TikTok lifecycle (`queued → processing → sent|skipped|failed`) is invisible to it.

Payments, wallet, storefront and the other three applications sharing this project were not
touched: no migration references any of their tables.

---

## 6. Honest note on one test correction

Two tests failed on the first run and **both were test defects, not database problems**:

1. `Meta data is intact` hard-coded `bot_page_tokens = 30` from a snapshot taken hours earlier.
   The real count was 75 — growth from the concurrent ads work, not loss. The assertion now
   checks "never shrank" instead of an exact count, because this is a live, actively-written
   database.
2. `expired state` tried to insert a row that was already expired, which the TTL CHECK
   constraint correctly refused. The test now backdates `created_at`, reproducing how a state
   actually expires in production.

---

## 7. Status after this work

**DONE**
- All four migrations applied to production and verified object-by-object.
- The security model is now enforced by the database, not just by code review.
- Phase 2.2 test items 3, 4 and 7 are proven rather than asserted.
- 106/106 tests green; production build green.

**STILL REQUIRED — TikTok Developer Portal**
1. Create the app; select **TikTok Accounts** → Business Comment (Get + Manage), Business Media,
   Get Business User Basic Info.
2. Upload an App logo (authorisation fails without one).
3. Register the redirect URL exactly: `https://www.trendstore-ly.com/api/tiktok/callback/`
4. Copy the portal-issued authorization URL → `TIKTOK_AUTH_URL`; App ID → `TIKTOK_CLIENT_ID`;
   Secret → `TIKTOK_CLIENT_SECRET`.

**STILL REQUIRED — environment**
- `TOKEN_ENCRYPTION_KEY` (32-byte base64) must be set in Vercel production **before** the first
  connection: `storeTikTokTokens` refuses to write a credential without it, by design.
- `NEXT_PUBLIC_BASE_URL = https://www.trendstore-ly.com` (currently empty in production).

**STILL REQUIRED — after deploy**
- Call `POST /api/tiktok/admin/webhook` as an admin to register `event_type = COMMENT` on
  `https://www.trendstore-ly.com/api/tiktok/webhook/`.

**Unchanged blockers**
- No TikTok API call has been made; no production connection has been demonstrated.
- All application code remains **uncommitted** (backed up outside the repository).
- `skipTrailingSlashRedirect` means trailing-slash URLs site-wide serve 200 directly instead of
  308-canonicalising.
