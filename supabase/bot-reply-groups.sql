-- Per-post keyword reply groups, moderation and mentions. Idempotent.
--
-- The per-post override used to be one public reply + one private message. It now
-- carries keyword GROUPS: "price" comments get the price, "phone" comments get the
-- contact numbers, everything else falls through to AI or a default. The same
-- shape is settable once on the Page and inherited by every post, so an owner does
-- not re-type the price group on each one.
--
-- post_overrides is already jsonb, so the per-post half needs no migration. These
-- columns are the PAGE-LEVEL defaults that posts inherit.

alter table bot_configs add column if not exists reply_groups   jsonb default '[]'::jsonb;
alter table bot_configs add column if not exists banned_words   jsonb default '[]'::jsonb;
-- delete | hide | ignore. Hiding is the default: the comment stays visible to its
-- author, so they are not provoked into re-posting it, and nothing is destroyed.
alter table bot_configs add column if not exists banned_action  text default 'hide';
-- Open the reply with the commenter's name.
alter table bot_configs add column if not exists mention_author boolean default true;
-- One reply per person per post — someone who comments five times is not sent five
-- private messages.
alter table bot_configs add column if not exists once_per_user  boolean default true;

-- Moderation outcomes need to be readable in the activity log.
alter table bot_reply_log add column if not exists moderation text;
