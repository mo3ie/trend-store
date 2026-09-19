-- Subscription system: plans catalog + user subscriptions + payments. Idempotent.
create table if not exists subscription_plans (
  id          text primary key,
  product     text not null,           -- bot | ads | studio
  tier        text not null,           -- regular | vip | basic | medium
  page_scope  text not null,           -- single | triple | unlimited
  page_limit  int  not null,
  duration    text not null,           -- monthly | quarterly | yearly
  months      int  not null,
  price_lyd   numeric not null,
  features    jsonb default '[]'::jsonb,
  active      boolean default true,
  sort        int default 0
);
create table if not exists subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  product     text not null,
  plan_id     text,
  tier        text,
  page_scope  text,
  page_limit  int default 1,
  page_ids    text[] default '{}',
  starts_at   timestamptz default now(),
  expires_at  timestamptz,
  status      text default 'active',
  price_lyd   numeric,
  created_at  timestamptz default now()
);
create index if not exists subscriptions_user_idx on subscriptions (user_id, product, status);
create table if not exists subscription_payments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,
  subscription_id uuid,
  product         text,
  plan_id         text,
  amount_lyd      numeric,
  provider        text default 'wallet',
  status          text default 'success',
  created_at      timestamptz default now()
);
alter table subscriptions          enable row level security;
alter table subscription_payments  enable row level security;
do $$ begin
  create policy subs_own on subscriptions for select using (auth.uid() = user_id);
  create policy subpay_own on subscription_payments for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

insert into subscription_plans (id,product,tier,page_scope,page_limit,duration,months,price_lyd,features,active,sort) values
('bot-regular-single-monthly','bot','regular','single',1,'monthly',1,50,'["reply_keyword", "private_dm", "like", "post_targeting"]'::jsonb,true,1),
('bot-regular-single-quarterly','bot','regular','single',1,'quarterly',3,125,'["reply_keyword", "private_dm", "like", "post_targeting"]'::jsonb,true,2),
('bot-regular-single-yearly','bot','regular','single',1,'yearly',12,500,'["reply_keyword", "private_dm", "like", "post_targeting"]'::jsonb,true,3),
('bot-vip-single-monthly','bot','vip','single',1,'monthly',1,100,'["reply_keyword", "private_dm", "like", "post_targeting", "ai_reply", "price_reply", "priority"]'::jsonb,true,4),
('bot-vip-single-quarterly','bot','vip','single',1,'quarterly',3,250,'["reply_keyword", "private_dm", "like", "post_targeting", "ai_reply", "price_reply", "priority"]'::jsonb,true,5),
('bot-vip-single-yearly','bot','vip','single',1,'yearly',12,1000,'["reply_keyword", "private_dm", "like", "post_targeting", "ai_reply", "price_reply", "priority"]'::jsonb,true,6),
('bot-regular-triple-monthly','bot','regular','triple',3,'monthly',1,100,'["reply_keyword", "private_dm", "like", "post_targeting"]'::jsonb,true,7),
('bot-regular-triple-quarterly','bot','regular','triple',3,'quarterly',3,250,'["reply_keyword", "private_dm", "like", "post_targeting"]'::jsonb,true,8),
('bot-regular-triple-yearly','bot','regular','triple',3,'yearly',12,1000,'["reply_keyword", "private_dm", "like", "post_targeting"]'::jsonb,true,9),
('bot-vip-triple-monthly','bot','vip','triple',3,'monthly',1,200,'["reply_keyword", "private_dm", "like", "post_targeting", "ai_reply", "price_reply", "priority"]'::jsonb,true,10),
('bot-vip-triple-quarterly','bot','vip','triple',3,'quarterly',3,500,'["reply_keyword", "private_dm", "like", "post_targeting", "ai_reply", "price_reply", "priority"]'::jsonb,true,11),
('bot-vip-triple-yearly','bot','vip','triple',3,'yearly',12,1800,'["reply_keyword", "private_dm", "like", "post_targeting", "ai_reply", "price_reply", "priority"]'::jsonb,true,12),
('bot-regular-unlimited-monthly','bot','regular','unlimited',999,'monthly',1,250,'["reply_keyword", "private_dm", "like", "post_targeting"]'::jsonb,true,13),
('bot-regular-unlimited-quarterly','bot','regular','unlimited',999,'quarterly',3,700,'["reply_keyword", "private_dm", "like", "post_targeting"]'::jsonb,true,14),
('bot-regular-unlimited-yearly','bot','regular','unlimited',999,'yearly',12,2500,'["reply_keyword", "private_dm", "like", "post_targeting"]'::jsonb,true,15),
('bot-vip-unlimited-monthly','bot','vip','unlimited',999,'monthly',1,500,'["reply_keyword", "private_dm", "like", "post_targeting", "ai_reply", "price_reply", "priority"]'::jsonb,true,16),
('bot-vip-unlimited-quarterly','bot','vip','unlimited',999,'quarterly',3,1250,'["reply_keyword", "private_dm", "like", "post_targeting", "ai_reply", "price_reply", "priority"]'::jsonb,true,17),
('bot-vip-unlimited-yearly','bot','vip','unlimited',999,'yearly',12,5000,'["reply_keyword", "private_dm", "like", "post_targeting", "ai_reply", "price_reply", "priority"]'::jsonb,true,18),
('ads-vip-single-monthly','ads','vip','single',1,'monthly',1,100,'["free_usd_budget", "ai_targeting", "support_247", "full_bot_features", "priority"]'::jsonb,true,19),
('ads-vip-single-quarterly','ads','vip','single',1,'quarterly',3,250,'["free_usd_budget", "ai_targeting", "support_247", "full_bot_features", "priority"]'::jsonb,true,20),
('ads-vip-single-yearly','ads','vip','single',1,'yearly',12,1000,'["free_usd_budget", "ai_targeting", "support_247", "full_bot_features", "priority"]'::jsonb,true,21),
('ads-vip-triple-monthly','ads','vip','triple',3,'monthly',1,200,'["free_usd_budget", "ai_targeting", "support_247", "full_bot_features", "priority"]'::jsonb,true,22),
('ads-vip-triple-quarterly','ads','vip','triple',3,'quarterly',3,500,'["free_usd_budget", "ai_targeting", "support_247", "full_bot_features", "priority"]'::jsonb,true,23),
('ads-vip-triple-yearly','ads','vip','triple',3,'yearly',12,1800,'["free_usd_budget", "ai_targeting", "support_247", "full_bot_features", "priority"]'::jsonb,true,24),
('ads-vip-unlimited-monthly','ads','vip','unlimited',999,'monthly',1,500,'["free_usd_budget", "ai_targeting", "support_247", "full_bot_features", "priority"]'::jsonb,true,25),
('ads-vip-unlimited-quarterly','ads','vip','unlimited',999,'quarterly',3,1250,'["free_usd_budget", "ai_targeting", "support_247", "full_bot_features", "priority"]'::jsonb,true,26),
('ads-vip-unlimited-yearly','ads','vip','unlimited',999,'yearly',12,5000,'["free_usd_budget", "ai_targeting", "support_247", "full_bot_features", "priority"]'::jsonb,true,27),
('studio-basic-single-monthly','studio','basic','single',1,'monthly',1,250,'["content_plan"]'::jsonb,true,28),
('studio-basic-single-quarterly','studio','basic','single',1,'quarterly',3,625,'["content_plan"]'::jsonb,true,29),
('studio-basic-single-yearly','studio','basic','single',1,'yearly',12,2500,'["content_plan"]'::jsonb,true,30),
('studio-medium-single-monthly','studio','medium','single',1,'monthly',1,500,'["content_plan", "auto_publish", "web_images", "boosting"]'::jsonb,true,31),
('studio-medium-single-quarterly','studio','medium','single',1,'quarterly',3,1250,'["content_plan", "auto_publish", "web_images", "boosting"]'::jsonb,true,32),
('studio-medium-single-yearly','studio','medium','single',1,'yearly',12,5000,'["content_plan", "auto_publish", "web_images", "boosting"]'::jsonb,true,33),
('studio-vip-single-monthly','studio','vip','single',1,'monthly',1,1000,'["content_plan", "auto_publish", "web_images", "boosting", "brain_memory", "ai_images", "selective_boost", "all_bots_access"]'::jsonb,true,34),
('studio-vip-single-quarterly','studio','vip','single',1,'quarterly',3,2500,'["content_plan", "auto_publish", "web_images", "boosting", "brain_memory", "ai_images", "selective_boost", "all_bots_access"]'::jsonb,true,35),
('studio-vip-single-yearly','studio','vip','single',1,'yearly',12,10000,'["content_plan", "auto_publish", "web_images", "boosting", "brain_memory", "ai_images", "selective_boost", "all_bots_access"]'::jsonb,true,36),
('studio-basic-triple-monthly','studio','basic','triple',3,'monthly',1,500,'["content_plan"]'::jsonb,true,37),
('studio-basic-triple-quarterly','studio','basic','triple',3,'quarterly',3,1250,'["content_plan"]'::jsonb,true,38),
('studio-basic-triple-yearly','studio','basic','triple',3,'yearly',12,5000,'["content_plan"]'::jsonb,true,39),
('studio-medium-triple-monthly','studio','medium','triple',3,'monthly',1,1000,'["content_plan", "auto_publish", "web_images", "boosting"]'::jsonb,true,40),
('studio-medium-triple-quarterly','studio','medium','triple',3,'quarterly',3,2500,'["content_plan", "auto_publish", "web_images", "boosting"]'::jsonb,true,41),
('studio-medium-triple-yearly','studio','medium','triple',3,'yearly',12,10000,'["content_plan", "auto_publish", "web_images", "boosting"]'::jsonb,true,42),
('studio-vip-triple-monthly','studio','vip','triple',3,'monthly',1,2000,'["content_plan", "auto_publish", "web_images", "boosting", "brain_memory", "ai_images", "selective_boost", "all_bots_access"]'::jsonb,true,43),
('studio-vip-triple-quarterly','studio','vip','triple',3,'quarterly',3,5000,'["content_plan", "auto_publish", "web_images", "boosting", "brain_memory", "ai_images", "selective_boost", "all_bots_access"]'::jsonb,true,44),
('studio-vip-triple-yearly','studio','vip','triple',3,'yearly',12,20000,'["content_plan", "auto_publish", "web_images", "boosting", "brain_memory", "ai_images", "selective_boost", "all_bots_access"]'::jsonb,true,45),
('studio-basic-unlimited-monthly','studio','basic','unlimited',999,'monthly',1,1250,'["content_plan"]'::jsonb,true,46),
('studio-basic-unlimited-quarterly','studio','basic','unlimited',999,'quarterly',3,3125,'["content_plan"]'::jsonb,true,47),
('studio-basic-unlimited-yearly','studio','basic','unlimited',999,'yearly',12,12500,'["content_plan"]'::jsonb,true,48),
('studio-medium-unlimited-monthly','studio','medium','unlimited',999,'monthly',1,2500,'["content_plan", "auto_publish", "web_images", "boosting"]'::jsonb,true,49),
('studio-medium-unlimited-quarterly','studio','medium','unlimited',999,'quarterly',3,6250,'["content_plan", "auto_publish", "web_images", "boosting"]'::jsonb,true,50),
('studio-medium-unlimited-yearly','studio','medium','unlimited',999,'yearly',12,25000,'["content_plan", "auto_publish", "web_images", "boosting"]'::jsonb,true,51),
('studio-vip-unlimited-monthly','studio','vip','unlimited',999,'monthly',1,5000,'["content_plan", "auto_publish", "web_images", "boosting", "brain_memory", "ai_images", "selective_boost", "all_bots_access"]'::jsonb,true,52),
('studio-vip-unlimited-quarterly','studio','vip','unlimited',999,'quarterly',3,12500,'["content_plan", "auto_publish", "web_images", "boosting", "brain_memory", "ai_images", "selective_boost", "all_bots_access"]'::jsonb,true,53),
('studio-vip-unlimited-yearly','studio','vip','unlimited',999,'yearly',12,50000,'["content_plan", "auto_publish", "web_images", "boosting", "brain_memory", "ai_images", "selective_boost", "all_bots_access"]'::jsonb,true,54)
on conflict (id) do nothing;
