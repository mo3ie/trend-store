# TikTok Ads — إعلانات تيك توك

The paid-campaign half of the TikTok tools: an advertiser picks one of their own
videos, sets an audience and a budget, pays in dinars, and we create a real campaign
on TikTok through the Marketing API.

It is deliberately the Facebook ads flow with one platform adapter swapped in, not a
second product. Same packages-or-free-budget model, same AI assistant, same payment
sheet, same campaign lifecycle. What differs is what TikTok itself forces to differ.

---

## The three things TikTok does differently

### 1. A hard minimum spend

TikTok rejects any ad group under **USD 20 per day**, so a lifetime budget must be at
least `20 × days`. Facebook's cheapest package is USD 5 for three days.

This is the single most important fact in this feature. It means:

* The Facebook package table **cannot** be reused. A 65 LYD campaign would be sold,
  paid for, and then refused by TikTok at creation.
* `src/lib/tiktokAdsPricing.ts` **generates** its default packages from the floor, so
  every option on the price list is a budget TikTok will accept by construction.
* The floor is stated to the customer on the landing page and again in the create
  screen's budget section, described as the platform's rule — because an advertiser
  comparing it to the Facebook prices will otherwise assume we added a markup.
* It is enforced three times: in the create route, in `launchCampaign`, and as a clamp
  on whatever the AI assistant suggests.

Override with `TIKTOK_ADS_MIN_DAILY_USD` if TikTok changes it.

### 2. `advertiser_id` on every call

Meta derives the ad account from the Page. TikTok does not, so the chosen advertiser is
stored on the campaign row (`ad_campaigns.advertiser_id`) and re-resolved from the
grant on every later call. `requireAdsContext()` in `src/lib/tiktokAdsContext.ts` is
the one place that resolves token + account and produces the right refusal when either
is missing.

### 3. Spark Ads, not "boost this URL"

There is no equivalent of boosting a post by its link. Promoting an existing organic
video requires:

* an **identity** (`/identity/get/`) — the account the ad runs as, and
* the video's **`tiktok_item_id`** from the ads-side list (`/identity/video/get/`).

The organic bot's video ids are **not** interchangeable with these: the Marketing API
rejects an id that came from the account-holder API. An advertiser who has not linked
their TikTok account inside Ads Manager gets no identities, which the create screen
reports as an action to take rather than an empty grid.

---

## Shape

| Piece | File |
|---|---|
| Advertiser OAuth (token exchange, revoke) | `src/services/tiktokAds.ts` |
| Marketing API (campaign/adgroup/ad, targeting, reports) | `src/services/tiktokAdsCampaigns.ts` |
| Encrypted token store | `src/lib/tiktokAdsTokens.ts` |
| Token + ad-account resolution | `src/lib/tiktokAdsContext.ts` |
| Pricing, packages, tier | `src/lib/tiktokAdsPricing.ts` |
| Paid → launch dispatch (both platforms) | `src/lib/adsLaunch.ts` |

### Routes

| Route | Purpose |
|---|---|
| `/api/tiktok/ads/connect`, `/callback` | advertiser authorization |
| `/api/tiktok/ads/me` | configured / connected / tier / price list / floor |
| `/api/tiktok/ads/identities` | the accounts an ad can run as |
| `/api/tiktok/ads/spark-videos` | promotable videos for an identity |
| `/api/tiktok/ads/geo`, `/interests` | targeting lookups |
| `/api/tiktok/ads/ai-targeting`, `/ad-copy` | AI assistant (subscribers) |
| `/api/tiktok/ads/campaigns` | list / create (`pending_payment`) |
| `/api/tiktok/ads/campaigns/[id]` | read / pause / resume / stop |
| `/api/tiktok/ads/campaigns/sync` | live numbers + status |
| `/api/tiktok/ads/launch` | create on TikTok after payment |
| `/api/tiktok/ads/campaigns/daily-debit` | daily wallet debit, open-ended campaigns |

### Screens

`/tiktok-ads` (landing + price list) · `/tiktok-ads/create` · `/tiktok-ads/campaigns`.
Payment reuses `/ads/checkout`, which already carries every gateway.

---

## One table, two platforms

`ad_campaigns` gained `platform` (`'meta' | 'tiktok'`), `advertiser_id`,
`tiktok_identity_id`, `tiktok_identity_type` and `tiktok_item_id`
(`supabase/tiktok-ads.sql`). The external id columns are reused:
`external_adset_id` holds the **ad group** id.

A campaign is the same object on both platforms, and the invoices and payments screens
must keep working for both — so it is one table with a discriminator, not two.

**The Meta routes were filtered accordingly, and one of those filters is about money:**
`/api/promo/campaigns/daily-debit` pauses through the Graph API. Without
`.eq("platform", "meta")` it would mark an out-of-balance TikTok campaign paused in our
database while it kept spending on TikTok. The same filter was added to the Meta
campaigns list and its insights sync, and `/api/promo/campaigns/[id]` POST now refuses
a TikTok row outright.

---

## Objective mapping

The customer-facing goal names match the Facebook screen; each maps to its own TikTok
objective, optimisation goal and billing event (a mismatched triple is the usual cause
of a campaign that spends with no result).

| Shown to the customer | TikTok objective | Optimisation | Billing | Promotion type |
|---|---|---|---|---|
| مشاهدات الفيديو | `VIDEO_VIEWS` | `VIDEO_VIEW` | CPV | WEBSITE |
| أكبر وصول | `REACH` | `REACH` | CPM | WEBSITE |
| زيارات المتجر | `TRAFFIC` | `CLICK` | CPC | WEBSITE |
| تفاعل | `ENGAGEMENT` | `ENGAGED_VIEW` | CPV | WEBSITE |
| زيادة المتابعين | `ENGAGEMENT` | `FOLLOWERS` | OCPM | FOLLOWERS |

`followers` is TikTok's answer to Facebook's page-likes ad: it promotes the profile, so
it needs no video and no landing page.

Ages become TikTok's fixed buckets, and a bucket is kept when it *overlaps* the
requested range — an 18–30 request must still reach `AGE_25_34`, or the audience
silently shrinks below what was asked for.

---

## Review safety

The organic TikTok concept submitted for app review was not altered. The bot, the
publishing flow, `/tiktok-bot/demo-account/*` and `/tiktok-demo/*` are untouched. The
only change to `/tiktok` is the ads card's `soon` flag, now that the tool exists.

Advertiser authorization is the Marketing API track, which is separate from the
account-holder scopes under review.

---

## Still needed from the operator

1. **Env** — none of these are set in production yet, so `/api/tiktok/ads/me` reports
   `configured: false` and the landing page says linking is being activated:
   * `TIKTOK_ADS_APP_ID`, `TIKTOK_ADS_APP_SECRET` (fall back to the organic
     `TIKTOK_CLIENT_ID` / `TIKTOK_CLIENT_SECRET` if one app serves both)
   * `TIKTOK_ADS_AUTH_URL` — the portal's **Advertiser authorization URL**, a
     *different* field from the account-holder one
2. **Redirect URL** — register `/api/tiktok/ads/callback/` as the advertiser redirect.
3. **Prices** — the 9 `tiktok_ads` subscription plans are seeded but `active = false`
   with placeholder prices. Set them, then activate.
4. **Package review** — the default package table is generated from the floor at
   12 LYD/USD. Confirm or override it via `store_settings.data.tiktokAdsPricing`
   (`regularRate`, `vipRate`, `*Commission`, `packagesTt`).
5. **Cron** — `/api/tiktok/ads/campaigns/daily-debit` is in `vercel.json` at 06:15 UTC
   and needs `CRON_SECRET`.

---

## Phase 2 — the TikTok-native rebuild

The first version of these screens was a clone of the Facebook tools, and the owner's
verdict was that it was *too* identical: same chrome, Facebook vocabulary, and the AI
Employee card even opened the Facebook Page-linking flow. The ideas were right; the
execution was a second copy of another product. Rebuilt around three principles.

### 1. No gradient fills, a black stage instead

`src/lib/tiktokTheme.ts` is the area's own language. The Facebook tools are built on
gradient fills; this area has none. Its signature is a black 9:16 **stage** that stays
black in both themes (video is the content, and a black vertical frame reads as
"phone"), plus pink/cyan as a hard unblurred **offset** rather than a blend — a
pink-to-cyan gradient reads as generic neon, while the offset is the actual logo
mechanic.

The text inks are split from the brand hues because raw cyan on a light background is
about 1.5:1 contrast. On light it may only be an edge, never text.

### 2. Prep mode, not a dead end

Nothing can be linked until the credentials land, so the unlinked screen is what every
user sees FIRST. The old screens treated that as an error: a marketing hero, a price,
and a link button that fails. Now:

* The account strip states the truth and offers a notify toggle, not a broken button.
* Everything that does not need the TikTok API works and is saved now.
* The bot's **live simulator** answers a comment using the owner's real rules and real
  catalog prices (`/api/tiktok/bot/simulate`, which runs the actual decision core —
  an approximation would be worse than nothing, since owners tune rules against it).
  The AI tier is deliberately not invoked from a preview: it bills per call.
* Subscription gates only the go-live switch, via a sticky bar.

### 3. The deliverables are different objects

| | Facebook | TikTok |
|---|---|---|
| A post | caption + image | a **script**: hook, shots, on-screen text, sound |
| The bot | public reply + private DM | one **public** reply, price included |
| An ad | boost a post by URL | Spark Ad: pick a video by thumbnail |
| A/B test | two audiences | **two videos** |

* `supabase/tiktok-studio-script.sql` adds `hook`, `scenes`, `screen_text`, `sound`,
  `duration_sec`. The generator now has two prompts, because asking one to serve both
  produced Facebook captions with a TikTok label on them. A still is labelled "cover
  frame" and never presented as the post.
* `components/tiktok/ReplyThread.tsx` draws the composer AS the comment thread — the
  owner types into a rendered public place, so the fact never needs a warning label.
  The slot Facebook spends on the DM becomes **reply variants** the bot rotates;
  identical replies under every comment look like spam to viewers and to moderation.
  A lint fires when a product is in play and no variant carries a price, since on this
  platform there is no DM for the price to go in.
* The two-video test splits the budget across two ad groups — and TikTok's minimum
  applies to **each**, so a legal $60 campaign split in two becomes two illegal $30
  groups. The floor is therefore checked against the per-group share, in
  `launchCampaign` and again in the create route before payment.

### The $20/day floor, presented honestly

No comparison to another platform's prices anywhere: without the comparison there is
nothing to feel cheated about. Instead:

* A **receipt** whose hero number is what goes to TikTok, with the service fee as
  small print beneath it. When most of the money visibly leaves for the platform, the
  price reads as reach being bought.
* A budget **slider whose track includes the forbidden zone**, hatched and unreachable.
  The advertiser sees a wall that belongs to TikTok rather than a price we chose.
* The default offer is a **3-day sprint** — the smallest thing TikTok will run.

### Also

* `/api/tiktok/status` describes each tool from the owner's own data, replacing feature
  bullets that read identically on every account.
* `/subscriptions` now says prices are being set when a product has no active plans,
  instead of rendering an empty selector; each tool deep-links to its own tab.
* The app-review demonstration material moved out of the main flow to a single
  "عرض تقديمي" item in the hub's overflow menu. `/tiktok-demo/*` and
  `/tiktok-bot/demo-account/*` are unchanged.
* Payment reuses `/ads/checkout`. That URL carries the other area's name, which is the
  one piece of shared vocabulary left standing — duplicating a tested payment sheet
  across four gateways was the worse trade.

---

## Correction: the Business Messaging API IS available for Libya

An earlier note in this repo (and in the product copy) said TikTok has no automated
private reply for this market. **That was wrong**, and the owner caught it.

The official access page states the rule by region:

* **Not available** in the EEA, Switzerland or the UK.
* **US** Business Accounts: the developer needs the Data security & privacy review,
  the US data security review, and the USDS Addendum.
* **"Rest of World"** — which includes Libya — *"developers who have passed the Data
  security & privacy review are permitted to call the Business Messaging API on behalf
  of these accounts."*

And the API has a **Comment-to-Message** capability explicitly: endpoints exist to
enable/disable it per Business Account and to read its current setting, alongside
send-message, list-conversations, list-messages, image upload/download, unlock
conversations, automatic messages (`/business/message/auto_message/create/`, with
`WELCOME_MESSAGE`, keyword reply, suggested questions, chat prompts) and webhooks.

So the Facebook pattern — a public reply plus a private message carrying the price —
is reachable here after all. Two gates stand in front of it:

1. The **Data security & privacy review** (the Rest-of-World requirement above).
2. Automatic messages additionally need **Advanced Access** and a **Verified Business
   Account**.

### What this changes in the product

The copy that says "TikTok has no automated private messages" appears in the hub, the
reply composer's price lint, and this document. It is accurate *today* — we have not
passed the review — but it is a statement about our access, not about the platform,
and it must be reworded as such rather than presented as a permanent limit.

The reply composer's "variants" design stays regardless: rotating replies is good
practice on a public comment thread whether or not a DM is also sent.
