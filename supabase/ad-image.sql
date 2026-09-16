-- Custom image for a Page-likes ad creative (falls back to the Page picture).
-- Idempotent — safe to re-run.

alter table ad_campaigns add column if not exists ad_image text;
