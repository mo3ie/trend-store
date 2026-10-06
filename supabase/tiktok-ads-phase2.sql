-- TikTok ads, phase 2: saved audiences and A/B variants.
--
-- Saved audiences gain a platform discriminator, and this one is not cosmetic: a
-- Facebook audience stores META geo keys and interest ids, a TikTok audience stores
-- TIKTOK location ids and interest category ids. They come from different systems and
-- are not interchangeable, so applying a saved Facebook audience to a TikTok campaign
-- would send TikTok identifiers it has never heard of and quietly target nobody.
-- Hence a hard separation rather than one shared list.

alter table ad_audiences
  add column if not exists platform text not null default 'meta';

alter table ad_audiences drop constraint if exists ad_audiences_platform_check;
alter table ad_audiences
  add constraint ad_audiences_platform_check check (platform in ('meta', 'tiktok'));

create index if not exists ad_audiences_platform_idx
  on ad_audiences (user_id, platform, created_at desc);

-- The B variant's ad group and ad. `external_variant_b` already holds the Meta B-side
-- id; TikTok needs both because its ad group and ad are separate objects.
alter table ad_campaigns
  add column if not exists external_adgroup_b text,
  add column if not exists external_ad_b text;
