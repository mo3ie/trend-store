# TikTok Webhook Hardening — Phase 2.2.1 Corrective Pass

**Project:** Trend Store (Next.js 16 · Supabase · Vercel) — https://www.trendstore-ly.com
**Date:** 2026-09-16
**Scope:** two reliability defects in the Phase 2.2 implementation. Nothing else was touched.
**Status:** complete — **91/91 tests pass**, production build green.
**Still not connected to TikTok:** no developer app, no credentials, **no TikTok API call has
ever been made**, no SQL executed.

---

## 0. What this pass fixed

| # | Defect in Phase 2.2 | Severity | Status |
|---|---|---|---|
| 1 | 19-digit comment/video ids were destroyed by `JSON.parse` before being stringified | **Critical** — wrong reply target *and* wrong deduplication key | Fixed |
| 2 | The webhook returned 200 and processed in detached background work, which a serverless runtime may kill | High — silent loss of valid events | Fixed |

Explicitly unchanged: OAuth flow, TikTok endpoints, scopes, token encryption, Meta integration,
wallet/payment, storefront, Business Messaging, AI, unrelated routes.

---

## 1. Issue 1 — large-integer id precision

### The defect, demonstrated before fixing

```js
JSON.parse('{"comment_id":6990565363377392901}').comment_id
// -> 6990565363377393000        ← precision already destroyed
Number.MAX_SAFE_INTEGER          // 9007199254740991
```

The Phase 2.2 code did exactly this, then called `String(...)`. `String()` cannot recover what
`JSON.parse` already rounded away. TikTok types `comment_id` / `video_id` / `parent_comment_id`
as JSON **numbers** in webhook payloads, and they are 19 digits — so in production this would
have replied to a non-existent comment and written a corrupted deduplication key.

### The fix — `src/lib/losslessJson.ts`

No new dependency; the project had none suitable, and the scope is deliberately narrow:
**only TikTok webhook payloads**. `JSON.parse` is not replaced anywhere else.

Two paths, both tested, producing identical results:

1. **Native** — `JSON.parse` reviver source access (V8 *json-parse-with-source*, Node ≥ 22).
   The reviver's third argument carries `context.source`: the exact original text of the value,
   captured before any float conversion.

   ```ts
   const reviver = (key, value, context) => {
     if (fields.includes(key) && typeof value === "number" &&
         context && typeof context.source === "string" && /^-?\d+$/.test(context.source)) {
       return context.source;          // exact text, e.g. "6990565363377392901"
     }
     return value;
   };
   ```

2. **Fallback** — for runtimes without it, allow-listed id fields are quoted in the raw text
   before parsing:

   ```ts
   new RegExp(`(?<!\\\\)"(${names})"(\\s*:\\s*)(-?\\d+)(?=\\s*[,}\\]])`, "g")
   ```

   The `(?<!\\)` guard means an **escaped** quote — which is how a quote appears inside a JSON
   string — never starts a match, so a comment whose own text contains `"comment_id":123`
   cannot be rewritten.

3. **Guard** — `idToString()` **throws** `unsafe_integer_id` if an id ever arrives as an unsafe
   Number. A precision loss fails loudly instead of silently replying to the wrong comment.

Allow-list: `comment_id`, `video_id`, `parent_comment_id`, `item_id`.
Internal types: `commentId: string`, `videoId: string`, `parentCommentId: string | null`.

### Applied at the parsing boundary — `src/services/tiktokWebhook.ts`

```ts
envelope = parseJsonLossless<WebhookEnvelope>(rawBody, TIKTOK_ID_FIELDS);
// `content` is a JSON-ENCODED STRING — parsed a second time; the large ids live here
content  = parseJsonLossless<Record<string, unknown>>(envelope.content, TIKTOK_ID_FIELDS);
commentId = idToString(content.comment_id);   // throws if precision was already lost
```

There is no longer any `JSON.parse` call in the TikTok webhook path.

---

## 2. Issue 2 — durable processing

### Did a durable mechanism already exist? **Yes**

Inspection of the existing architecture found one: the Meta bot parks work in `bot_reply_log`
with `public_status = 'deferred'` and drains it from a cron (`drainDeferred`). It is a
Supabase-backed durable queue that already lives in the same table that owns deduplication.

So **no new queue system was introduced** — no Redis, SQS, Kafka, and no new queue table.
TikTok reuses that pattern with its own status value.

### Lifecycle

```
TikTok
  ↓ HTTPS POST
/api/tiktok/webhook/
  ↓ 1. raw body (never JSON.parse first)
  ↓ 2. HMAC-SHA256 over `t + "." + rawBody`, constant-time, then freshness
  ↓ 3. lossless parse + nested content parse + id normalisation
  ↓ 4. DURABLE INTAKE → insert bot_reply_log row, public_status = 'queued'
  ↓ 5. HTTP 200  (only now)
  ├─ inline fast path (optimisation only, may be killed safely)
  └─ cron /api/tiktok/cron/poll → drainQueuedTikTokEvents() → reconciliation sweep
        ↓
     processClaimedComment() → existing bot rule engine → reply
```

Row lifecycle: `queued → processing → sent | skipped | failed`.
Meta's drain selects strictly `'deferred'`, so it can never pick up a TikTok row.

### The durable record

Stored on the `bot_reply_log` row: `comment_id` (exact text), `post_id` (video id), `page_id`
(= `open_id` = `business_id`), `comment_message` (text), `commenter_name`
(`unique_identifier`), `event_action`, `event_type`, `received_at`, `attempts`,
`processed_at`, `public_status`, `error`, `config_id`.

**No access token, refresh token or secret is ever written into a queue row** — asserted by test.

---

## 3. Deduplication — one authority

The durable record **is** the deduplication claim. The webhook's enqueue inserts the very row
that the reconciliation poll competes for, and the authority is the pre-existing constraint:

```sql
comment_id text not null unique      -- supabase/bot-tables.sql
```

| Scenario | Result |
|---|---|
| Same webhook delivered twice | 2nd insert → `23505` → outcome `duplicate` → **no second job, no second reply** |
| Webhook and poll find the same comment | One insert wins; the loser stops at the unique violation → **one reply** |
| Killed invocation after 200 | Row stays `queued`/`processing` → cron drain completes it |

Both paths then call the same `processClaimedComment()`, so the reply cannot differ by
discovery path. No second uniqueness rule was added anywhere — verified by test against the
migration file.

---

## 4. Acknowledgement policy — `src/lib/tiktokAck.ts`

| Outcome | HTTP | Retry asked? |
|---|---|---|
| `queued` (durably stored) | 200 | no |
| `duplicate` (already stored) | 200 | no |
| `unknown_account`, `not_actionable`, `ignored_event`, `ignored_action`, `unparseable` | 200 | no |
| **`storage_unavailable`** (valid event we could not store) | **503** | **yes** |
| invalid signature / stale timestamp | 401 | no |

200 is returned only **after** durable intake. "Return 200 then keep working" is no longer the
reliability mechanism — the inline processing that follows is purely a latency optimisation.

---

## 5. Security order (unchanged, re-asserted by tests)

1. `req.text()` — raw body
2. read `Tiktok-Signature`
3. verify HMAC against the **raw** body (constant-time)
4. verify timestamp freshness
5. lossless JSON parse
6. parse nested `content`
7. normalise ids to exact strings
8. durable enqueue
9. acknowledge

Never logged: access tokens, refresh tokens, client secret, authorization codes, OAuth state,
the HMAC secret, or the raw body.

---

## 6. Files changed

**New (5)**

| File | Purpose |
|---|---|
| `src/lib/losslessJson.ts` | Lossless id parsing (native + fallback), `idToString` guard. Zero imports |
| `src/lib/tiktokAck.ts` | Acknowledgement policy. Zero imports |
| `src/services/tiktokEvents.ts` | `enqueueCommentEvent`, `processQueuedComment`, `drainQueuedTikTokEvents` |
| `supabase/tiktok-webhook-queue.sql` | Migration — **not applied** |
| `tests/tiktok/lossless.test.mjs`, `tests/tiktok/ack.test.mjs` | 28 new tests |

**Modified (5)**

| File | Change |
|---|---|
| `src/services/tiktokWebhook.ts` | Lossless parsing + precision guard; no `JSON.parse` left in the path |
| `src/app/api/tiktok/webhook/route.ts` | Durable enqueue **before** acknowledgement; 503 on storage failure |
| `src/services/tiktokEngine.ts` | Extracted shared `processClaimedComment`; exported `loadTarget` / `TikTokTarget` |
| `src/app/api/tiktok/cron/poll/route.ts` | Drains queued events first, then reconciles |
| `tests/tiktok/{static,live}.test.mjs` | New assertions for both fixes |

The two zero-import libraries are deliberate: tests import the TypeScript source directly
(Node type-stripping), so the critical logic is unit-tested rather than only asserted statically.

---

## 7. Migration — created, **NOT applied**

`supabase/tiktok-webhook-queue.sql` (additive, idempotent, run **after** the three earlier files):

```sql
alter table bot_reply_log add column if not exists event_action text;
alter table bot_reply_log add column if not exists event_type   text;
alter table bot_reply_log add column if not exists received_at  timestamptz;
alter table bot_reply_log add column if not exists processed_at timestamptz;
alter table bot_reply_log add column if not exists attempts     int not null default 0;

create index if not exists idx_bot_reply_log_queued
  on bot_reply_log (public_status, created_at)
  where public_status in ('queued', 'processing');
```

All columns are nullable and unused by Meta code paths. **No new unique constraint** — the
deduplication key remains the existing `comment_id` unique constraint.

---

## 8. Tests — 91 total, all passing

| Suite | Tests | Result |
|---|---|---|
| `tests/tiktok/lossless.test.mjs` | 21 | ✅ |
| `tests/tiktok/ack.test.mjs` | 7 | ✅ |
| `tests/tiktok/static.test.mjs` | 41 | ✅ |
| `tests/tiktok/live.test.mjs` | 22 | ✅ |

```bash
node --test tests/tiktok/lossless.test.mjs
node --test tests/tiktok/ack.test.mjs
node --test tests/tiktok/static.test.mjs
# live suite needs a server:
TIKTOK_CLIENT_SECRET=phase22-test-secret npx next dev -p 3212
node --test tests/tiktok/live.test.mjs
```

### The 12 requested items

| # | Requirement | Result |
|---|---|---|
| 1 | 19-digit `comment_id` survives exactly | ✅ both parse paths + end-to-end over HTTP |
| 2 | 19-digit `video_id` survives exactly | ✅ |
| 3 | `parent_comment_id` survives exactly | ✅ |
| 4 | Malformed nested content rejected safely | ✅ throws `SyntaxError`; route acks without retry |
| 5 | Duplicate webhook → no duplicate job | ✅ unique violation → `duplicate` |
| 6 | Duplicate webhook → no duplicate reply | ✅ same single claim |
| 7 | Invalid signature → 401 | ✅ incl. a signature computed over re-serialised JSON |
| 8 | Stale signature → 401 | ✅ |
| 9 | Valid signature + durable enqueue → 200 | ✅ |
| 10 | Enqueue failure never reports success | ✅ `storage_unavailable` → 503 |
| 11 | No token stored in webhook jobs | ✅ enqueue block asserted token-free |
| 12 | Polling and webhook converge on one dedup | ✅ same constraint, same `processClaimedComment` |

**Test-design notes worth keeping:**
- The 19-digit live test builds raw JSON **by hand** — `JSON.stringify` of a JS number would
  destroy the id before it left the test, proving nothing.
- One test asserts the naive parse **is** lossy, so the suite fails if anyone reverts to
  `JSON.parse`.
- Static assertions strip comments before matching, so documentation text cannot make a test
  pass or fail.

---

## 9. Build

`✓ Compiled successfully in 18.0s`; all six TikTok routes registered.
`tsc --noEmit`: clean except one **pre-existing, unrelated** error (`src/app/bot/page.tsx:98`).
ESLint: clean on all changed files.
(One build attempt failed on a transient Google Fonts fetch — environmental; passed on retry.)

---

## 10. Remaining blockers before Developer Portal setup

1. **Four migrations unapplied**, in order:
   `security-rate-limits.sql` → `tiktok-oauth-phase1.sql` → `tiktok-phase2-2.sql` →
   `tiktok-webhook-queue.sql`.
2. No TikTok developer app and no credentials — nothing here is proven against production.
3. Still unexecutable until the tables exist: expired-state, reused-state and browser-RLS tests
   (Phase 2.2 items 3, 4, 7).
4. Unchanged from Phase 2.2: `skipTrailingSlashRedirect` means trailing-slash URLs site-wide
   serve 200 directly instead of 308-canonicalising to the bare path.
5. All work is **uncommitted** (backed up outside the repo).

---

## Final status

**IMPLEMENTED** — lossless id parsing with a precision guard, durable webhook intake on the
existing Supabase-backed mechanism, single deduplication authority, retry-correct
acknowledgement policy, cron drain plus reconciliation, 91 tests.

**REQUIRES DEVELOPER PORTAL CONFIGURATION** — authorization URL, redirect URL, app logo,
permission scopes, webhook registration.

**REQUIRES REAL TIKTOK CREDENTIALS** — every outbound TikTok call and every real webhook
delivery.

No TikTok API call has been made. No production connection has been demonstrated.
