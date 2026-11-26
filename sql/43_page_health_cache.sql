-- 43: cache each connected Page's token health. /ads/connect used to ask Graph about
-- EVERY page on EVERY visit (2 calls × 82 pages × each open) and spent the app's
-- hourly Graph quota ("(#4) Application request limit reached"), which then blocked
-- OAuth itself — and the throttling errors were read as "dead" tokens.
alter table connected_pages
  add column if not exists token_status      text,          -- alive | dead | null (unknown / not checked)
  add column if not exists can_publish       boolean,
  add column if not exists health_checked_at timestamptz;
