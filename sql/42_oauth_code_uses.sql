-- 42: Meta OAuth codes are single-use, but the browser can hit the callback twice
-- (a slow first run — 80+ pages — then a resend/second tap). The second exchange
-- fails with "This authorization code has been used" and its error page overwrote a
-- connection that had in fact succeeded. Each code is claimed here once; a repeat
-- waits for the first run and shows ITS result instead of re-exchanging.
create table if not exists oauth_code_uses (
  code_hash  text primary key,
  user_id    uuid,
  result     text,              -- null while the first run is still working, else the redirect query
  created_at timestamptz not null default now()
);
alter table oauth_code_uses enable row level security;   -- service role only
