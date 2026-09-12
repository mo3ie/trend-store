-- =============================================
-- Auto-Reply Bot — feature additions (2026-09)
-- Reply variety, comment-like, private-message default, per-reply delay,
-- post targeting, and a manually-chosen "active" account.
-- Idempotent: safe to run more than once.
-- =============================================

-- Per-page config additions
alter table bot_configs add column if not exists like_comments        boolean not null default false;   -- auto-like each replied comment
alter table bot_configs add column if not exists min_delay_sec        int     not null default 2;       -- min seconds before a reply (human pacing)
alter table bot_configs add column if not exists max_delay_sec        int     not null default 6;       -- max seconds before a reply
alter table bot_configs add column if not exists default_private_reply text;                             -- fallback DM when a rule has none
alter table bot_configs add column if not exists public_replies       text[]  not null default '{}';    -- pool of public-reply variants (picked at random)
alter table bot_configs add column if not exists post_filter          text[]  not null default '{}';    -- post ids the bot replies on (empty = all)
alter table bot_configs add column if not exists post_filter_enabled  boolean not null default false;   -- when true, only reply on posts in post_filter
alter table bot_configs add column if not exists active_token_id      uuid;                              -- the account the bot replies from first

-- Per-rule reply variety
alter table bot_rules   add column if not exists public_replies       text[]  not null default '{}';    -- rule-level public-reply variants
