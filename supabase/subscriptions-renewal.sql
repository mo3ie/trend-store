-- Phase 5: renewal, expiry and near-expiry reminders. Idempotent.

-- Renewal extends the row in place (the id stays stable, so page_ids and anything
-- referencing the subscription survive); the invoice list is the renewal history.
-- auto_renew      — charge the wallet and extend automatically when the term ends.
-- cancelled_at    — when the user turned auto-renew off / cancelled.
-- reminder_stage  — smallest days-left bucket already notified (7 → 3 → 1 → 0).
--                   Guarantees one reminder per bucket, and survives re-runs of the cron.
alter table subscriptions add column if not exists auto_renew     boolean default false;
alter table subscriptions add column if not exists cancelled_at   timestamptz;
alter table subscriptions add column if not exists reminder_stage int default 99;

-- The cron scans by (status, expires_at); without this it is a full table scan every day.
create index if not exists subscriptions_expiry_idx
  on subscriptions (status, expires_at);

-- Tell a first purchase apart from a renewal on the invoice list.
alter table subscription_payments add column if not exists kind text default 'purchase';

-- Back-fill: rows created before this migration were all first purchases, and have
-- not been reminded about yet.
update subscriptions        set reminder_stage = 99 where reminder_stage is null;
update subscription_payments set kind = 'purchase'  where kind is null;
