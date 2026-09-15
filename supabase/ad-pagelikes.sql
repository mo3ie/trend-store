-- Page-likes ads: the promo caption on the Page ad (post_url is null for these).
-- Idempotent — safe to re-run.

alter table ad_campaigns add column if not exists ad_text text;
alter table ad_campaigns alter column post_url drop not null;
