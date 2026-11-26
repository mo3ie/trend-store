-- ─────────────────────────────────────────────────────────────────────────────
-- 45 — write down WHY an OAuth attempt failed, where it can be read afterwards.
--
-- Five advertiser-link attempts, five consumed states, zero grants. Each state
-- is claimed exactly once, 10–14 seconds after it is created — a real human
-- pressing Confirm — and the browser still lands on an error. The reason exists
-- for about a millisecond, inside a serverless invocation, and then it is gone:
-- the redirect carries a category, `console.error` goes to a log nobody here can
-- read, and the row keeps no trace at all.
--
-- So every diagnosis so far has been inference from timestamps. That is how this
-- has cost the operator five rounds of "press it again and tell me what it says".
--
-- Three columns on the row that already exists, one per attempt, written at the
-- moment of failure:
--
--   fail_stage  where it died: state | exchange | store
--   fail_code   TikTok's own numeric code when it came from TikTok
--   failed_at   when, so a stale reason from last week is never mistaken for now
--
-- ## What is NOT stored
--
-- No token, no auth_code, no binding, no upstream error text. A code and a stage
-- name identify the fault without carrying anything worth stealing — and this
-- table is already the one holding state hashes, so it is the right place and
-- the wrong place to get careless.
--
-- RLS is not added because `tiktok_oauth_states` is service-role only; no
-- browser-facing client has ever read it.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.tiktok_oauth_states
  add column if not exists fail_stage text,
  add column if not exists fail_code  text,
  add column if not exists failed_at  timestamptz;

comment on column public.tiktok_oauth_states.fail_stage is
  'Where the attempt died: state | exchange | store. NULL means it did not fail here.';
comment on column public.tiktok_oauth_states.fail_code is
  'TikTok''s own numeric error code, or our ConsumeFailure reason. Never a token or an auth code.';
