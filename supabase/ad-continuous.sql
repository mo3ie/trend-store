-- Open-ended (continuous) campaigns: daily budget + daily wallet debit.
-- Idempotent — safe to re-run.

alter table ad_campaigns add column if not exists continuous       boolean default false;
alter table ad_campaigns add column if not exists daily_budget_usd numeric;
alter table ad_campaigns add column if not exists daily_price_lyd  numeric;
alter table ad_campaigns add column if not exists next_charge_at   timestamptz;
alter table ad_campaigns alter column duration_days drop not null;

create index if not exists ad_campaigns_next_charge_idx
  on ad_campaigns (next_charge_at) where continuous = true;
