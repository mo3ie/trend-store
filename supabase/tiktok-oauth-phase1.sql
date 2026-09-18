-- =============================================
-- TikTok — OAuth state + dedicated account/token storage (Phase 1: hardening)
-- Migration order: run AFTER supabase/security-rate-limits.sql.
-- Idempotent: safe to run more than once. NON-DESTRUCTIVE — creates new tables only.
-- Nothing here touches bot_configs / bot_page_tokens / connected_pages, so the live
-- Meta bot, the ads flow and the storefront are unaffected.
--
-- Verified before writing this migration: bot_configs currently holds 0 rows with
-- platform = 'tiktok', so there is no TikTok data to migrate into these tables.
-- =============================================

-- Shared updated_at trigger (created once, reused by both tables below).
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. OAuth state — CSRF protection for the authorize → callback round trip.
--
-- The state VALUE is never stored: only sha256(state) and sha256(cookie binding).
-- A leak of this table therefore cannot be replayed into a valid callback, and the
-- state carries no user id (it is 32 random bytes), so it cannot be forged from a
-- known user id the way the previous base64(user.id) scheme could.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists tiktok_oauth_states (
  id            uuid        primary key default gen_random_uuid(),
  -- sha256 of the random state (hex, 64 chars). UNIQUE = the single-use claim anchor.
  state_hash    text        not null unique,
  -- sha256 of the random value held in the HttpOnly cookie. Both must match.
  binding_hash  text        not null,
  user_id       uuid        not null references auth.users on delete cascade,
  provider      text        not null default 'tiktok',
  flow          text        not null default 'connect',   -- connect | reconnect | scope_upgrade
  redirect_path text,                                     -- app path to return to, must start with '/'
  scopes        text[]      not null default '{}',         -- scopes requested for this attempt
  expires_at    timestamptz not null,
  consumed_at   timestamptz,                              -- set once, by the callback
  created_at    timestamptz not null default now(),
  constraint tiktok_oauth_states_state_hash_len check (char_length(state_hash) = 64),
  constraint tiktok_oauth_states_binding_hash_len check (char_length(binding_hash) = 64),
  constraint tiktok_oauth_states_provider_chk check (provider in ('tiktok')),
  constraint tiktok_oauth_states_flow_chk check (flow in ('connect', 'reconnect', 'scope_upgrade')),
  -- A relative in-app path only — blocks open-redirect values in the return path.
  constraint tiktok_oauth_states_redirect_rel check (redirect_path is null or redirect_path like '/%'),
  -- Short TTL is enforced in code; this keeps a pathological row from living forever.
  constraint tiktok_oauth_states_ttl check (expires_at > created_at and expires_at < created_at + interval '1 hour')
);

create index if not exists idx_tiktok_oauth_states_user    on tiktok_oauth_states (user_id);
create index if not exists idx_tiktok_oauth_states_expires on tiktok_oauth_states (expires_at);

-- Service-role only: RLS on, ZERO policies. The browser must never read a pending state.
alter table tiktok_oauth_states enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TikTok accounts — SAFE METADATA ONLY. No credentials in this table.
-- This is the table the UI is allowed to read (own rows).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists tiktok_accounts (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users on delete cascade,
  -- TikTok account identifier as returned by the official API (open_id / business id).
  -- Kept as text: the exact field name is confirmed at integration time, not assumed here.
  tiktok_account_id text     not null,
  union_id       text,
  username       text,
  display_name   text,
  avatar_url     text,
  granted_scopes text[]      not null default '{}',
  connected_at   timestamptz not null default now(),
  revoked_at     timestamptz,                             -- set by the disconnect flow
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, tiktok_account_id)
);

create index if not exists idx_tiktok_accounts_user   on tiktok_accounts (user_id);
create index if not exists idx_tiktok_accounts_active on tiktok_accounts (user_id) where revoked_at is null;

alter table tiktok_accounts enable row level security;

-- Owner may READ their own account metadata (no credentials live here).
-- All writes go through the service-role client in the API routes.
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'tiktok_accounts' and policyname = 'tiktok_accounts_owner_select') then
    create policy "tiktok_accounts_owner_select" on tiktok_accounts
      for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'tiktok_accounts' and policyname = 'tiktok_accounts_admin_select') then
    create policy "tiktok_accounts_admin_select" on tiktok_accounts
      for select using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TikTok tokens — CREDENTIALS. Separate table so it can be locked down on its own.
--
-- RLS is enabled with ZERO policies: under RLS a table with no policy denies every
-- anon/authenticated request, so the browser cannot select a token even with a valid
-- session. Only the service-role key (server-side API routes) bypasses RLS.
--
-- Token columns hold CIPHERTEXT produced by src/lib/tokenCrypto.ts (AES-256-GCM,
-- key from the server-only TOKEN_ENCRYPTION_KEY env var), never plaintext.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists tiktok_tokens (
  id                 uuid        primary key default gen_random_uuid(),
  account_id         uuid        not null references tiktok_accounts on delete cascade,
  access_token       text,                                -- encrypted; null once revoked
  refresh_token      text,                                -- encrypted; null when not applicable
  access_expires_at  timestamptz,
  refresh_expires_at timestamptz,
  status             text        not null default 'active', -- active | expired | revoked | error
  last_refreshed_at  timestamptz,
  -- Concurrency guard: a refresher claims the row by stamping this, and clears it when
  -- done. A stale stamp (older than the lock TTL) is reclaimable so a crash cannot wedge it.
  refresh_lock_at    timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- One credential row per account keeps "which token is current" unambiguous.
  unique (account_id),
  constraint tiktok_tokens_status_chk check (status in ('active', 'expired', 'revoked', 'error'))
);

create index if not exists idx_tiktok_tokens_account on tiktok_tokens (account_id);
create index if not exists idx_tiktok_tokens_expiry  on tiktok_tokens (access_expires_at) where status = 'active';

alter table tiktok_tokens enable row level security;
-- INTENTIONALLY NO POLICIES. Do not add one without re-reading the note above.

-- updated_at triggers
drop trigger if exists trg_tiktok_accounts_updated on tiktok_accounts;
create trigger trg_tiktok_accounts_updated before update on tiktok_accounts
  for each row execute function set_updated_at();

drop trigger if exists trg_tiktok_tokens_updated on tiktok_tokens;
create trigger trg_tiktok_tokens_updated before update on tiktok_tokens
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification queries (read-only — run after applying):
--
--   select tablename, rowsecurity from pg_tables
--    where tablename in ('tiktok_oauth_states','tiktok_accounts','tiktok_tokens','security_rate_limits');
--   -- expect rowsecurity = true for all four
--
--   select tablename, policyname, cmd from pg_policies
--    where tablename in ('tiktok_oauth_states','tiktok_tokens','security_rate_limits');
--   -- expect ZERO rows (no client policy on state / token / rate-limit tables)
-- ─────────────────────────────────────────────────────────────────────────────
