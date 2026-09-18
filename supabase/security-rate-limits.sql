-- =============================================
-- Security — generic API rate limiting (Phase 1)
-- Migration order: run this FIRST (tiktok-oauth-phase1.sql depends on nothing here,
-- but the OAuth routes call the limiter, so having the table avoids a fail-open path).
-- Idempotent: safe to run more than once. NON-DESTRUCTIVE.
-- =============================================

-- One row per request hit. The limiter counts rows in the window instead of doing a
-- read-modify-write counter, so concurrent requests cannot lose increments.
create table if not exists security_rate_limits (
  id         bigserial primary key,
  bucket     text        not null,           -- logical route, e.g. 'tiktok_oauth_start'
  identifier text        not null,           -- user id, or 'ip:1.2.3.4' when anonymous
  created_at timestamptz not null default now()
);

-- The limiter's only query shape: count hits for (bucket, identifier) since <window start>.
create index if not exists idx_security_rate_limits_lookup
  on security_rate_limits (bucket, identifier, created_at desc);

-- Used by the opportunistic sweeper that deletes rows older than the longest window.
create index if not exists idx_security_rate_limits_created
  on security_rate_limits (created_at);

-- Service-role only: RLS on, ZERO policies. No browser client can read or write hits.
alter table security_rate_limits enable row level security;
