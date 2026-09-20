-- Device video uploads + AI ad targeting per post. Idempotent.

-- A post can carry a video the owner uploaded from their phone or computer.
-- When set it is published as a Page video instead of a photo.
alter table studio_posts add column if not exists video_url text;

-- The AI's targeting choice for this post's ad, and the Arabic explanation shown
-- to the owner. Cities the owner picks themselves override the AI's cities.
alter table studio_posts add column if not exists boost_targeting jsonb;
alter table studio_posts add column if not exists boost_targeting_note text;
