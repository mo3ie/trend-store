-- Auto-publish / scheduling to Facebook + boost execution linkage.
-- Idempotent — safe to re-run.
alter table studio_plans add column if not exists auto_publish boolean default false;
alter table studio_posts add column if not exists external_post_id  text;
alter table studio_posts add column if not exists published_at      timestamptz;
alter table studio_posts add column if not exists boost_campaign_id  uuid;
-- statuses used: draft | approved | scheduled | published | failed
create index if not exists studio_posts_due_idx
  on studio_posts (scheduled_for) where status in ('approved','scheduled');
