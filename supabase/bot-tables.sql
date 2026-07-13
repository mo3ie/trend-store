-- =============================================
-- Auto-Reply Bot Tables — Trend Store
-- Comment + private-reply automation for Facebook Pages (and later TikTok).
-- Run this in the Supabase SQL Editor.
-- =============================================

-- Per-page bot configuration. One row per (user, page, platform).
create table if not exists bot_configs (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references auth.users not null,
  page_id              text not null,
  page_name            text,
  page_picture         text,
  platform             text not null default 'meta',   -- 'meta' | 'tiktok'
  enabled              boolean not null default false,  -- master on/off for this page
  reply_public         boolean not null default true,   -- post a public reply on the comment
  reply_private        boolean not null default true,   -- send a private reply (DM)
  ai_enabled           boolean not null default false,  -- use AI when no keyword rule matches
  ai_persona           text,                            -- system prompt / brand voice for AI
  default_public_reply text default 'تمّت مراسلتك في الخاص ✅',
  throttle_per_min     int  not null default 20,        -- max replies/min (anti-block)
  webhook_subscribed   boolean not null default false,  -- page subscribed_apps done
  created_at           timestamptz default now(),
  updated_at           timestamptz default now(),
  unique(user_id, page_id, platform)
);

alter table bot_configs enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='bot_configs' and policyname='users_own_bot_configs') then
    create policy "users_own_bot_configs" on bot_configs for all using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='bot_configs' and policyname='admin_all_bot_configs') then
    create policy "admin_all_bot_configs" on bot_configs for all using (
      exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    );
  end if;
end $$;

-- Keyword → reply rules. Evaluated by priority (higher first), then created_at.
create table if not exists bot_rules (
  id            uuid primary key default gen_random_uuid(),
  config_id     uuid references bot_configs on delete cascade not null,
  name          text,
  keywords      text[] not null default '{}',
  -- 'any_contains' | 'all_contains' | 'exact' | 'regex' | 'catch_all'
  match_type    text not null default 'any_contains',
  public_reply  text,                       -- overrides config.default_public_reply when set
  private_reply text,                       -- the DM body (price/details)
  attachments   jsonb not null default '[]'::jsonb, -- [{ "type": "image"|"file", "url": "..." }]
  enabled       boolean not null default true,
  priority      int not null default 0,
  created_at    timestamptz default now()
);

alter table bot_rules enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='bot_rules' and policyname='users_own_bot_rules') then
    create policy "users_own_bot_rules" on bot_rules for all using (
      exists (select 1 from bot_configs c where c.id = bot_rules.config_id and c.user_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where tablename='bot_rules' and policyname='admin_all_bot_rules') then
    create policy "admin_all_bot_rules" on bot_rules for all using (
      exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    );
  end if;
end $$;

-- Idempotency + audit log. UNIQUE(comment_id) guarantees a comment is processed once —
-- Meta only allows ONE private reply per comment, and webhooks can redeliver.
create table if not exists bot_reply_log (
  id              uuid primary key default gen_random_uuid(),
  config_id       uuid references bot_configs on delete cascade,
  page_id         text not null,
  comment_id      text not null unique,
  post_id         text,
  commenter_id    text,
  commenter_name  text,
  comment_message text,
  matched_rule_id uuid,
  public_status   text default 'skipped', -- sent | skipped | failed
  private_status  text default 'skipped', -- sent | skipped | failed
  used_token_id   uuid,
  error           text,
  -- when we actually called the Graph API. The throttle counts replies/min off THIS,
  -- not created_at (a deferred comment is created early but sent much later).
  sent_at         timestamptz,
  created_at      timestamptz default now()
);

alter table bot_reply_log enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='bot_reply_log' and policyname='users_own_bot_log') then
    create policy "users_own_bot_log" on bot_reply_log for all using (
      exists (select 1 from bot_configs c where c.id = bot_reply_log.config_id and c.user_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where tablename='bot_reply_log' and policyname='admin_all_bot_log') then
    create policy "admin_all_bot_log" on bot_reply_log for all using (
      exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    );
  end if;
end $$;

-- Rotation pool: multiple Page access tokens (from different admin FB accounts) for the
-- SAME page. On a rate-limit block, the token is put in cooldown and the next active token
-- is used. This is the failover layer; throttle_per_min is the primary anti-block defense.
create table if not exists bot_page_tokens (
  id             uuid primary key default gen_random_uuid(),
  config_id      uuid references bot_configs on delete cascade not null,
  user_id        uuid references auth.users not null,
  page_id        text not null,
  label          text,                    -- e.g. the FB account/admin name
  fb_user_id     text,
  access_token   text not null,
  -- TikTok access tokens are short-lived and must be refreshed (Meta page tokens are
  -- long-lived, so these stay null on the Meta side).
  refresh_token  text,
  expires_at     timestamptz,
  status         text not null default 'active', -- active | cooldown | dead
  cooldown_until timestamptz,
  fail_count     int not null default 0,
  last_used_at   timestamptz,
  created_at     timestamptz default now()
);

alter table bot_page_tokens enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='bot_page_tokens' and policyname='users_own_bot_tokens') then
    create policy "users_own_bot_tokens" on bot_page_tokens for all using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='bot_page_tokens' and policyname='admin_all_bot_tokens') then
    create policy "admin_all_bot_tokens" on bot_page_tokens for all using (
      exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    );
  end if;
end $$;

-- Monthly subscription per page. Billing debits wallets.balance (same wallet as ads).
create table if not exists bot_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users not null,
  page_id    text not null,
  platform   text not null default 'meta',
  plan       text not null default 'monthly',
  status     text not null default 'active', -- active | expired | trial | cancelled
  price_lyd  numeric not null default 0,
  started_at timestamptz default now(),
  expires_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id, page_id, platform)
);

alter table bot_subscriptions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='bot_subscriptions' and policyname='users_own_bot_subs') then
    create policy "users_own_bot_subs" on bot_subscriptions for all using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='bot_subscriptions' and policyname='admin_all_bot_subs') then
    create policy "admin_all_bot_subs" on bot_subscriptions for all using (
      exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    );
  end if;
end $$;

-- Bot pricing (admin-editable). Single-row settings table like ads pricing.
create table if not exists bot_settings (
  id                  int primary key default 1,
  monthly_price_lyd   numeric not null default 50,
  trial_days          int not null default 0,
  updated_at          timestamptz default now(),
  constraint bot_settings_singleton check (id = 1)
);
insert into bot_settings (id) values (1) on conflict (id) do nothing;

alter table bot_settings enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='bot_settings' and policyname='anyone_read_bot_settings') then
    create policy "anyone_read_bot_settings" on bot_settings for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='bot_settings' and policyname='admin_write_bot_settings') then
    create policy "admin_write_bot_settings" on bot_settings for all using (
      exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    );
  end if;
end $$;

-- Indexes
create index if not exists idx_bot_configs_user     on bot_configs(user_id);
create index if not exists idx_bot_configs_page      on bot_configs(page_id);
create index if not exists idx_bot_rules_config      on bot_rules(config_id);
create index if not exists idx_bot_reply_log_config  on bot_reply_log(config_id);
create index if not exists idx_bot_reply_log_comment on bot_reply_log(comment_id);
-- Throttle counter (replies per config in the last minute) + drain queue scan.
create index if not exists idx_bot_reply_log_sent     on bot_reply_log(config_id, sent_at);
create index if not exists idx_bot_reply_log_deferred on bot_reply_log(public_status, created_at);
create index if not exists idx_bot_page_tokens_config on bot_page_tokens(config_id);
create index if not exists idx_bot_subs_user         on bot_subscriptions(user_id);
