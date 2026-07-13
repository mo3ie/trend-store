# Auto-Reply Bot — Setup & Go-Live Guide

Two independent products, one codebase:

| | Facebook bot (`/bot`) | TikTok bot (`/tiktok-bot`) |
|---|---|---|
| New comments arrive by | **Webhook** (push, instant) | **Polling** (cron, every 2 min) — TikTok has no comment webhook |
| Public reply | ✅ | ✅ |
| Private reply (DM) + attachments | ✅ | ❌ TikTok has no organic DM API |
| Gate | Meta App Review | TikTok developer app approval |

Both share the same engine: keyword rules → AI fallback → throttle → reply log.

---

## 1. Database

Run `supabase/bot-tables.sql` in the Supabase SQL Editor. It creates:
`bot_configs`, `bot_rules`, `bot_reply_log`, `bot_page_tokens`, `bot_subscriptions`,
`bot_settings` — all with RLS.

> Re-running is safe (`if not exists` / policy guards).

---

## 2. Environment variables

| Var | Needed for | Notes |
|---|---|---|
| `META_APP_SECRET` | FB webhook signature | already set (ads) |
| `META_WEBHOOK_VERIFY_TOKEN` | FB webhook handshake | **new** — invent any random string; paste the same one in the Meta dashboard |
| `CRON_SECRET` | cron auth | **new** — random string; Vercel sends it as `Authorization: Bearer …` |
| `ANTHROPIC_API_KEY` | AI replies | **optional** — without it, AI silently falls back to keyword rules |
| `BOT_AI_MODEL` | AI model | optional, defaults to `claude-sonnet-5` |
| `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` | TikTok bot | from the TikTok developer portal |

---

## 3. Facebook — App Review (⚠️ WAIT)

**Do not submit until the current ads review (pages_show_list, pages_read_engagement,
pages_manage_ads, ads_management) has been decided.** Two open submissions on one app
is how the last rejection happened.

When ready, request the two new permissions:

- **`pages_manage_engagement`** — to post the public reply under the customer's comment.
- **`pages_messaging`** — to send the private reply (price/details/images) to the commenter.

Then in the App Dashboard → **Webhooks** → *Page*:
- Callback URL: `https://trendstore-ly.com/api/bot/webhook`
- Verify token: the value of `META_WEBHOOK_VERIFY_TOKEN`
- Subscribe to the **`feed`** field.

Also add both scopes to the **Login for Business config_id** used by the connect flow
(the code already requests them in the fallback scope list).

Each customer Page is subscribed automatically (`subscribed_apps`) the first time the
bot is switched on.

---

## 4. TikTok — developer app (independent, start now)

1. Create an app at the TikTok developer portal; request the comment-management scopes
   (`comment.list`, `comment.list.manage`) and `video.list`.
2. Set the redirect URI to `https://trendstore-ly.com/api/tiktok/callback`.
3. Put the client key/secret in the env vars above.

> **Verify before launch:** the exact request/response shapes in `src/services/tiktok.ts`
> were written from the public endpoint list (`business/comment/list/`,
> `business/comment/reply/create/`) because TikTok's docs domain is not publicly
> fetchable and the official SDK only covers *ads* comments. Once the app is approved,
> run one live call per endpoint and adjust field names if they differ.

---

## 5. How the anti-block protection works

The customer's fear: 500 comments at once → Facebook temporarily blocks the account.

**Layer 1 — throttle (the real defense).** Each page has a replies/minute cap
(`throttle_per_min`, default 20). Comments over budget are parked as `deferred` and
delivered by the cron drain over the following minutes, with 0.4–1.6s human-like
jitter between calls. A burst is answered *steadily*, never in one spam-flagged blast.

**Layer 2 — token rotation (emergency failover).** A customer can link several
Facebook accounts that all admin the same Page. On a rate-limit error (codes 32/613/368),
that token is cooled down for 30 min and the next active one takes over.

> ⚠️ Rotating accounts specifically to evade anti-spam is against Facebook policy and
> can get *every* linked account actioned. Layer 1 is what keeps customers safe;
> layer 2 exists so one throttled token doesn't take the whole bot down.

---

## 6. Cron jobs (`vercel.json`)

| Path | Schedule | Purpose |
|---|---|---|
| `/api/bot/cron/drain` | every minute | deliver throttle-deferred Facebook comments |
| `/api/tiktok/cron/poll` | every 2 min | poll TikTok for new comments |

---

## 7. Billing

Monthly subscription per page/account, debited from the same `wallets.balance` the ads
checkout uses. Price is admin-editable at **/admin/bot**. The bot refuses to turn on
without an active subscription, and the engine re-checks it on every comment.
