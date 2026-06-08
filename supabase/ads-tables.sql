-- =============================================
-- Ads Service Tables — Trend Store
-- Run this in Supabase SQL Editor
-- =============================================

-- Connected Pages (Meta OAuth)
create table if not exists connected_pages (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users not null,
  platform      text not null default 'meta',
  page_id       text not null,
  page_name     text,
  page_picture  text,
  page_access_token text not null,
  connection_type text not null default 'oauth', -- 'oauth' | 'business_manager'
  created_at    timestamptz default now(),
  unique(user_id, page_id)
);

alter table connected_pages enable row level security;
create policy "users_own_pages" on connected_pages for all using (auth.uid() = user_id);
create policy "admin_all_pages" on connected_pages for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Ad Campaigns
create table if not exists ad_campaigns (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users not null,
  page_id             text not null,
  page_name           text,
  post_url            text not null,
  external_post_id    text,
  budget              numeric not null,
  duration_days       int not null default 7,
  service_fee         numeric not null,
  total_price         numeric not null,
  status              text not null default 'pending_payment',
  -- pending_payment | paid | creating | active | completed | failed
  external_campaign_id text,
  external_adset_id    text,
  external_ad_id       text,
  error_message        text,
  targeting            jsonb default '{"countries":["LY"]}'::jsonb,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

alter table ad_campaigns enable row level security;
create policy "users_own_campaigns" on ad_campaigns for all using (auth.uid() = user_id);
create policy "admin_all_campaigns" on ad_campaigns for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Ad Payments
create table if not exists ad_payments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users not null,
  campaign_id      uuid references ad_campaigns not null,
  amount           numeric not null,
  provider         text not null default 'dpay',
  provider_session text,
  status           text not null default 'pending',
  -- pending | success | failed | refunded
  created_at       timestamptz default now()
);

alter table ad_payments enable row level security;
create policy "users_own_ad_payments" on ad_payments for all using (auth.uid() = user_id);
create policy "admin_all_ad_payments" on ad_payments for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Ad Accounts (our managed accounts — admin only)
create table if not exists ad_accounts (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null default 'meta',
  account_id   text not null,
  account_name text,
  type         text not null default 'owned', -- 'owned' | 'client'
  status       text not null default 'active',
  created_at   timestamptz default now()
);

alter table ad_accounts enable row level security;
create policy "admin_only_ad_accounts" on ad_accounts for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Index for fast lookups
create index if not exists idx_ad_campaigns_user on ad_campaigns(user_id);
create index if not exists idx_ad_campaigns_status on ad_campaigns(status);
create index if not exists idx_ad_payments_campaign on ad_payments(campaign_id);
create index if not exists idx_connected_pages_user on connected_pages(user_id);
