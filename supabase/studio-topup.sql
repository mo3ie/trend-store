-- Top-up packs, priced and sized per plan. Idempotent.
--
-- A pack mirrors the plan's own monthly allowance: a VIP pack carries images AND
-- video because VIP has video; a medium pack carries images only. basic gets no
-- pack at all, which is expressed simply as zero amounts — no special case in the
-- code, and the buy button never appears for them.
--
-- Amounts are per ONE pack. The customer chooses a quantity and everything
-- multiplies: 3 VIP packs = 300 LYD = 300 images + 30 videos.

alter table subscription_plans add column if not exists topup_price_lyd   numeric default 100;
alter table subscription_plans add column if not exists topup_image_amount int    default 0;
alter table subscription_plans add column if not exists topup_video_amount int    default 0;

-- basic: no top-up.
update subscription_plans set topup_price_lyd = 100, topup_image_amount = 0,   topup_video_amount = 0
  where product = 'studio' and tier = 'basic';
-- medium: 100 images for 100 LYD, no video (the plan has no video either).
update subscription_plans set topup_price_lyd = 100, topup_image_amount = 100, topup_video_amount = 0
  where product = 'studio' and tier = 'medium';
-- vip: 100 images + 10 videos for 100 LYD.
update subscription_plans set topup_price_lyd = 100, topup_image_amount = 100, topup_video_amount = 10
  where product = 'studio' and tier = 'vip';

-- Non-studio products do not sell Studio packs.
update subscription_plans set topup_image_amount = 0, topup_video_amount = 0
  where product <> 'studio';
