-- =============================================
-- TikTok ADVERTISER / Marketing API OAuth — storage (additive)
-- Migration order: AFTER tiktok-oauth-phase1.sql (it extends tiktok_oauth_states' flow check).
-- Idempotent. NON-DESTRUCTIVE.
--
-- The advertiser grant is a DIFFERENT credential from the organic account token, so it gets
-- its own tables. Reusing tiktok_tokens would be wrong: that row models a 1-day access token
-- plus a 1-year refresh token for ONE open_id, whereas an advertiser grant is a single
-- long-term token (no expiry, no refresh) that can cover MANY advertiser_ids.
--
-- Nothing here touches Meta data, the storefront, payments/wallet, or the organic TikTok
-- tables (tiktok_accounts / tiktok_tokens / bot_*).
-- =============================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Allow the advertiser flow to use the existing, hardened OAuth state machinery.
--    Same table, same single-use/expiry/binding guarantees, distinct `flow` value so an
--    organic state can never be replayed against the advertiser callback (the application
--    also checks the expected flow when consuming).
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  if exists (
    select 1 from pg_constraint where conname = 'tiktok_oauth_states_flow_chk'
  ) then
    alter table tiktok_oauth_states drop constraint tiktok_oauth_states_flow_chk;
  end if;

  alter table tiktok_oauth_states
    add constraint tiktok_oauth_states_flow_chk
    check (flow in ('connect', 'reconnect', 'scope_upgrade', 'advertiser_connect', 'advertiser_reconnect'));
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. The advertiser grant — CREDENTIALS. One row per authorization.
--
-- RLS is enabled with ZERO policies: under RLS a table with no policy denies every
-- anon/authenticated request, so the browser cannot read a token even with a valid session.
-- Only the service-role key (server-side route handlers) bypasses RLS.
--
-- access_token holds CIPHERTEXT from src/lib/tokenCrypto.ts (AES-256-GCM, key from the
-- server-only TOKEN_ENCRYPTION_KEY), never plaintext.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists tiktok_ads_authorizations (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users on delete cascade,
  -- Long-term token: no expiry and no refresh token exist for this grant type, so there is
  -- deliberately no refresh_token / refresh_lock_at column here.
  access_token   text,
  -- Numeric permission scope IDs exactly as returned by /oauth2/access_token/.
  scope          int[]       not null default '{}',
  -- Ad accounts the token can access, as returned with the grant.
  advertiser_ids text[]      not null default '{}',
  status         text        not null default 'active',   -- active | revoked | error
  connected_at   timestamptz not null default now(),
  revoked_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint tiktok_ads_auth_status_chk check (status in ('active', 'revoked', 'error'))
);

-- One ACTIVE grant per user; re-authorizing replaces it. Revoked rows are kept for audit.
create unique index if not exists idx_tiktok_ads_auth_active_user
  on tiktok_ads_authorizations (user_id) where status = 'active';

create index if not exists idx_tiktok_ads_auth_user on tiktok_ads_authorizations (user_id);

alter table tiktok_ads_authorizations enable row level security;
-- INTENTIONALLY NO POLICIES.

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Ad accounts — SAFE METADATA ONLY, one row per advertiser_id. No credentials here, so
--    the UI may read its owner's rows.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists tiktok_ad_accounts (
  id               uuid        primary key default gen_random_uuid(),
  authorization_id uuid        not null references tiktok_ads_authorizations on delete cascade,
  user_id          uuid        not null references auth.users on delete cascade,
  advertiser_id    text        not null,
  advertiser_name  text,                                   -- filled in a later phase
  status           text        not null default 'active',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, advertiser_id)
);

create index if not exists idx_tiktok_ad_accounts_auth on tiktok_ad_accounts (authorization_id);

alter table tiktok_ad_accounts enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'tiktok_ad_accounts' and policyname = 'tiktok_ad_accounts_owner_select') then
    create policy "tiktok_ad_accounts_owner_select" on tiktok_ad_accounts
      for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'tiktok_ad_accounts' and policyname = 'tiktok_ad_accounts_admin_select') then
    create policy "tiktok_ad_accounts_admin_select" on tiktok_ad_accounts
      for select using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
  end if;
end $$;

-- updated_at triggers (set_updated_at() was created by tiktok-oauth-phase1.sql)
drop trigger if exists trg_tiktok_ads_auth_updated on tiktok_ads_authorizations;
create trigger trg_tiktok_ads_auth_updated before update on tiktok_ads_authorizations
  for each row execute function set_updated_at();

drop trigger if exists trg_tiktok_ad_accounts_updated on tiktok_ad_accounts;
create trigger trg_tiktok_ad_accounts_updated before update on tiktok_ad_accounts
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification (read-only):
--   select tablename, rowsecurity from pg_tables
--    where tablename in ('tiktok_ads_authorizations','tiktok_ad_accounts');
--   -- expect rowsecurity = true for both
--
--   select count(*) from pg_policies where tablename = 'tiktok_ads_authorizations';
--   -- expect 0 (credentials are service-role only)
--
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conname = 'tiktok_oauth_states_flow_chk';
--   -- expect the list to include 'advertiser_connect'
-- ─────────────────────────────────────────────────────────────────────────────
