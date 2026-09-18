-- =============================================
-- TikTok Phase 2.2 — Accounts API foundation (additive)
-- Migration order: AFTER security-rate-limits.sql and tiktok-oauth-phase1.sql.
-- Idempotent. NON-DESTRUCTIVE: adds columns/tables only, touches no existing data.
-- Nothing here affects bot_configs, bot_page_tokens, connected_pages, wallets or the
-- storefront, so the Meta bot and payments are unaffected.
-- =============================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. open_id / business_id on tiktok_accounts.
--
-- The official docs define business_id as "the value of the open_id field returned in the
-- response of /tt_user/oauth2/token/". Making both columns GENERATED from the single stored
-- identifier enforces that at the database level: they can never drift, and no second
-- identifier mapping can be introduced by accident.
-- ─────────────────────────────────────────────────────────────────────────────
alter table tiktok_accounts
  add column if not exists open_id text generated always as (tiktok_account_id) stored;

alter table tiktok_accounts
  add column if not exists business_id text generated always as (tiktok_account_id) stored;

-- Connection state, independent of the credential status in tiktok_tokens.
alter table tiktok_accounts
  add column if not exists status text not null default 'active';

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'tiktok_accounts_status_chk'
  ) then
    alter table tiktok_accounts
      add constraint tiktok_accounts_status_chk
      check (status in ('active', 'revoked', 'reauth_required'));
  end if;
end $$;

-- Webhook deliveries arrive keyed by user_openid and must resolve to an account fast.
create index if not exists idx_tiktok_accounts_open_id
  on tiktok_accounts (tiktok_account_id) where revoked_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. App-level webhook configuration.
--
-- TikTok webhook configuration is per DEVELOPER APP, not per customer: one callback URL
-- serves every connected account. This single-row table records what we registered so the
-- UI can show whether the integration is live without calling TikTok on every page load.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists tiktok_webhook_config (
  id           int primary key default 1,
  event_type   text        not null default 'COMMENT',
  callback_url text,
  subscribed   boolean     not null default false,
  last_event_at timestamptz,                      -- last delivery we accepted (signature valid)
  last_error   text,
  updated_at   timestamptz not null default now(),
  constraint tiktok_webhook_config_singleton check (id = 1),
  constraint tiktok_webhook_config_event_chk check (event_type in ('COMMENT', 'VIDEO'))
);
insert into tiktok_webhook_config (id) values (1) on conflict (id) do nothing;

-- Service-role only: RLS on, ZERO policies. The UI reads it through an API route.
alter table tiktok_webhook_config enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Link the existing bot rule engine to a TikTok account.
--
-- Rules, reply logs and subscriptions stay in the bot_* tables (one rule engine, as
-- required). bot_configs.page_id already holds the account identifier for platform =
-- 'tiktok'; that identifier is now the open_id. This column makes the join explicit and
-- lets the webhook go from open_id -> account -> config in one hop.
-- ─────────────────────────────────────────────────────────────────────────────
alter table bot_configs
  add column if not exists tiktok_account_id uuid references tiktok_accounts (id) on delete set null;

create index if not exists idx_bot_configs_tiktok_account
  on bot_configs (tiktok_account_id) where tiktok_account_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification (read-only):
--
--   select column_name, is_generated from information_schema.columns
--    where table_name = 'tiktok_accounts' and column_name in ('open_id','business_id');
--   -- expect is_generated = ALWAYS for both
--
--   select tablename, rowsecurity from pg_tables where tablename = 'tiktok_webhook_config';
--   -- expect true
--   select count(*) from pg_policies where tablename = 'tiktok_webhook_config';
--   -- expect 0
-- ─────────────────────────────────────────────────────────────────────────────
