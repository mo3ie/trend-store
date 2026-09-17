-- Store the AI's visual description per planned post (so images can be regenerated).
-- Idempotent — safe to re-run.
alter table studio_posts add column if not exists image_prompt text;
alter table studio_posts add column if not exists post_type text;
