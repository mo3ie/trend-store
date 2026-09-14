-- Campaign performance snapshot (synced from Meta insights) shown in "My campaigns".
-- Idempotent.
alter table ad_campaigns add column if not exists reach       integer default 0;
alter table ad_campaigns add column if not exists impressions integer default 0;
alter table ad_campaigns add column if not exists clicks      integer default 0;
alter table ad_campaigns add column if not exists spend_usd   numeric default 0;
alter table ad_campaigns add column if not exists insights_at timestamptz;
