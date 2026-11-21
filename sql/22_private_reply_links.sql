-- ─────────────────────────────────────────────────────────────────────────────
-- The private reply, for a platform that has no private messages.
--
-- On Facebook the bot answers a comment publicly with "we've messaged you" and
-- sends the price in a DM, so the price never appears under the post. TikTok has
-- no DM we may use: the Business Messaging application has been frozen by TikTok
-- itself since 7 Nov 2026, and even when it reopens it will only serve Verified
-- Business Accounts, which effectively do not exist in Libya yet.
--
-- So the engine did the only thing it could and POSTED the private text publicly:
--
--     const reply = decision.privateText || decision.publicText;
--
-- which means the price a merchant wrote "for the DM" is read by every visitor.
-- That defeats the whole mechanic — the comment is supposed to be the toll the
-- customer pays to learn the price.
--
-- This replaces the missing channel with one the platform cannot take away: a
-- single-use link. The public comment carries an opaque token; the price lives
-- behind it. Everyone sees a link, only the commenter opens it.
--
-- Why a snapshot and not a join: the row copies the body, brand and WhatsApp
-- number as they were WHEN THE COMMENT WAS ANSWERED. A merchant who edits their
-- price tomorrow must not silently rewrite what a customer was quoted today, and
-- the public page must not have to touch the merchant's live configuration.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.bot_configs
  -- 'off'  — current behaviour: the private text is posted publicly (or DM'd on FB)
  -- 'link' — the private text goes behind a token and the comment carries the link
  add column if not exists private_delivery        text    not null default 'off',
  -- The merchant's own wording for the public comment. The link is appended by the
  -- engine, never typed by the merchant: a hand-written URL cannot be per-commenter.
  add column if not exists private_link_text       text,
  add column if not exists whatsapp_number         text,
  add column if not exists whatsapp_text           text,
  add column if not exists private_link_ttl_hours  int     not null default 48,
  add column if not exists private_link_max_opens  int     not null default 3;

create table if not exists public.private_links (
  id                  uuid primary key default gen_random_uuid(),
  -- Short, random, non-sequential. Guessing one must not reveal another.
  token               text        not null unique,
  config_id           uuid        not null references public.bot_configs(id) on delete cascade,
  user_id             uuid        not null,
  platform            text        not null default 'tiktok',
  page_id             text,
  comment_id          text,
  video_id            text,
  commenter_name      text,
  -- Snapshots, deliberately. See the header.
  body                text        not null,
  brand_name          text,
  whatsapp_number     text,
  whatsapp_text       text,
  opens               int         not null default 0,
  max_opens           int         not null default 3,
  expires_at          timestamptz not null,
  first_opened_at     timestamptz,
  last_opened_at      timestamptz,
  whatsapp_clicked_at timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists private_links_config_idx
  on public.private_links (config_id, created_at desc);

-- One link per comment. The engine can be re-entered for the same comment by the
-- webhook and by the reconciliation sweep, and two links for one customer would
-- mean two different quotes in the same thread.
create unique index if not exists private_links_comment_idx
  on public.private_links (platform, comment_id) where comment_id is not null;

-- Credentials-grade: the table holds customer names and quoted prices for every
-- merchant on the platform. RLS on with ZERO policies means only the service role
-- reaches it, so a leaked anon key reads nothing.
alter table public.private_links enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- Opening a link.
--
-- The conditional UPDATE ... RETURNING is the whole concurrency guard: the row is
-- only handed back to the caller that actually incremented it, so two taps landing
-- at the same moment cannot both consume the last remaining open.
--
-- `p_count = false` renders without spending an open. The page passes false when
-- the viewer already has this link's cookie, so a refresh or a back-button does
-- not burn the customer's own quota — the limit is there to stop the link being
-- passed around, not to punish the person it was written for.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.open_private_link(p_token text, p_count boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.private_links%rowtype;
begin
  if p_count then
    update public.private_links
       set opens           = opens + 1,
           first_opened_at = coalesce(first_opened_at, now()),
           last_opened_at  = now()
     where token = p_token
       and expires_at > now()
       and opens < max_opens
    returning * into r;
  else
    select * into r from public.private_links
     where token = p_token and expires_at > now();
  end if;

  -- Nothing came back: say WHICH kind of nothing, so the page can tell the
  -- customer "this link expired" instead of a blank "not found".
  if r.id is null then
    select * into r from public.private_links where token = p_token;
    if r.id is null then
      return jsonb_build_object('state', 'missing');
    end if;
    return jsonb_build_object(
      'state', case when r.expires_at <= now() then 'expired' else 'exhausted' end
    );
  end if;

  return jsonb_build_object(
    'state',         'ok',
    'body',          r.body,
    'name',          r.commenter_name,
    'brand',         r.brand_name,
    'whatsapp',      r.whatsapp_number,
    'whatsapp_text', r.whatsapp_text,
    'opens',         r.opens,
    'max_opens',     r.max_opens
  );
end;
$$;

-- The function takes a bare token, so anyone able to call it could enumerate.
-- Server code holds the service role; no browser may reach it.
revoke all on function public.open_private_link(text, boolean) from anon, authenticated;

/** Records the one outcome that means a sale is starting. */
create or replace function public.mark_private_link_whatsapp(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.private_links
     set whatsapp_clicked_at = coalesce(whatsapp_clicked_at, now())
   where token = p_token;
$$;

revoke all on function public.mark_private_link_whatsapp(text) from anon, authenticated;
