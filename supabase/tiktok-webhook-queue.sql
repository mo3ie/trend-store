-- =============================================
-- TikTok Phase 2.2.1 — durable webhook intake (additive)
-- Migration order: AFTER security-rate-limits.sql, tiktok-oauth-phase1.sql, tiktok-phase2-2.sql.
-- Idempotent. NON-DESTRUCTIVE: adds nullable columns + one index. No data is modified.
--
-- WHY THERE IS NO NEW QUEUE TABLE
-- This project already has a durable, Supabase-backed job mechanism: the Meta bot parks work
-- in bot_reply_log (public_status = 'deferred') and a cron drains it. TikTok reuses that
-- pattern with its own status value, which means the durable record and the deduplication
-- claim are THE SAME ROW — there is exactly one deduplication authority, and the webhook and
-- the reconciliation poll contend for it rather than maintaining separate state.
--
-- SAFETY FOR THE LIVE META BOT
-- drainDeferred() selects strictly `public_status = 'deferred'`, so rows in the TikTok
-- lifecycle (queued -> processing -> sent|skipped|failed) are invisible to it. All columns
-- below are nullable and unused by Meta code paths.
-- =============================================

-- Durable-intake fields. Meta rows simply leave these NULL.
alter table bot_reply_log add column if not exists event_action text;        -- insert | delete | set_to_hidden | ...
alter table bot_reply_log add column if not exists event_type   text;        -- comment | reply
alter table bot_reply_log add column if not exists received_at  timestamptz; -- when the webhook delivery was accepted
alter table bot_reply_log add column if not exists processed_at timestamptz; -- when processing finished
alter table bot_reply_log add column if not exists attempts     int not null default 0;

-- The drain's only query shape: oldest queued rows first.
create index if not exists idx_bot_reply_log_queued
  on bot_reply_log (public_status, created_at)
  where public_status in ('queued', 'processing');

-- ─────────────────────────────────────────────────────────────────────────────
-- The deduplication key is the EXISTING constraint created in bot-tables.sql:
--
--   comment_id text not null unique
--
-- It is what makes a duplicate webhook delivery a no-op (unique violation -> "duplicate"),
-- and what stops the reconciliation poll from replying to a comment the webhook already
-- claimed. Do not add a second uniqueness rule anywhere else for TikTok comments.
--
-- Verification (read-only):
--   select column_name, is_nullable from information_schema.columns
--    where table_name = 'bot_reply_log'
--      and column_name in ('event_action','event_type','received_at','processed_at','attempts');
--
--   select indexname from pg_indexes where tablename = 'bot_reply_log';
--   -- expect idx_bot_reply_log_queued
--
--   select conname from pg_constraint where conrelid = 'bot_reply_log'::regclass and contype = 'u';
--   -- expect exactly one unique constraint, on comment_id
-- ─────────────────────────────────────────────────────────────────────────────
