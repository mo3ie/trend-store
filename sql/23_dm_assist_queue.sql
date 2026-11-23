-- ─────────────────────────────────────────────────────────────────────────────
-- «طابور الرسائل» — the assisted private reply.
--
-- Everything else we tried to replace TikTok's missing DM has failed on a fact
-- we could not change:
--
--   * Business Messaging is frozen by TikTok, and VBA-only when it reopens;
--   * a URL in a TikTok comment is plain text, so a link cannot be tapped;
--   * hiding a comment hides it from the customer too;
--   * replying then deleting does not leave the price in the notification.
--
-- But the Message button on a commenter's profile WORKS from the shop account,
-- verified by the operator. So the private channel exists -- it just has no API.
--
-- The split this table creates:
--
--   public reply   100% automatic, through the approved comment API
--   private reply  one human tap, from the real TikTok app
--
-- The staff member never hunts for the comment, never looks up which product the
-- video is about, and never writes the price: all of that is already here, and
-- what remains is pressing send. That is the ~90% of the work, removed, without
-- automating a single thing TikTok has not sanctioned -- which is exactly why
-- this is built as a QUEUE and not as a robot.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.dm_tasks (
  id              uuid primary key default gen_random_uuid(),
  config_id       uuid        not null references public.bot_configs(id) on delete cascade,
  user_id         uuid        not null,
  platform        text        not null default 'tiktok',
  page_id         text,
  -- One task per comment. The webhook and the reconciliation sweep can both reach
  -- the same comment, and two tasks would mean the customer is messaged twice.
  comment_id      text        not null,
  video_id        text,
  -- The handle, which is what the deep link to their profile is built from.
  commenter       text,
  comment_text    text,
  -- The message to send, resolved at the time the comment was answered: the
  -- video's own price if it has one, else the keyword's, else the default.
  body            text        not null,
  -- 'pending' | 'sent' | 'skipped'
  status          text        not null default 'pending',
  sent_at         timestamptz,
  sent_by         uuid,
  created_at      timestamptz not null default now()
);

create unique index if not exists dm_tasks_comment_idx
  on public.dm_tasks (platform, comment_id);

-- The queue screen's only query: this account's pending tasks, oldest first.
create index if not exists dm_tasks_queue_idx
  on public.dm_tasks (config_id, status, created_at);

-- Holds customer handles and quoted prices for every merchant on the platform.
-- RLS on with ZERO policies: service role only, like private_links.
alter table public.dm_tasks enable row level security;

-- 'assist' joins 'off' and 'link' as a delivery mode.
comment on column public.bot_configs.private_delivery is
  'off | link | assist — where the private reply goes. See src/lib/privateLinks.ts and sql/23.';
