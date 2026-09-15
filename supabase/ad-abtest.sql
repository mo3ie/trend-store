-- A/B split-test: a second audience + its external ad-set/ad ids.
-- Idempotent — safe to re-run.

alter table ad_campaigns add column if not exists targeting_b        jsonb;
alter table ad_campaigns add column if not exists ab_test            boolean default false;
alter table ad_campaigns add column if not exists external_variant_b jsonb;
