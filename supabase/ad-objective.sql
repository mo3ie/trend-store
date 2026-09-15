-- Facebook ad objective, placements, Advantage+ audience, special ad category.
-- Idempotent — safe to re-run.

alter table ad_campaigns add column if not exists objective           text default 'engagement';
alter table ad_campaigns add column if not exists placements          jsonb default '[]'::jsonb;
alter table ad_campaigns add column if not exists advantage_audience  boolean default false;
alter table ad_campaigns add column if not exists special_ad_category text;
