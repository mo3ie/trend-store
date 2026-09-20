-- Studio image/video tiers + catalog import. Idempotent.
--
-- Which generator a customer gets is a PRICING decision, so it lives here as plan
-- feature flags rather than as a branch in the code:
--
--   ai_images       FLUX.2 [dev]  — realistic, ~$0.012/image   (medium + vip)
--   ai_images_max   FLUX.2 [pro]  — top quality, ~$0.03/image  (vip)
--   ai_image_edit   FLUX.2 [pro] edit — redraw a real catalog photo, ~$0.03 (vip)
--   ai_video        Kling 2.5 Turbo Pro — ~$0.35 per 5s clip    (vip)
--   catalog_import  bulk product upload from a file            (every plan)
--
-- Plans with no flag fall back to the free Pollinations generator.

-- Which tier actually produced a post's image, for support and cost reporting.
alter table studio_posts add column if not exists image_tier text;

-- Rebuild the studio feature sets. Written as a full assignment per tier so the
-- migration is idempotent and the grid stays readable.
update subscription_plans set features =
  '["content_plan", "catalog_import"]'::jsonb
  where product = 'studio' and tier = 'basic';

update subscription_plans set features =
  '["content_plan", "auto_publish", "web_images", "boosting", "ai_images", "catalog_import"]'::jsonb
  where product = 'studio' and tier = 'medium';

update subscription_plans set features =
  '["content_plan", "auto_publish", "web_images", "boosting", "brain_memory", "ai_images",
    "ai_images_max", "ai_image_edit", "ai_video", "selective_boost", "all_bots_access",
    "catalog_import"]'::jsonb
  where product = 'studio' and tier = 'vip';
