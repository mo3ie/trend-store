-- Monthly quotas for the paid ("strong") AI in the Studio. Idempotent.
--
-- Paid generation is metered, not open-ended: each subscription carries a monthly
-- allowance of high-quality images and videos. Everything else in the Studio — the
-- free generator, web image search, catalog photos — stays unlimited and costs
-- nothing, so hitting the cap never blocks the customer from working.

-- Allowance per plan, admin-editable from the price panel.
alter table subscription_plans add column if not exists ai_image_quota int default 0;
alter table subscription_plans add column if not exists ai_video_quota int default 0;

-- One row per subscription per monthly window. The window is anchored on the
-- subscription's own start day, so a customer's month is their month — not the
-- calendar's — and a 3- or 12-month term still meters month by month rather than
-- handing over the whole term's allowance on day one.
create table if not exists studio_usage (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,
  subscription_id uuid,
  period_start    timestamptz not null,
  period_end      timestamptz not null,
  images_used     int default 0,
  videos_used     int default 0,
  -- Bought on top of the plan's allowance. Lives and dies with THIS window:
  -- a renewal starts a fresh window, so unused top-up does not carry over.
  images_extra    int default 0,
  videos_extra    int default 0,
  created_at      timestamptz default now()
);

create unique index if not exists studio_usage_period_idx
  on studio_usage (user_id, subscription_id, period_start);

alter table studio_usage enable row level security;
do $$ begin
  create policy studio_usage_own on studio_usage for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Invoices for top-up purchases join the subscription payment history.
alter table subscription_payments add column if not exists quota_kind text;

-- Starting allowances. basic has none: it runs entirely on the free generator.
update subscription_plans set ai_image_quota = 0,   ai_video_quota = 0
  where product = 'studio' and tier = 'basic';
update subscription_plans set ai_image_quota = 100, ai_video_quota = 0
  where product = 'studio' and tier = 'medium';
update subscription_plans set ai_image_quota = 100, ai_video_quota = 10
  where product = 'studio' and tier = 'vip';
