-- The AI Employee on TikTok produces a VIDEO SCRIPT, not a photo post.
--
-- The plan generator was written for Facebook, where a post is a caption plus an
-- image, and `studio_posts` has the columns for exactly that. A TikTok deliverable is
-- a different object: the first two seconds decide whether anyone watches, so the
-- HOOK is the most important line in the whole thing, and what follows is a sequence
-- of beats with on-screen text and a sound — none of which a caption field can hold.
--
-- Storing it as a script rather than squeezing it into `caption` matters because the
-- owner has to be able to FILM from it. A caption that reads like a script is still
-- just a caption: it cannot be shown as a storyboard, copied beat by beat, or checked
-- for whether the hook is actually a hook.

alter table studio_posts
  -- The first 0-2 seconds of on-screen text. The single highest-value line.
  add column if not exists hook text,
  -- Ordered beats: [{ "t": "0-3s", "do": "...", "text": "..." }, ...]
  add column if not exists scenes jsonb,
  -- The on-screen text overlay, separate from the caption below the video.
  add column if not exists screen_text text,
  -- A suggested sound/trend, in words — we cannot pick a real TikTok sound by API.
  add column if not exists sound text,
  add column if not exists duration_sec int;

comment on column studio_posts.hook is
  'TikTok only: the 0-2s on-screen hook. Facebook rows leave this null.';
comment on column studio_posts.scenes is
  'TikTok only: ordered shot list, [{t, do, text}].';
