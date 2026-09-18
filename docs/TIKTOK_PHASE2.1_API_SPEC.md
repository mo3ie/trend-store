# TikTok Organic Accounts API — Final Field-Level Specification (Phase 2.1)

**Date:** 2026-09-16 · **Status:** documentation only. No code modified, no DB touched, no app
created, no credentials, no TikTok API called.
**Source of truth:** official TikTok API for Business v1.3 documentation, retrieved first-party.

---

## 0. How this was obtained (and why it is now VERIFIED)

The previous pass could only reach SEO metadata because the docs portal is a JS-rendered SPA. This
pass located the portal's own public content API — the one the documentation site itself calls:

```
GET https://business-api.tiktok.com/gateway/api/doc/client/platform/tree/get/?identify_key=<k>&language=ENGLISH
GET https://business-api.tiktok.com/gateway/api/doc/client/node/get/v2/?identify_key=<k>&doc_id=<id>&language=ENGLISH
```

It returns each page's full markdown. **31 official pages (~280 KB)** were retrieved and are the
basis of every line below. Nothing here is inferred from Login Kit, tutorials or third parties.

`VERIFIED` below means the exact field-level detail was read from that official page.

---

## 1. Corrections — your correction was right, and two more of my earlier claims were wrong

| # | My earlier claim (Phase 2 report) | Verified reality |
|---|---|---|
| 1 | `/business/comment/*` belongs to the **Ad Comments** family | **WRONG — you were right.** `/business/comment/list/`, `/reply/list/`, `/create/`, `/reply/create/`, `/like/`, `/hide/`, `/delete/` are **organic Accounts API** endpoints. Ad Comments is the separate `/comment/list/`, `/comment/status/update/`, `/comment/reference/` family under "Ad Comments" |
| 2 | The scopes `user.info.basic`, `video.list`, `comment.list`, `comment.list.manage` are "Login Kit-style, wrong model" | **WRONG.** These are the real Accounts API token scope strings — they appear verbatim in the official `/tt_user/oauth2/token/` response example, and `comment.list` is named as the prerequisite for `comment.update` webhooks |
| 3 | `/tt_user/oauth2/token/` + `/tt_user/oauth2/refresh_token/` are unverified/likely wrong | **They are correct**, exactly as the old code had them |
| 4 | `business_id = open_id` is an unverified assumption | **VERIFIED CORRECT** — every organic endpoint says: *"business_id … Pass the value of the `open_id` field returned in the response of /tt_user/oauth2/token/"* |

**What was genuinely wrong in our code:** the authorization URL construction, the hide endpoint, and
the polling-only architecture. Details in §J.

---

## 2. K. FINAL TABLE

| Feature | Official Endpoint | Method | Permission | Identifier | Verified? |
|---|---|---|---|---|---|
| Authorization | Portal-generated **TikTok account holder authorization URL** (My Apps → App Detail → Basic Information) — not developer-constructed | Browser GET | App scope must include **TikTok Accounts** | — | ✅ VERIFIED |
| Token exchange | `https://business-api.tiktok.com/open_api/v1.3/tt_user/oauth2/token/` | POST | — | returns `open_id` | ✅ VERIFIED |
| Refresh | `…/open_api/v1.3/tt_user/oauth2/refresh_token/` | POST | — | returns `open_id` | ✅ VERIFIED |
| Revoke | `…/open_api/v1.3/tt_user/oauth2/revoke/` | POST | — | `access_token` | ✅ VERIFIED |
| Token scopes introspection | `…/open_api/v1.3/tt_user/token_info/get/` | POST | — | `app_id` + `access_token` | ✅ VERIFIED |
| Profile | `…/open_api/v1.3/business/get/` | GET | Get Business User Basic Info (`18010100`) / `user.info.basic` | `business_id` | ✅ VERIFIED |
| Videos | `…/open_api/v1.3/business/video/list/` | GET | Business Media (`18020000`) / `video.list` | `business_id` | ✅ VERIFIED |
| List comments | `…/open_api/v1.3/business/comment/list/` | **GET** | Get Business Comment (`18030100`) / `comment.list` | `business_id` + `video_id` | ✅ VERIFIED |
| List replies | `…/open_api/v1.3/business/comment/reply/list/` | **GET** | Get Business Comment (`18030100`) / `comment.list` | `business_id` + `video_id` + `comment_id` | ✅ VERIFIED |
| Create comment | `…/open_api/v1.3/business/comment/create/` | POST | Manage Business Comment (`18030200`) / `comment.list.manage` | `business_id` + `video_id` | ✅ VERIFIED |
| Reply | `…/open_api/v1.3/business/comment/reply/create/` | POST | Manage Business Comment (`18030200`) | `business_id` + `video_id` + `comment_id` | ✅ VERIFIED |
| Like/unlike | `…/open_api/v1.3/business/comment/like/` | POST | Manage Business Comment (`18030200`) | `business_id` + `comment_id` | ✅ VERIFIED |
| Hide/unhide | `…/open_api/v1.3/business/comment/hide/` | POST | Manage Business Comment (`18030200`) | `business_id` + `comment_id` + `video_id` | ✅ VERIFIED |
| Delete | `…/open_api/v1.3/business/comment/delete/` | POST | Manage Business Comment (`18030200`) | `business_id` + `comment_id` | ✅ VERIFIED |
| Webhook subscription | `…/open_api/v1.3/business/webhook/update/` | POST | TikTok Accounts → **Business Comment** | `app_id` + `secret` (app-level) | ✅ VERIFIED |
| Webhook event | `comment.update` delivered to your `callback_url` | HTTPS POST (inbound) | account must have granted `comment.list` | `user_openid` in payload | ✅ VERIFIED |
| Webhook verification | `Tiktok-Signature: t=<unix>,s=<hmac>` — HMAC-SHA256 of `t + "." + JSON(body)` keyed by app secret, hex | — | — | ✅ VERIFIED |
| Rate limits | 40 QPM per authorized account per endpoint; 600 QPM (Basic tier) for all Accounts endpoints per app | — | — | — | ✅ VERIFIED |

---

## 3. A. AUTHORIZATION — VERIFIED

Source: *Authorization* (doc 1738083939371009), *TikTok account holder redirect URL configuration*
(1832209711206401).

**The authorization URL is not constructed by us.** It is issued by the portal:
`My Apps → App Detail → Basic Information → TikTok account holder authorization URL`. Its visibility
requires the **TikTok Accounts** permission to be selected under `Authorization → Scope of permission`.

- **App identifier:** the portal embeds it. The token endpoints use **`client_id`** = the App ID
  (`My Apps → App Detail → Basic Information`). `/tt_user/token_info/get/` uses **`app_id`** for the
  same value — the naming is inconsistent between endpoints; both are documented.
- **`client_key` is not used anywhere in the Accounts API flow** (that is a Login Kit concept).
- **Scope parameter:** not appended by us — the granted scopes come from the app's permission scope
  and are returned in the token response as a comma-separated string.
- **`state`:** supported and explicitly recommended. Because query parameters are forbidden in the
  redirect URL, TikTok's own migration guidance is to encode what you need as JSON in `state`
  (e.g. `&state={"source":"tiktok"}`) and decode it in the callback.
- **Callback parameters:** the redirect carries `auth_code` as a query parameter, plus `state` if it
  was provided.
- **`auth_code` lifetime: 10 minutes. Single-use: YES** — *"The code is valid for 10 minutes and can
  only be used once."*
- **Accounts vs Marketing API:** different flows. Accounts uses the TikTok-account-holder URL +
  `/tt_user/oauth2/*`; Marketing uses the advertiser flow + `/oauth2/access_token/`.

### ⚠️ Redirect URL formatting rules (VERIFIED — this blocks us today)

| # | Rule |
|---|---|
| 1 | Must be absolute and **end with `/`** |
| 2 | **No query parameters** |
| 3 | **No anchors** (`#`) |
| 4 | Must start with **`https://`** |
| 5 | **No ports** |
| 6 | Registered URI length 10–512 characters |

**Impact:** our planned `https://www.trendstore-ly.com/api/tiktok/callback` is **invalid** — it must
be registered as `https://www.trendstore-ly.com/api/tiktok/callback/` (trailing slash), and the same
exact string must be sent as `redirect_uri` in the token call. Next.js defaults to
`trailingSlash: false`, which 308-redirects `/callback/` → `/callback`; the browser follows it and
preserves the query, but the cleanest fix is an explicit rewrite so the trailing-slash form is served
directly. **Decide this before registering the URL — it is registered once and matched exactly.**

---

## 4. B. TOKEN EXCHANGE — VERIFIED

### Obtain (`POST /open_api/v1.3/tt_user/oauth2/token/`)
Header: `Content-Type: application/json` (required).

| Field | Required | Notes |
|---|---|---|
| `client_id` | ✅ | App ID |
| `client_secret` | ✅ | App secret |
| `grant_type` | ✅ | `"authorization_code"` |
| `auth_code` | ✅ | 10-minute, single-use |
| `redirect_uri` | ✅ | must equal the registered TikTok account holder redirect URL |

Response envelope: `code`, `message`, `request_id`, `data{}`; inside `data`:
`access_token`, `token_type` (`Bearer`), `scope` (comma-separated string), `expires_in`,
`refresh_token`, `refresh_token_expires_in`, `open_id`.

**Lifetimes (VERIFIED):** access token **1 day** (`expires_in: 86400`); refresh token **1 year**
(`refresh_token_expires_in: 31536000`). When the refresh token expires the user must re-authorize.

Example `scope` from the official response: `message.list.manage,video.list,video.insights,
user.insights,user.info.basic,comment.list,…,comment.list.manage,video.upload,video.publish,…`

### Renew (`POST …/tt_user/oauth2/refresh_token/`)
Body: `client_id`, `client_secret`, `grant_type: "refresh_token"`, `refresh_token` — all required.
Response: identical shape to obtain (including a fresh `refresh_token`).

### Revoke (`POST …/tt_user/oauth2/revoke/`)
Body: `client_id`, `client_secret`, `access_token` — all required. Returns `data: {}`.

### Long-term access token — **NOT applicable to us (VERIFIED)**
`/oauth2/access_token/` and `/oauth/token/` produce a non-expiring token, but only *"after receiving
authorization from an ad account, a Business Center account, or a TikTok One Creator Marketplace
account."* It is not part of the TikTok-account (`tt_user`) flow. **Trend must use short-term token +
refresh.** Revocation for that family is `/oauth2/revoke_token/` (different from `/tt_user/oauth2/revoke/`).

---

## 5. C. IDENTIFIERS — VERIFIED

- `open_id` — *"Application specific unique ID of the TikTok account"*, returned by the token
  endpoints. It is **app-scoped**: the same TikTok user has a different `open_id` per developer app.
- `business_id` — required by every organic endpoint, documented as *"Application specific unique
  identifier for the TikTok account. **Pass the value of the `open_id` field returned in the response
  of /tt_user/oauth2/token/**"*. → **`business_id` is populated from `open_id`.** Confirmed on
  `/business/get/`, `/business/video/list/`, `/business/comment/list/`, `/business/comment/reply/list/`.
- `unique_identifier` — *"A globally unique identifier assigned to each user commenting … consistent
  across different APIs"*. This identifies the **commenter**, not the account owner. It is the correct
  key for cross-referencing a commenter between the list API and the webhook.
- `user_id` in comment objects — marked **to-be-deprecated**; do not use.
- `union_id` — **NOT VERIFIED**: it does not appear in any Accounts API page retrieved. Do not use it.
- Webhook payloads identify the account by **`user_openid`** (= the account's `open_id`).

Per-endpoint identifier: see the table in §2 — every organic endpoint takes `business_id`; comment
endpoints additionally take `video_id` and/or `comment_id`; `/business/comment/like/` and
`/delete/` take `business_id` + `comment_id` only.

---

## 6. D. PROFILE — `/business/get/` (VERIFIED)

`GET https://business-api.tiktok.com/open_api/v1.3/business/get/`
Header: `Access-Token` (required).

| Param | Required | Notes |
|---|---|---|
| `business_id` | ✅ | = `open_id` |
| `fields` | optional | JSON array in the query string, e.g. `["username","display_name","profile_image"]` |
| `start_date` / `end_date` | optional | for the analytics fields |

Response fields are annotated **per field with the scope they require** (e.g. `display_name`,
`profile_image`, `username` → `user.info.basic`). No pagination.

Official example:
```
GET /open_api/v1.3/business/get/?business_id=<open_id>&fields=["username","display_name","shares","comments","video_views","audience_countries"]&start_date=2021-07-28&end_date=2021-08-01
Access-Token: <token>
```

## 7. E. MEDIA — `/business/video/list/` (VERIFIED)

`GET …/open_api/v1.3/business/video/list/` · Header: `Access-Token`.

| Param | Required | Notes |
|---|---|---|
| `business_id` | ✅ | = `open_id` |
| `fields` | optional | JSON array; **default is `["item_id"]`**, and multi-field requests must include `"item_id"` |
| `cursor`, `max_count`, `filters` | optional | pagination/filtering (page-size bounds: ⛔ not captured in this pass — read the page before finalising) |

Post identifier is **`item_id`**. Available fields include `item_id`, `create_time`,
`thumbnail_url`, `share_url`, `embed_url`, `caption`, `video_views`, `likes`, `comments`, `shares`,
`reach`, `video_duration`, `full_video_watched_rate`, `total_time_watched`, `average_time_watched`,
`impression_sources`, `audience_countries`.

⚠️ The comment endpoints take **`video_id`**, sourced from `item_id` here — the naming differs
between the two APIs.

---

## 8. F. ORGANIC COMMENTS — all VERIFIED

Common headers: `Access-Token` (required, all); `Content-Type: application/json` (required on POSTs).
All operate on **owned organic videos** (photo posts and public video posts, published via API or
manually in the TikTok app).

### `/business/comment/list/` — **GET**
Params: `business_id` ✅, `video_id` ✅, `comment_ids` (string[], max 30), `include_replies` (boolean),
`status` (`PUBLIC` | `ALL` …), `sort_field` (`likes` | `replies` | `create_time`), `sort_order`
(`asc` | `desc`), `cursor` (integer), `max_count` (integer, default 20, min 1, **max 30**).

Returns both **public and hidden** comments. `parent_comment_id` is returned **only for replies** —
that is how you tell a comment from a reply.

Response `data`: `comments[]`, `cursor`, `has_more`.
Each comment: `comment_id` (**string**), `video_id` (string), `unique_identifier`, `create_time`
(Unix), `text`, `likes`, `replies`, `owner` (bool — did the video owner write it), `liked`, `pinned`,
`status` (`PUBLIC` | `HIDDEN`), `username`, `display_name`, `profile_image`, `parent_comment_id`
(replies only), `reply_list` (when `include_replies: true`), `user_id` *(to-be-deprecated)*.

**Pagination:** cursor-based — when `has_more` is true, pass the returned `cursor` on the next call.

### `/business/comment/reply/list/` — **GET**
Params: `business_id` ✅, `video_id` ✅, `comment_id` ✅, `status`, `sort_field`, `sort_order`,
`cursor`, `max_count` (default 20, max 30).

### `/business/comment/create/` — POST
Body: `{ business_id, video_id, text }` (+ optional `image_uri`, `image_width`, `image_height`).
Returns the new `comment_id`.

### `/business/comment/reply/create/` — POST
Body: `{ business_id, video_id, comment_id, text }` (+ optional image fields).
**This is the bot's reply call.**

### `/business/comment/like/` — POST
Body: `{ business_id, comment_id, action }` — **`action`, not a status field**; example value `"like"`.

### `/business/comment/hide/` — POST
Body: `{ business_id, comment_id, video_id, action }` — `action: "HIDE"` (uppercase in the official
example). **Note this takes `video_id`; like/delete do not.**

### `/business/comment/delete/` — POST
Body: `{ business_id, comment_id }`. The page is titled *"Delete an **owned** comment"* — i.e. comments
created by the authorized account. ⛔ Whether it can delete third-party comments is not stated
explicitly; assume owned-only.

**IDs are strings** in request/response bodies (example `6990565363377392901`). ⚠️ In the **webhook
payload** `comment_id` / `video_id` are typed **number** — normalise to string on ingest to avoid
JS precision loss on 19-digit IDs.

v1.2 → v1.3 changes (for reference): paths moved from `/business/comments/list/` →
`/business/comment/list/`, and list endpoints changed from **POST to GET**.

---

## 9. G. PERMISSIONS — VERIFIED mapping

Two representations exist and both are documented:

| Capability | Developer-App permission (portal UI) | Scope ID | Token `scope` string | Endpoints |
|---|---|---|---|---|
| Identify account / profile | TikTok Accounts → **Get Business User Basic Info** | `18010100` (parent `18010000`) | `user.info.basic` | `/business/get/` |
| Account media | TikTok Accounts → **Business Media** | `18020000` | `video.list` | `/business/video/list/` |
| Read comments | TikTok Accounts → Business Comment → **Get Business Comment** | `18030100` (parent `18030000`) | `comment.list` | `/business/comment/list/`, `/business/comment/reply/list/` |
| Manage comments | TikTok Accounts → Business Comment → **Manage Business Comment** | `18030200` (parent `18030000`) | `comment.list.manage` | `/business/comment/create/`, `/reply/create/`, `/like/`, `/hide/`, `/delete/` |
| Comment webhooks | TikTok Accounts → **Business Comment** | `18030000` | account must have granted `comment.list` | `/business/webhook/update/` with `event_type: COMMENT` |

Permissions are hierarchical (first/second/third level): granting a parent grants the children.
Numeric scope IDs are what the permission tables use; the **dotted strings are what the Accounts API
token returns** in `scope`. Your portal names map exactly: *Account User* → Get Business User Basic
Info, *Get Account Media* → Business Media, *Account Comment → Get/Manage* → Get/Manage Business
Comment.

**App review:** permission changes are self-service (My Apps → Scope of permission → edit → state a
reason), reviewed by TikTok in **2–3 business days**. No separate per-endpoint review track is
documented for these.

---

## 10. H. WEBHOOKS — VERIFIED

**Subscription (app-level, not per account):**
```
POST https://business-api.tiktok.com/open_api/v1.3/business/webhook/update/
Content-Type: application/json
{ "app_id": "...", "secret": "...", "event_type": "COMMENT", "callback_url": "https://…" }
```
`event_type`: `COMMENT` for comment updates (`VIDEO` for post-publishing). Optional **`item_list`**
restricts notifications to specific posts. Response echoes `app_id`, `callback_url`, `event_type`.
Companion endpoints: get configurations, delete configuration.

**Event — `comment.update`.** Fired **within five minutes** of a comment or reply being created,
deleted, or its visibility changed, on any photo post or public video post of an owned account —
including posts published manually in the TikTok app.

Delivery: **HTTPS POST, JSON**, to your callback URL. Envelope:
`client_key`, `event` (`"comment.update"`), `create_time`, `user_openid`, `content`
(**a JSON-encoded string** — must be parsed a second time).

`content` fields: `comment_id` (number), `video_id` (number), `parent_comment_id` (replies only),
`comment_type` (`comment` | `reply`), `comment_action` (**`insert` | `delete` | `set_to_hidden` |
`set_to_friends_only` | `set_to_public`**), `timestamp` (Unix), `unique_identifier`, `text`.

**Prerequisite:** the account owner must have granted `comment.list`, and the authorization must stay
valid — if it expires or is revoked, events stop.

**Verification (VERIFIED):** header `Tiktok-Signature: t=<unix seconds>,s=<hex hmac>`. Compute
`HMAC_SHA256(app_secret, t + "." + JSON.stringify(body))`, hex-encode, compare to `s`, then reject if
`now - t` exceeds your tolerance (TikTok's sample uses 5 seconds; pick your own). Other headers seen:
`webhook-schema-version: v1.0`, `user-agent: tiktok-webhook`, `x-tt-logid`.

⛔ **NOT VERIFIED:** retry policy, duplicate-delivery guarantees, acknowledgement/timeout
requirements, and whether a challenge handshake is performed on registration. Design defensively:
ack fast with 200, dedupe by `comment_id`, treat delivery as at-least-once.

### Can `comment.update` be the PRIMARY trigger for the bot? **Yes.**
1. Subscribe once per developer app: `event_type: COMMENT`, `callback_url = https://www.trendstore-ly.com/api/tiktok/webhook/`.
2. On delivery: verify signature → return 200 immediately → parse `content` → ignore unless
   `comment_action === "insert"` → map `user_openid` to our `tiktok_accounts` row.
3. Dedupe on `comment_id` (our `bot_reply_log.comment_id` UNIQUE constraint already does this).
4. Match rules against `text` (the webhook carries the text, so no extra read call is needed).
5. Reply via `/business/comment/reply/create/`.
6. Keep a **low-frequency reconciliation poll** (`/business/comment/list/`) because delivery is
   "within five minutes", at-least-once, and undocumented on retries.

---

## 11. I. RATE LIMITS — VERIFIED

- **40 QPM per authorized TikTok account, per Accounts API endpoint.**
- **Per developer app, all Accounts endpoints combined:** Basic **600 QPM**; Advanced / Premium /
  Ultimate **1,000 QPM**.
- Both limits apply simultaneously — the app-wide ceiling is shared across all our customers.
- ⛔ The exact rate-limited response code and retry guidance were not captured here; they live in the
  global *Rate limits* page and the Return Codes appendix.

**Implication:** our per-config `throttle_per_min` is the wrong control plane on its own. With Basic
at 600 QPM app-wide, roughly 15 accounts each running at 40 QPM would exhaust the app. A global
token-bucket shared across accounts is required, with the per-account cap layered under it.

---

## 12. J. FINAL ARCHITECTURE RECOMMENDATION

```
User on /tiktok-bot
  └─> GET /api/tiktok/oauth/start        (auth'd; Phase-1 state: 32B random, hashed, HttpOnly cookie,
                                          single-use, 10-min TTL) → redirect to the PORTAL-ISSUED
                                          TikTok account holder authorization URL + &state=<opaque>
        └─> user approves on TikTok
  └─> GET /api/tiktok/callback/          (registered redirect URL, trailing slash, no query params)
        ├─ verify session user + consume state (Phase 1, unchanged)
        ├─ POST /tt_user/oauth2/token/ { client_id, client_secret, grant_type, auth_code, redirect_uri }
        ├─ business_id := data.open_id
        ├─ store: tiktok_accounts (open_id, scopes from data.scope) +
        │         tiktok_tokens (AES-256-GCM: access 1d, refresh 1y)
        └─ GET /business/get/?business_id&fields=["username","display_name","profile_image"]

Runtime
  ├─ GET /business/video/list/?business_id&fields=["item_id","caption","create_time","thumbnail_url"]
  ├─ Webhook (PRIMARY): POST /api/tiktok/webhook/  ← comment.update
  │     verify Tiktok-Signature → 200 → parse content → action=insert → dedupe by comment_id
  │     → existing bot rule engine → POST /business/comment/reply/create/
  └─ Poll (BACKSTOP, every 15–30 min): GET /business/comment/list/ (cursor, max_count ≤ 30)

Token lifecycle
  ├─ access token 1 day → refresh under the Phase-1 refresh_lock_at claim
  ├─ refresh token 1 year → on expiry, force re-authorization
  └─ disconnect → POST /tt_user/oauth2/revoke/ then local teardown (Phase-1 plug-in point)
```

### What survives in `src/services/tiktok.ts`

| Function / constant | Verdict |
|---|---|
| `BASE = ".../open_api/v1.3"` | ✅ **Correct — keep** |
| `tt()` helper (Access-Token header, 200-with-nonzero-`code` = failure) | ✅ **Correct pattern — keep**; envelope is `code`/`message`/`request_id`/`data` |
| `exchangeTikTokCode` → `/tt_user/oauth2/token/` | ✅ **Path and fields correct — keep**; add `scope`, `refresh_token_expires_in`, `token_type` to the parsed result |
| `refreshTikTokToken` → `/tt_user/oauth2/refresh_token/` | ✅ **Correct — keep** |
| `getTikTokAccount` → `business/get/` | ✅ Path correct; verify `fields` values (`profile_image`, not `profile_image` alias) |
| `getTikTokVideos` → `business/video/list/` | ✅ Path correct; `fields` must include `item_id`; map `item_id` → `video_id` |
| `getTikTokComments` → `business/comment/list/` GET | ✅ Path/method correct; add `cursor`/`has_more` pagination, `include_replies`, `status`; `max_count` cap is **30** |
| `replyToTikTokComment` → `business/comment/reply/create/` | ✅ **Correct — keep** |
| `buildTikTokOAuthUrl` (`www.tiktok.com/v2/auth/authorize`, `client_key`, `scope=`) | ❌ **DELETE** — the URL is portal-issued; we only append `state` |
| `hideTikTokComment` → `business/comment/status/update/` with `comment_ids[]` | ❌ **REWRITE** → `POST /business/comment/hide/` `{ business_id, comment_id, video_id, action }` |
| — missing — | ➕ `revokeToken` (`/tt_user/oauth2/revoke/`), `getTokenInfo` (`/tt_user/token_info/get/`, uses `app_id`), `likeComment`, `createComment`, `deleteComment`, `getCommentReplies`, `webhook signature verify` |

### Assumptions to remove
1. "`scope` is a request parameter we choose" → it comes from app permissions, returned in the token.
2. "`client_key`" → it is `client_id` (and `app_id` on `token_info/get/`).
3. "Polling is the only option" → webhooks are primary.
4. "TikTok has no organic DM" (printed in our UI) → Comment-to-Message exists; **remove or correct
   that sentence**. Business Messaging stays **completely separate for now** — its own authorization
   and authentication flow, its own webhook configuration; not in this phase.
5. "Per-account throttle is sufficient" → app-wide QPM ceiling governs.

**Polling remains necessary** as a reconciliation backstop: 5-minute event latency, at-least-once
delivery, undocumented retry behaviour, and events stop silently if an authorization lapses.

---

## 13. Contradictions with the official endpoint index

| Item | Status |
|---|---|
| Your correction that `/business/comment/*` are Organic Accounts endpoints | **Confirmed by the official docs.** My earlier classification was wrong and is retracted |
| Ad Comments family = `/comment/list/`, `/comment/status/update/`, `/comment/reference/` | Confirmed — a separate "Ad Comments" section (Get comments, Get related comments, Update the statuses of comments, Reply to a comment, Delete a comment, comment export tasks) |
| Your list included `/business/comment/reply/list/` | Confirmed, GET |
| No contradiction found between your index and the documentation retrieved | — |
| One nuance: `/business/comment/hide/` takes `video_id` while `/like/` and `/delete/` do not | Worth noting for the implementation |

---

## 14. Remaining ⛔ items (small, and none block design)

1. `/business/video/list/` page-size bounds and `filters` schema.
2. Rate-limited HTTP/response code + retry guidance (Return Codes appendix).
3. Webhook retry / duplicate-delivery / ack-timeout semantics; registration challenge (if any).
4. Whether `/business/comment/delete/` can remove third-party comments.
5. `union_id` — absent from Accounts API docs; treat as not applicable.

All five are read-only lookups on pages already identified; none changes the architecture above.
