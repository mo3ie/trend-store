-- The AI Employee on TikTok. Idempotent.
--
-- The Studio's tables are keyed by (user_id, page_id) and a TikTok account id is
-- just another page_id, so the brand profile, the catalog, the plans and the posts
-- all work unchanged. What differs is WHERE a post goes: a Facebook Page takes a
-- photo or a video, a TikTok account takes a video. That is one column.
alter table studio_plans add column if not exists platform text default 'meta';
alter table studio_posts add column if not exists platform text default 'meta';

-- Existing rows predate TikTok, so they are all Meta — the default already says so,
-- but be explicit for anything inserted with a NULL.
update studio_plans set platform = 'meta' where platform is null;
update studio_posts set platform = 'meta' where platform is null;

create index if not exists studio_plans_platform_idx on studio_plans (user_id, platform, page_id);
