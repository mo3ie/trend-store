-- 37: phone (Web Push) subscriptions for the Trend STORE.
-- Separate from the SHEIN site's `push_subscriptions` on purpose: the database is
-- shared, and one table would let a SHEIN notice land on a store device (or the
-- reverse) with a link into the wrong site.
create table if not exists store_push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_ok_at  timestamptz
);
create index if not exists store_push_user_idx on store_push_subscriptions(user_id);
-- service role only (no policies): the browser never reads other people's endpoints.
alter table store_push_subscriptions enable row level security;
