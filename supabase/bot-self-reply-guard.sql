-- Stop the bot answering its own replies.
--
-- TikTok fires `comment.update` for EVERY comment on an owned video — including the
-- replies the bot itself posts. Nothing distinguished them, so each reply arrived back
-- as a fresh comment, got answered, and that answer arrived back in turn: an
-- unbounded loop that spams the video and is exactly the behaviour that gets an
-- account restricted.
--
-- `replyToComment` already returns the id of the comment it created; it was simply
-- being discarded. Storing it gives an exact, cheap test on the way in — "did we write
-- this?" — which beats guessing from the author name or the text.

alter table bot_reply_log
  add column if not exists reply_comment_id text;

-- The lookup is on the hot path of every webhook delivery, so it gets its own index.
create index if not exists bot_reply_log_reply_comment_id_idx
  on bot_reply_log (reply_comment_id)
  where reply_comment_id is not null;
