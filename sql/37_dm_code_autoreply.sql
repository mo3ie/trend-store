-- ─────────────────────────────────────────────────────────────────────────────
-- 37 — «من التعليق إلى الرسالة»: the customer redeems their code in a DM.
--
-- The shape the whole industry uses (ManyChat, Chatfuel, ChattyFlow all ship it):
--
--     comment  →  public reply carrying a CODE  →  customer DMs the code  →  price
--
-- Why it is worth building before the permission exists: it is the only delivery
-- that satisfies BOTH halves of the operator's idea at once. The ad-based routes
-- (click-to-WhatsApp, lead forms) deliver the price but let the customer skip the
-- comment — and the comment IS the mechanic, because it is what lifts the video.
-- Here the comment stays mandatory and the price still never appears in public.
--
-- It is also the only one where the CUSTOMER opens the conversation, which is what
-- clears TikTok's ban on business-initiated messaging. We are not allowed to message
-- a commenter; we are allowed to answer someone who wrote to us.
--
-- ## Everything here is inert until two switches agree
--
-- TikTok froze the Business Messaging approval process on 2026-11-07 (ticket
-- #4543199) and we must reapply when it reopens. So this ships OFF:
--
--   1. env  DM_CODE_AUTOREPLY=on   — the global kill switch, per deployment
--   2. bot_configs.dm_code_autoreply — per merchant, so one account can pilot it
--
-- Both must be true before a single message is sent. With either off the handler
-- still records the event, which is deliberate: the log proves the path works
-- end to end before the first real reply ever goes out.
--
-- ## No new secret store
--
-- The code → price mapping is `private_links`, already live and already exercised
-- in production since sql/22. A DM redemption is just another open of the same
-- row, counted by the same `open_private_link` guard. That reuse is the reason
-- this migration is small: the hard half was built weeks ago.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.bot_configs
  -- Per-merchant arm switch. Off by default: a merchant must choose this, because
  -- it changes what their customers are told to do in a public comment.
  add column if not exists dm_code_autoreply boolean not null default false,
  -- Optional wording for the "code not recognised / already used" answers. The
  -- successful answer is never templated — it is the merchant's own private text.
  add column if not exists dm_code_miss_text text;

-- ─────────────────────────────────────────────────────────────────────────────
-- Inbound message events.
--
-- This table is the idempotency guard, the audit trail and the dry-run log, in
-- that order of importance. A messaging webhook WILL redeliver — every one does —
-- and a redelivery that answered twice would spend the customer's single open on
-- a message they already received.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.dm_code_events (
  id              uuid primary key default gen_random_uuid(),
  platform        text        not null default 'tiktok',
  -- The platform's own message id. NOT NULL and unique per platform: without a
  -- stable id from the provider we cannot deduplicate, and a handler that cannot
  -- deduplicate must refuse the event rather than risk a double spend.
  message_id      text        not null,
  conversation_id text,
  -- Who wrote. Opaque platform id; never a phone number or an email.
  sender_id       text,
  -- The account that received it (TikTok open_id / Facebook page id).
  page_id         text,
  config_id       uuid        references public.bot_configs(id) on delete set null,
  user_id         uuid,
  -- The code we extracted, when we found one. The raw message text is deliberately
  -- NOT stored: it is a customer's own words to a merchant, and nothing downstream
  -- needs it once the code is out.
  code            text,
  -- matched | expired | exhausted | missing | no_code
  outcome         text        not null,
  -- sent | disabled | unavailable | failed | skipped
  delivery        text        not null,
  -- The provider's error code when delivery failed, for diagnosing a refusal that
  -- otherwise reads identically to "feature is off".
  error_code      text,
  created_at      timestamptz not null default now()
);

-- The guard. One row per delivered message, whatever happens to it afterwards.
create unique index if not exists dm_code_events_message_idx
  on public.dm_code_events (platform, message_id);

create index if not exists dm_code_events_config_idx
  on public.dm_code_events (config_id, created_at desc);

-- Same posture as private_links: RLS on, zero policies, service role only. The
-- table maps customers to the merchants they asked prices from.
alter table public.dm_code_events enable row level security;
