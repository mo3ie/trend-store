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
