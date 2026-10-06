-- TikTok ads — campaign storage.
--
-- Deliberately NOT a second campaigns table. A campaign is the same object on both
-- platforms (a budget, a duration, a target, a price, a payment, an external id), and
-- the customer's campaigns list, invoices and payments screens must keep working for
-- both. So `ad_campaigns` gains a platform discriminator and the TikTok-only columns,
-- and every existing row stays a Meta campaign.
--
-- Mapping of the external id columns on the TikTok side:
--   external_campaign_id -> campaign_id
--   external_adset_id    -> adgroup_id   (TikTok's name for an ad set)
--   external_ad_id       -> ad_id

alter table ad_campaigns
  add column if not exists platform text not null default 'meta',
  -- The ad account the campaign runs under. Meta derives it from the Page; TikTok
  -- requires it explicitly on every single API call, so it is stored per campaign.
  add column if not exists advertiser_id text,
  -- Spark Ads promote an existing organic video, which needs the creator's identity.
  add column if not exists tiktok_identity_id text,
  add column if not exists tiktok_identity_type text,
  -- The organic video being promoted (TikTok's item id, not a URL).
  add column if not exists tiktok_item_id text;

alter table ad_campaigns drop constraint if exists ad_campaigns_platform_check;
alter table ad_campaigns
  add constraint ad_campaigns_platform_check check (platform in ('meta', 'tiktok'));

create index if not exists ad_campaigns_platform_idx
  on ad_campaigns (user_id, platform, created_at desc);
