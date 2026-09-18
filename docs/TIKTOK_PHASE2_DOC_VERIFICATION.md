# TikTok Phase 2 — Documentation Verification Report

**Date:** 2026-09-16 · **Scope:** documentation only. No code implemented, no app created, no
credentials added, no TikTok API called, no database touched.

---

## 0. Method and evidence rules — read this first

The TikTok API for Business documentation portal is a JavaScript-rendered single-page app. Its
pages return **only SEO metadata** to any server-side fetch; the endpoint body (paths, fields,
scopes, responses) is loaded client-side from an internal API.

Proven, not assumed:

```
GET https://business-api.tiktok.com/portal/docs/reply-to-a-comment/v1.3   → 200, 36 KB
__NEXT_DATA__ payload = 572 bytes total:
  {"props":{"pageProps":{"seoTitle":"Reply to a comment | TikTok API for Business",
   "seoDescription":"Use this endpoint to reply to a comment. ..."}},
   "page":"/docs/[slug]/[version]", ...}
```

The same is true of `/portal/docs?id=…` and `/gateway/docs/index?…`. No sitemap-linked page
exposes a body server-side.

**Therefore this report uses two strict confidence levels:**

| Level | Meaning |
|---|---|
| ✅ **VERIFIED** | Retrieved first-party from `business-api.tiktok.com`: the page exists today at the stated URL, with the stated official title and official description (quoted verbatim from the page's own metadata), and it is listed in the official sitemap `https://business-api.tiktok.com/portal/sitemap.xml` (1,117 URLs, 1,113 v1.3 doc slugs). |
| ⛔ **NOT VERIFIED** | Could not be retrieved: exact request path, HTTP method, parameter names, response fields, scope strings, pagination parameters, app-review requirements. |

**Nothing in this report is guessed.** Where the answer is unknown it says NOT VERIFIED, and
§10 gives the exact way to close each gap. Per your instruction, no Login Kit assumption, no
tutorial, no third-party source and no unofficial API was used.

---

## 1. Headline findings (these change the architecture)

1. **Organic comment webhooks exist.** The old "TikTok has no comment webhook, therefore poll"
   premise is **outdated**. ✅ `comment-update-event` is live today and its official description
   reads: *"The comment update event is triggered within minutes of a comment or reply being
   created, deleted, or the comment visibility settings being modified on a post."*
2. **We were likely pointed at the wrong API family.** There are two distinct comment APIs:
   **Ad Comments API** (comments on *video ads of an ad account*) and the **Accounts API**
   organic endpoints (comments on *owned organic videos*). Our use case is organic; the endpoints
   in `src/services/tiktok.ts` do not correspond to any organic documentation page.
3. **"TikTok has no organic DM" is probably wrong.** ✅ A **Comment-to-Message** feature exists
   for Business Accounts, plus a Direct messages API. This claim is currently printed to users in
   our UI and must be verified before Phase 2.
4. **Two token classes, not one.** ✅ Short-term *and* long-term access tokens, each with its own
   obtain/renew/revoke pages. Our single `expires_in` + refresh model is too simple.
5. **Revoke endpoints exist** ✅ — the Phase 1 disconnect plug-in point can be filled properly.
6. **Rate limits are per developer app**, not per account ✅ — our per-account throttle is not the
   limit that will actually bind us.

---

## 2. Final output table

`Status` refers to what this verification pass could establish, not to TikTok's own status.

| Feature | Current official documentation page | Permission | Status | Notes |
|---|---|---|---|---|
| Organic API scope | `/portal/docs/organic-api/v1.3` | — | ✅ exists | *"enables developers to build tools for brands to manage their organic presence"* |
| Accounts API overview | `/portal/docs/accounts-api/v1.3` | — | ✅ exists | *"manage and report on Business Account and Personal Account activity"* |
| Accounts API reference index | `/portal/docs/accounts-api-guide-api-reference/v1.3` | — | ✅ exists | **The index of all Accounts endpoints — read this first in Phase 2** |
| Authorization (Accounts) | `/portal/docs/accounts-api-authorization/v1.3` | — | ✅ exists | *"you need to first get authorization from the business to manage their accounts"* |
| Authentication (Accounts) | `/portal/docs/accounts-api-authentication/v1.3` | — | ✅ exists | *"With the authorization code … you can make a request to get a TikTok account access token"* |
| Redirect URL rules | `/portal/docs/tiktok-account-holder-redirect-url-configuration/v1.3` | — | ✅ exists | *"The redirect URL is a critical component in the authorization framework"* |
| Obtain short-term access token | `/portal/docs/obtain-a-short-term-access-token/v1.3` | ⛔ | ✅ exists | Exact path/fields ⛔ |
| Obtain long-term access token | `/portal/docs/obtain-a-long-term-access-token/v1.3` | ⛔ | ✅ exists | *"Use one of the two endpoints"* — two routes to a long-term token |
| Renew short-term token | `/portal/docs/renew-a-short-term-access-token/v1.3` | ⛔ | ✅ exists | *"renew a short-term access token by refresh token"* |
| Revoke short-term token | `/portal/docs/revoke-a-short-term-access-token/v1.3` | ⛔ | ✅ exists | Needed for disconnect |
| Revoke long-term token | `/portal/docs/revoke-a-long-term-access-token/v1.3` | ⛔ | ✅ exists | Needed for disconnect |
| Get granted scopes from token | `/portal/docs/get-the-authorized-tiktok-account-permission-scopes-via-access-token/v1.3` | ⛔ | ✅ exists | Populates `tiktok_accounts.granted_scopes` |
| Permission scope model | `/portal/docs/permission-scope/v1.3` | — | ✅ exists | *"permissions consist of three levels: first level, second level, and third level"* |
| App permissions ↔ endpoints | `/portal/docs/app-permissions/v1.3` | — | ✅ exists | *"how to check the App permission that an endpoint corresponds to"* — **the scope-mapping page you asked for** |
| Get profile data | `/portal/docs/get-profile-data-of-a-tiktok-account/v1.3` | ⛔ | ✅ exists | *"analytics and insights about a TikTok account's follower base and profile engagement"* |
| Get account media | `/portal/docs/get-post-data-of-a-tiktok-account/v1.3` | ⛔ | ✅ exists | *"reach and engagement data for all the public video, photo, or text posts"* |
| Post privacy settings | `/portal/docs/get-the-post-privacy-settings-of-a-tiktok-account/v1.3` | ⛔ | ✅ exists | |
| **Comments guide (organic)** | `/portal/docs/manage-comments-on-owned-tiktok-videos/v1.3` | ⛔ | ✅ exists | *"including the use cases, relevant endpoints, and the required parameters"* — **the single most important page for us** |
| List comments on owned video | `/portal/docs/get-comments-on-an-owned-video/v1.3` | ⛔ | ✅ exists | *"all the comments or only the specified comments created against a specific organic video posted by an owned TikTok account"* |
| List replies to a comment | `/portal/docs/get-all-replies-to-a-comment/v1.3` | ⛔ | ✅ exists | *"all replies to a specific comment … on an organic video posted by an owned TikTok account"* |
| Reply to a comment (organic) | `/portal/docs/reply-to-an-existing-comment-on-an-owned-video/v1.3` | ⛔ | ✅ exists | *"…on an organic video posted by an owned TikTok account **or others' TikTok account**"* |
| Create a new comment | `/portal/docs/create-a-new-comment-on-an-owned-video/v1.3` | ⛔ | ✅ exists | |
| Like / unlike a comment | `/portal/docs/likeunlike-an-existing-comment-on-an-owned-video/v1.3` | ⛔ | ✅ exists | Single endpoint covers both |
| Hide / unhide a comment | `/portal/docs/hideunhide-an-existing-comment-on-an-owned-video/v1.3` | ⛔ | ✅ exists | Single endpoint covers both |
| Delete a comment | `/portal/docs/delete-an-existing-comment-on-an-owned-video/v1.3` | ⛔ | ✅ exists | *"delete an **owned** comment"* — likely only our own comments |
| **Ad Comments API (different family)** | `/portal/docs/ad-comments/v1.3` | ⛔ | ✅ exists | Reference index for ad comments |
| — get comments (ads) | `/portal/docs/get-comments/v1.3` | ⛔ | ✅ exists | *"comments under the **video ads of an ad account**"* — **not our use case** |
| — reply to a comment (ads) | `/portal/docs/reply-to-a-comment/v1.3` | ⛔ | ✅ exists | ads family |
| — update comment statuses (ads) | `/portal/docs/update-the-statuses-of-comments/v1.3` | ⛔ | ✅ exists | *"change the statuses of a list of comments from public to hidden"* |
| — delete a comment (ads) | `/portal/docs/delete-a-comment/v1.3` | ⛔ | ✅ exists | ads family |
| **Accounts Webhooks guide** | `/portal/docs/accounts-api-webhooks-guide/v1.3` | ⛔ | ✅ exists | *"Webhooks are automated HTTP callbacks … triggered when specific events occur"* |
| Webhook event types | `/portal/docs/webhook-event-types/v1.3` | ⛔ | ✅ exists | *"two main categories …: Post publishing events and Comment updates events"* |
| **Comment update event** | `/portal/docs/comment-update-event/v1.3` | ⛔ | ✅ exists | *"triggered within minutes of a comment or reply being created, deleted, or the comment visibility settings being modified"* |
| Webhook verification | `/portal/docs/webhook-verification/v1.3` | ⛔ | ✅ exists | Verification method ⛔ |
| Webhooks API reference (Accounts) | `/portal/docs/accounts-api-webhooks-reference/v1.3` | ⛔ | ✅ exists | |
| Subscribe to account webhooks | `/portal/docs/subscribe-to-tiktok-account-webhook-events-via-webhooks-api/v1.3` | ⛔ | ✅ exists | *"notifications for TikTok post publishing status and comment updates"* |
| Create/update webhook config | `/portal/docs/create-or-update-a-tiktok-account-webhook-configuration/v1.3` | ⛔ | ✅ exists | *"at the developer app level"* |
| Get webhook configs | `/portal/docs/get-tiktok-account-webhook-configurations/v1.3` | ⛔ | ✅ exists | |
| Delete webhook config | `/portal/docs/delete-a-tiktok-account-webhook-configuration/v1.3` | ⛔ | ✅ exists | |
| Accounts API rate limits | `/portal/docs/accounts-api-rate-limits/v1.3` | — | ✅ exists | *"rate limits … combined **per developer application** based on the global rate limit level"* |
| Sandbox accounts | `/portal/docs/sandbox-accounts/v1.3` | — | ✅ exists | Test without production traffic |
| Business Messaging — authorization | `/portal/docs/authorization/v1.3` | ⛔ | ✅ exists | *"Before you use the Business Messaging API, you need to obtain authorization…"* — **separate from Accounts** |
| Business Messaging — authentication | `/portal/docs/business-messaging-api-authentication/v1.3` | ⛔ | ✅ exists | Its own token exchange page |
| Direct messages reference | `/portal/docs/direct-messages/v1.3` | ⛔ | ✅ exists | |
| Send a message | `/portal/docs/send-a-message-to-a-conversation/v1.3` | ⛔ | ✅ exists | |
| **Comment-to-Message toggle** | `/portal/docs/enable-or-disable-comment-to-message-for-a-business-account/v1.3` | ⛔ | ✅ exists | **Contradicts our "no organic DM" claim** |
| Business Messaging webhooks | `/portal/docs/subscribe-to-business-messaging-webhook-events-via-webhooks-api/v1.3` | ⛔ | ✅ exists | |

---

## 3. Answers to your numbered questions

### 1. OAuth authorization flow
- ✅ The Accounts API has its **own** authorization + authentication pages, and a dedicated page
  for **redirect URL configuration** — the redirect URI is a first-class configured value.
- ⛔ Exact authorization host/URL, parameter names, and whether the app identifier is
  `client_key` or `app_id` in this flow: **NOT VERIFIED.** Our current code mixes a
  `www.tiktok.com/v2/auth/authorize` authorize URL (`client_key`) with a business-host token call
  (`client_id`) — that inconsistency is exactly what must be resolved from
  `accounts-api-authorization` + `accounts-api-authentication`.
- State: TikTok's requirement ⛔. Our Phase 1 implementation (32 random bytes, hashed, cookie-bound,
  single-use, 10-min TTL) meets or exceeds any standard OAuth state requirement regardless.

### 2. Authentication / tokens
- ✅ Short-term token: obtain / renew-by-refresh-token / revoke — three separate pages.
- ✅ Long-term token: obtain (*"one of the two endpoints"*) / revoke.
- ✅ Access tokens therefore **do expire**, and refresh exists for the short-term class.
- ⛔ Paths, methods, request/response field names, TTLs, and whether refresh tokens rotate.

### 3. Accounts API
- ✅ Profile data → `get-profile-data-of-a-tiktok-account`
- ✅ Account media → `get-post-data-of-a-tiktok-account`
- ✅ Granted scopes → `get-the-authorized-tiktok-account-permission-scopes-via-access-token`
- ⛔ Fields and identifiers for all three.

### 4. Organic comments
All seven operations you listed exist as **separate official pages** (table above): list, list
replies, reply, create, like/unlike, hide/unhide, delete. Per-endpoint path, method, scope,
identifiers, pagination and response shape: ⛔ — all seven are on the pages named, and
`manage-comments-on-owned-tiktok-videos` is the guide that ties them together.
App-review requirement per endpoint: ⛔.

### 5. Webhooks — **the old polling assumption is dead**
- ✅ Comment update webhooks are available today.
- ✅ Two event categories: post publishing events and comment update events.
- ✅ Trigger conditions (from the official description): comment or reply **created**, **deleted**,
  or **visibility settings modified**.
- ✅ Latency: *"within minutes"* — near-real-time, not instant.
- ✅ Subscription is configured **at the developer app level**, with create/update, get and delete
  configuration endpoints, and a dedicated verification procedure.
- ⛔ Payload schema, signature/verification method, required scope, retry/redelivery semantics.
- **Can it replace polling for Trend? Yes — as the primary trigger.** Recommended: webhook-driven,
  with a low-frequency reconciliation poll as a backstop (see §B/§C). Note one gap in the trigger
  list: a comment being *edited* is not mentioned, and *created* covers our case anyway.

### 6. Identifiers — ⛔ NOT VERIFIED, do not assume
`open_id`, `business_id`, account ID and `union_id` could not be confirmed as equivalent or
distinct. Our code's assumption `businessId = auth.openId` is **unverified** and must be
confirmed from `accounts-api-authentication` before any call is written.

### 7. Base URL
Official overview states the base is `https://business-api.tiktok.com/open_api` with request URLs
formed as `<base_url>/<api_version>/<endpoint>`, and the current documented version family is
**v1.3** ✅ (all 1,113 doc slugs in the sitemap are `/v1.3`). The exact endpoint suffixes ⛔.

### 8. Deprecations / wrong family
- ⛔ No page states that our current endpoints are deprecated — because **no official page
  corresponds to them at all** for organic use. The organic operations live under the Accounts API
  pages listed above, while `business/comment/*`-style naming matches the separate Ad Comments
  family whose documented purpose is *"comments under the video ads of an ad account"*.
- Treat every endpoint in `src/services/tiktok.ts` as **unconfirmed and probably wrong-family**,
  not as "deprecated".

### 9. Scopes
- Our four assumed strings (`user.info.basic`, `video.list`, `comment.list`,
  `comment.list.manage`) are **Login Kit-style names**. The TikTok API for Business model is
  different: ✅ *"permissions consist of three levels: first level, second level, and third level"*,
  and ✅ a dedicated page explains *"how to check the App permission that an endpoint corresponds to"*.
- Your Developer-App UI names (**Account User**, **Get Account Media**,
  **Account Comment → Get Business Comment**, **Account Comment → Manage Account Comment**) are
  consistent with that three-level model — first level *Account*, second level *Account Comment*,
  third level *Get Business Comment* / *Manage Account Comment*.
- ⛔ The exact machine-readable scope strings and the endpoint↔permission mapping must be read from
  `app-permissions` + each endpoint page. **Do not ship the four old strings.**

### 10. Business Messaging (report only, not implementing)
✅ It is a **separate authorization flow** — its own *Business Messaging API Authorization* and
*Business Messaging API Authentication* pages, distinct from the Accounts API pair — while living
inside the same TikTok API for Business developer-app architecture (same portal, same app,
permission-scope model, its own webhook subscription route).
✅ A **Comment-to-Message** capability exists for Business Accounts. This directly contradicts the
claim currently shown in our UI that TikTok offers no automated DMs for organic comments.

---

## 4. A. OAuth architecture recommendation

1. Use the **Accounts API** authorization/authentication pair (not Login Kit).
2. Keep the Phase 1 security envelope exactly as built: random 32-byte state → hashed, HttpOnly
   cookie binding, single-use atomic consume, 10-minute TTL, session-user match, then exchange.
3. Register the redirect URI **`https://www.trendstore-ly.com/api/tiktok/callback`** after reading
   the redirect-URL configuration page for exact-match rules.
4. Decide short-term vs long-term token deliberately: for an unattended bot, the **long-term**
   token is the likely fit; `tiktok_tokens` already models both (`access_expires_at`,
   `refresh_expires_at`, `status`).
5. Call the granted-scopes endpoint right after the exchange and persist to
   `tiktok_accounts.granted_scopes`, so the UI can degrade honestly when a permission is missing.

## 5. B. Organic comments architecture

- Re-point every comment call at the **Accounts API organic** endpoints.
- Keep: idempotency via `UNIQUE(comment_id)` in `bot_reply_log`; rule matching; reply-variant pool.
- Change: throttling must respect **per-developer-app** rate limits, i.e. a global budget shared by
  all customers, not just the per-account cap we have today.
- Available beyond replying (each its own endpoint): create comment, like/unlike, hide/unhide,
  delete. Hide/unhide is a genuinely useful moderation feature for shop owners.
- Note the reply endpoint's description mentions replying on *"others' TikTok account"* videos too —
  worth reading, as it may widen the product.

## 6. C. Webhook architecture

```
TikTok comment event  →  POST /api/tiktok/webhook        (new, Phase 2)
                          ├─ verify per the official verification procedure
                          ├─ 200 immediately (ack fast)
                          └─ enqueue → existing reply pipeline (UNIQUE(comment_id) dedupe)

Backstop:  low-frequency reconciliation poll (e.g. every 15–30 min, not every 2 min)
           → catches missed/failed deliveries; the same dedupe makes double-processing a no-op
```

- Subscribe at the **developer-app level** via the webhook configuration endpoints, not per user.
- Reuse the Meta webhook pattern already proven in this codebase, but with TikTok's own
  verification method (⛔ to be read).
- Retire `/api/tiktok/cron/poll` as the *primary* mechanism; keep it as the backstop.

## 7. D. Required developer-app permissions (to confirm on the app-permissions page)

| Capability we need | Developer-App permission (your naming) |
|---|---|
| Identify the connected account | Account User |
| List the account's videos | Get Account Media |
| Read comments + replies | Account Comment → Get Business Comment |
| Reply / create / like / hide / delete | Account Comment → Manage Account Comment |
| Comment-update webhooks | ⛔ verify which permission gates webhooks |
| (Deferred) Comment-to-Message / DMs | Business Messaging — separate authorization |

## 8. E. Code that must be removed or rewritten

In `src/services/tiktok.ts`, treat as unconfirmed and do **not** carry forward without verification:

| Current code | Problem |
|---|---|
| `AUTH_BASE = "https://www.tiktok.com/v2/auth/authorize"` + `client_key` | Login Kit-shaped; must come from the Accounts API authorization page |
| `POST …/tt_user/oauth2/token/` with `client_id`/`client_secret`/`auth_code` | Unverified; inconsistent with the `client_key` above |
| `POST …/tt_user/oauth2/refresh_token/` | Unverified; ignores the short-term/long-term split |
| `scope: "user.info.basic,video.list,comment.list,comment.list.manage"` | Login Kit-style names; wrong permission model |
| `business/get/`, `business/video/list/` | Must be `get-profile-data-…` / `get-post-data-…` equivalents |
| `business/comment/list/`, `business/comment/reply/create/`, `business/comment/status/update/` | Probably the ads-comment family; organic endpoints are separate pages |
| `businessId = auth.openId` | Identifier equivalence unverified |
| No revoke function | Revoke endpoints exist for both token classes |
| Polling-only design in `tiktokEngine.ts` | Webhooks exist; polling demoted to backstop |

## 9. F. Exact changes required in `src/services/tiktok.ts` (Phase 2 work order)

1. Replace the OAuth block (authorize URL, token exchange, refresh) with the verified Accounts API
   flow, adding `revokeShortTermToken` / `revokeLongTermToken`.
2. Replace the scope constant with the verified Business permission strings.
3. Replace `getTikTokAccount` with the verified profile-data endpoint; replace `getTikTokVideos`
   with the verified post-data endpoint; align pagination (cursor/page fields ⛔).
4. Replace the three comment functions with the verified **organic** equivalents, and add
   `createComment`, `likeComment`, `deleteComment`, `getCommentReplies`.
5. Introduce an explicit identifier type once verified (`open_id` vs `business_id` vs account id) —
   no more implicit aliasing.
6. Add a `webhook` module: verification + event parsing for the comment update event.
7. Keep the `tt()` helper's core insight (HTTP 200 + non-zero `code` = failure) but re-verify the
   envelope field names.
8. Re-point storage at `tiktok_accounts` / `tiktok_tokens` and fill the two Phase 1 plug-in points
   (refresh under lock; official revoke on disconnect).
9. Fix the user-facing claim in `src/app/tiktok-bot/page.tsx` about DMs once Comment-to-Message is
   verified.

---

## 10. How to close the ⛔ gaps (required before any Phase 2 code)

Field-level detail exists **only** in the rendered pages. Three ways to get it, in order of preference:

1. **Open each page in a browser and save/paste it.** The exact list to capture (12 pages, in order):
   `accounts-api-authorization`, `accounts-api-authentication`,
   `tiktok-account-holder-redirect-url-configuration`, `obtain-a-long-term-access-token`,
   `renew-a-short-term-access-token`, `revoke-a-long-term-access-token`, `app-permissions`,
   `manage-comments-on-owned-tiktok-videos`, `get-comments-on-an-owned-video`,
   `reply-to-an-existing-comment-on-an-owned-video`, `comment-update-event`, `webhook-verification`.
   URL form: `https://business-api.tiktok.com/portal/docs/<slug>/v1.3`
2. **Let me render them in your Chrome** (reading documentation only — no TikTok product
   automation, no scraping of TikTok content). Needs your go-ahead, since you set a no-browser-
   automation rule for this project.
3. **The developer portal itself** — the App permissions UI shows the exact permission names and
   which endpoints they unlock, and is the authoritative source for §9/§D.

Until one of those is done, **no endpoint path, parameter or scope string may be written into
code.** That is the entire point of this phase.

---

## Sources (all first-party)

- [About Organic API](https://business-api.tiktok.com/portal/docs/organic-api/v1.3)
- [Organic API Overview](https://business-api.tiktok.com/portal/docs/organic-api-overview/v1.3)
- [Accounts API Overview](https://business-api.tiktok.com/portal/docs/accounts-api/v1.3)
- [Accounts reference](https://business-api.tiktok.com/portal/docs/accounts-api-guide-api-reference/v1.3)
- [Accounts API Authorization](https://business-api.tiktok.com/portal/docs/accounts-api-authorization/v1.3)
- [Accounts API Authentication](https://business-api.tiktok.com/portal/docs/accounts-api-authentication/v1.3)
- [TikTok account holder redirect URL configuration](https://business-api.tiktok.com/portal/docs/tiktok-account-holder-redirect-url-configuration/v1.3)
- [Obtain a short-term access token](https://business-api.tiktok.com/portal/docs/obtain-a-short-term-access-token/v1.3) · [Obtain a long-term access token](https://business-api.tiktok.com/portal/docs/obtain-a-long-term-access-token/v1.3) · [Renew a short-term access token](https://business-api.tiktok.com/portal/docs/renew-a-short-term-access-token/v1.3) · [Revoke a short-term access token](https://business-api.tiktok.com/portal/docs/revoke-a-short-term-access-token/v1.3) · [Revoke a long-term access token](https://business-api.tiktok.com/portal/docs/revoke-a-long-term-access-token/v1.3)
- [Get TikTok account permission scopes in an access token](https://business-api.tiktok.com/portal/docs/get-the-authorized-tiktok-account-permission-scopes-via-access-token/v1.3) · [Permission scope](https://business-api.tiktok.com/portal/docs/permission-scope/v1.3) · [App permissions](https://business-api.tiktok.com/portal/docs/app-permissions/v1.3)
- [Get profile data of a TikTok account](https://business-api.tiktok.com/portal/docs/get-profile-data-of-a-tiktok-account/v1.3) · [Get post data of a TikTok account](https://business-api.tiktok.com/portal/docs/get-post-data-of-a-tiktok-account/v1.3)
- [Manage comments on owned TikTok videos](https://business-api.tiktok.com/portal/docs/manage-comments-on-owned-tiktok-videos/v1.3) · [Get comments on an owned video](https://business-api.tiktok.com/portal/docs/get-comments-on-an-owned-video/v1.3) · [Get all replies to a comment](https://business-api.tiktok.com/portal/docs/get-all-replies-to-a-comment/v1.3) · [Reply to an existing comment on an owned video](https://business-api.tiktok.com/portal/docs/reply-to-an-existing-comment-on-an-owned-video/v1.3) · [Create a new comment on an owned video](https://business-api.tiktok.com/portal/docs/create-a-new-comment-on-an-owned-video/v1.3) · [Like/unlike a comment](https://business-api.tiktok.com/portal/docs/likeunlike-an-existing-comment-on-an-owned-video/v1.3) · [Hide/unhide a comment](https://business-api.tiktok.com/portal/docs/hideunhide-an-existing-comment-on-an-owned-video/v1.3) · [Delete a comment](https://business-api.tiktok.com/portal/docs/delete-an-existing-comment-on-an-owned-video/v1.3)
- [Ad Comments API reference](https://business-api.tiktok.com/portal/docs/ad-comments/v1.3) · [Get comments (ads)](https://business-api.tiktok.com/portal/docs/get-comments/v1.3) · [Update the statuses of comments (ads)](https://business-api.tiktok.com/portal/docs/update-the-statuses-of-comments/v1.3)
- [Accounts Webhooks](https://business-api.tiktok.com/portal/docs/accounts-api-webhooks-guide/v1.3) · [Accounts Webhook event types](https://business-api.tiktok.com/portal/docs/webhook-event-types/v1.3) · [Comment update event](https://business-api.tiktok.com/portal/docs/comment-update-event/v1.3) · [Post publishing events](https://business-api.tiktok.com/portal/docs/post-publishing-events/v1.3) · [Webhook verification](https://business-api.tiktok.com/portal/docs/webhook-verification/v1.3) · [Accounts Webhooks API reference](https://business-api.tiktok.com/portal/docs/accounts-api-webhooks-reference/v1.3) · [Subscribe to TikTok account Webhook events](https://business-api.tiktok.com/portal/docs/subscribe-to-tiktok-account-webhook-events-via-webhooks-api/v1.3) · [Create/update a webhook configuration](https://business-api.tiktok.com/portal/docs/create-or-update-a-tiktok-account-webhook-configuration/v1.3)
- [Accounts API rate limits](https://business-api.tiktok.com/portal/docs/accounts-api-rate-limits/v1.3) · [Sandbox accounts](https://business-api.tiktok.com/portal/docs/sandbox-accounts/v1.3)
- [Business Messaging API Authorization](https://business-api.tiktok.com/portal/docs/authorization/v1.3) · [Business Messaging API Authentication](https://business-api.tiktok.com/portal/docs/business-messaging-api-authentication/v1.3) · [Direct messages API reference](https://business-api.tiktok.com/portal/docs/direct-messages/v1.3) · [Enable or disable Comment-to-Message](https://business-api.tiktok.com/portal/docs/enable-or-disable-comment-to-message-for-a-business-account/v1.3)
- Official sitemap: `https://business-api.tiktok.com/portal/sitemap.xml`
