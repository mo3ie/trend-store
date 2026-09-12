-- =============================================
-- Auto-Reply Bot — per-post custom replies (2026-09)
-- Each post can have its own public/private reply + attachments, keyed by numeric
-- post id. Shape: { "<postId>": { public_replies: text[], private_reply: text,
-- attachments: [{type,url}] } }. Idempotent.
-- =============================================
alter table bot_configs add column if not exists post_overrides jsonb not null default '{}'::jsonb;
