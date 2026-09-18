-- =============================================
-- PROPOSED — hide existing credential columns from the browser
-- STATUS: NOT APPLIED. Do not run this until the checks below pass.
--
-- Audit finding #3/#4: bot_page_tokens and connected_pages both carry the RLS policy
--   for all using (auth.uid() = user_id)
-- so a signed-in user's own browser client (anon key) can `select access_token,
-- refresh_token, page_access_token`. The API routes never return them, but RLS allows it.
--
-- WHY THIS IS NOT AUTO-APPLIED:
--   * These tables are LIVE Meta data — 30 rows in bot_page_tokens, 87 in connected_pages.
--   * The Supabase project is shared by several apps (see project notes). A different
--     app reading these columns with the anon key would break the moment this runs.
--   * Revoking column privileges is invisible in code review of THIS repo alone.
--
-- PRE-FLIGHT (must all pass before running):
--   1. grep every repo sharing this Supabase project for `connected_pages` and
--      `bot_page_tokens` used with the ANON key (browser clients / mobile apps).
--      In trend-store this was verified: zero client-side reads — every access is
--      server-side through supabaseAdmin (service role).
--   2. Confirm no Supabase Edge Function / external tool selects these columns as anon.
--   3. Apply on a branch/staging database first, then run the verification block.
-- =============================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Option A (RECOMMENDED) — column-level REVOKE.
-- Row policies stay exactly as they are, so every non-credential column keeps working
-- for the browser; only the secret columns become unreadable to anon/authenticated.
-- The service-role key bypasses this entirely, so all API routes are unaffected.
-- ─────────────────────────────────────────────────────────────────────────────
revoke select (access_token, refresh_token) on table bot_page_tokens from anon, authenticated;
revoke select (page_access_token)           on table connected_pages from anon, authenticated;

-- Also block writes to the credential columns from the browser.
revoke insert (access_token, refresh_token), update (access_token, refresh_token)
  on table bot_page_tokens from anon, authenticated;
revoke insert (page_access_token), update (page_access_token)
  on table connected_pages from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Option B (stricter, more disruptive) — drop the permissive row policies outright,
-- making both tables service-role only. Use ONLY if pre-flight shows no client reads
-- of ANY column of these tables.
--
--   drop policy if exists "users_own_bot_tokens" on bot_page_tokens;
--   drop policy if exists "admin_all_bot_tokens" on bot_page_tokens;
--   drop policy if exists "users_own_pages"      on connected_pages;
--   drop policy if exists "admin_all_pages"      on connected_pages;
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICATION (run as the anon role, or from a browser client with a valid session):
--
--   select access_token from bot_page_tokens limit 1;      -- expect: permission denied
--   select page_access_token from connected_pages limit 1; -- expect: permission denied
--   select id, label, status from bot_page_tokens limit 1; -- expect: still works
--   select id, page_name from connected_pages limit 1;     -- expect: still works
--
-- Then in the app: open /bot and /ads, confirm pages still list and the bot still
-- toggles (both go through service-role API routes, so they must be unchanged).
--
-- ROLLBACK:
--   grant select (access_token, refresh_token) on table bot_page_tokens to anon, authenticated;
--   grant select (page_access_token)           on table connected_pages to anon, authenticated;
-- ─────────────────────────────────────────────────────────────────────────────
