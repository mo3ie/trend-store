-- ─────────────────────────────────────────────────────────────────────────────
-- 44 — ONE TikTok ad account for everybody, the way Facebook already works.
--
-- ## The contradiction this closes
--
-- The two platforms were built on opposite models and priced identically.
--
--   Facebook: campaigns run on META_AD_ACCOUNT_ID — the platform's own account,
--             funded by the platform's own card. The customer pays us in LYD.
--   TikTok:   `requireAdsContext(user.id)` resolved the CUSTOMER'S advertiser
--             grant, so the campaign ran on their ad account and their card —
--             while the same code still debited their wallet in LYD for the ad
--             spend.
--
-- So a TikTok customer paid twice: once to us, once to TikTok. Nobody had hit
-- it, because nobody has ever completed the advertiser link — which is the
-- second half of the problem. Linking requires a TikTok Ads Manager account and
-- an international payment card, and in Libya that is most of the market gone
-- before the first campaign.
--
-- ## How it works now
--
-- The owner links ONE advertiser account through the ordinary OAuth flow — the
-- same /api/tiktok/ads/connect, with its state binding and encrypted storage —
-- and then marks that grant as the platform account. Every customer's campaign
-- runs on it.
--
-- A customer who HAS linked their own keeps using it: `requireAdsContext` tries
-- the user's own grant first and falls back to the platform's. So this is purely
-- additive, and an agency-style customer who wants their own account is not shut
-- out by a decision taken for the Libyan high street.
--
-- ## What the customer still has to do
--
-- Nothing with money, and one thing with permission. These are Spark Ads: the
-- advert IS the customer's own organic video, running under their own handle.
-- TikTok requires the video's owner to authorize that, which they do from their
-- own account — a far lighter ask than opening an ad account and attaching a
-- card.
--
-- ## Why a flagged row and not an env var
--
-- The alternative was TIKTOK_ADS_PLATFORM_TOKEN in Vercel. A long-term
-- advertiser token with no expiry is exactly the kind of secret that should not
-- be pasted between systems by hand: the OAuth flow already encrypts it at rest
-- with TOKEN_ENCRYPTION_KEY, already records its scope and advertiser ids, and
-- already has a revoke path. A flag on that row reuses all of it.
--
-- The partial unique index is the real guard: two platform accounts would make
-- "which card is paying for this campaign" depend on row order.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.tiktok_ads_authorizations
  add column if not exists is_platform boolean not null default false;

comment on column public.tiktok_ads_authorizations.is_platform is
  'TRUE on the single grant whose ad account funds every customer''s campaigns (the Facebook META_AD_ACCOUNT_ID model). Set by an admin; at most one row may be true.';

-- At most one, and only among grants that are still active: a revoked platform
-- account must not block its replacement from being marked.
create unique index if not exists tiktok_ads_one_platform_grant
  on public.tiktok_ads_authorizations ((true))
  where is_platform and status = 'active';
