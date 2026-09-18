-- Per-post auto-reply settings, applied to the bot's post_overrides on publish.
-- Idempotent — safe to re-run.
alter table studio_posts add column if not exists reply_config jsonb;
