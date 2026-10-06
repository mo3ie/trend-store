-- TikTok subscription catalog. Idempotent.
--
-- Same ideas as the Facebook plans, own product ids, own prices. Seeded with
-- active = FALSE so nothing can be bought at a placeholder price: the owner sets
-- the real numbers in /admin/subscriptions and flips them on there.
--
-- Separate products rather than reusing bot/ads/studio, because a customer who
-- paid for the Facebook bot has not paid for the TikTok one — different price,
-- different thing.
insert into subscription_plans
  (id,product,tier,page_scope,page_limit,duration,months,price_lyd,features,active,sort,
   ai_image_quota,ai_video_quota,topup_price_lyd,topup_image_amount,topup_video_amount)
values
('tiktok_bot-regular-single-monthly','tiktok_bot','regular','single',1,'monthly',1,50,'["reply_keyword", "private_dm", "like", "post_targeting"]'::jsonb,false,1,0,0,100,0,0),
('tiktok_bot-regular-single-quarterly','tiktok_bot','regular','single',1,'quarterly',3,125,'["reply_keyword", "private_dm", "like", "post_targeting"]'::jsonb,false,2,0,0,100,0,0),
('tiktok_bot-regular-single-yearly','tiktok_bot','regular','single',1,'yearly',12,500,'["reply_keyword", "private_dm", "like", "post_targeting"]'::jsonb,false,3,0,0,100,0,0),
('tiktok_bot-regular-triple-monthly','tiktok_bot','regular','triple',3,'monthly',1,100,'["reply_keyword", "private_dm", "like", "post_targeting"]'::jsonb,false,4,0,0,100,0,0),
('tiktok_bot-regular-triple-quarterly','tiktok_bot','regular','triple',3,'quarterly',3,250,'["reply_keyword", "private_dm", "like", "post_targeting"]'::jsonb,false,5,0,0,100,0,0),
('tiktok_bot-regular-triple-yearly','tiktok_bot','regular','triple',3,'yearly',12,1000,'["reply_keyword", "private_dm", "like", "post_targeting"]'::jsonb,false,6,0,0,100,0,0),
('tiktok_bot-regular-unlimited-monthly','tiktok_bot','regular','unlimited',999,'monthly',1,250,'["reply_keyword", "private_dm", "like", "post_targeting"]'::jsonb,false,7,0,0,100,0,0),
('tiktok_bot-regular-unlimited-quarterly','tiktok_bot','regular','unlimited',999,'quarterly',3,700,'["reply_keyword", "private_dm", "like", "post_targeting"]'::jsonb,false,8,0,0,100,0,0),
('tiktok_bot-regular-unlimited-yearly','tiktok_bot','regular','unlimited',999,'yearly',12,2500,'["reply_keyword", "private_dm", "like", "post_targeting"]'::jsonb,false,9,0,0,100,0,0),
('tiktok_bot-vip-single-monthly','tiktok_bot','vip','single',1,'monthly',1,100,'["reply_keyword", "private_dm", "like", "post_targeting", "ai_reply", "price_reply", "catalog_reply", "priority"]'::jsonb,false,10,0,0,100,0,0),
('tiktok_bot-vip-single-quarterly','tiktok_bot','vip','single',1,'quarterly',3,250,'["reply_keyword", "private_dm", "like", "post_targeting", "ai_reply", "price_reply", "catalog_reply", "priority"]'::jsonb,false,11,0,0,100,0,0),
('tiktok_bot-vip-single-yearly','tiktok_bot','vip','single',1,'yearly',12,1000,'["reply_keyword", "private_dm", "like", "post_targeting", "ai_reply", "price_reply", "catalog_reply", "priority"]'::jsonb,false,12,0,0,100,0,0),
('tiktok_bot-vip-triple-monthly','tiktok_bot','vip','triple',3,'monthly',1,200,'["reply_keyword", "private_dm", "like", "post_targeting", "ai_reply", "price_reply", "catalog_reply", "priority"]'::jsonb,false,13,0,0,100,0,0),
('tiktok_bot-vip-triple-quarterly','tiktok_bot','vip','triple',3,'quarterly',3,500,'["reply_keyword", "private_dm", "like", "post_targeting", "ai_reply", "price_reply", "catalog_reply", "priority"]'::jsonb,false,14,0,0,100,0,0),
('tiktok_bot-vip-triple-yearly','tiktok_bot','vip','triple',3,'yearly',12,1800,'["reply_keyword", "private_dm", "like", "post_targeting", "ai_reply", "price_reply", "catalog_reply", "priority"]'::jsonb,false,15,0,0,100,0,0),
('tiktok_bot-vip-unlimited-monthly','tiktok_bot','vip','unlimited',999,'monthly',1,500,'["reply_keyword", "private_dm", "like", "post_targeting", "ai_reply", "price_reply", "catalog_reply", "priority"]'::jsonb,false,16,0,0,100,0,0),
('tiktok_bot-vip-unlimited-quarterly','tiktok_bot','vip','unlimited',999,'quarterly',3,1250,'["reply_keyword", "private_dm", "like", "post_targeting", "ai_reply", "price_reply", "catalog_reply", "priority"]'::jsonb,false,17,0,0,100,0,0),
('tiktok_bot-vip-unlimited-yearly','tiktok_bot','vip','unlimited',999,'yearly',12,5000,'["reply_keyword", "private_dm", "like", "post_targeting", "ai_reply", "price_reply", "catalog_reply", "priority"]'::jsonb,false,18,0,0,100,0,0),
('tiktok_ads-vip-single-monthly','tiktok_ads','vip','single',1,'monthly',1,100,'["free_usd_budget", "ai_targeting", "support_247", "full_bot_features", "priority"]'::jsonb,false,19,0,0,100,0,0),
('tiktok_ads-vip-single-quarterly','tiktok_ads','vip','single',1,'quarterly',3,250,'["free_usd_budget", "ai_targeting", "support_247", "full_bot_features", "priority"]'::jsonb,false,20,0,0,100,0,0),
('tiktok_ads-vip-single-yearly','tiktok_ads','vip','single',1,'yearly',12,1000,'["free_usd_budget", "ai_targeting", "support_247", "full_bot_features", "priority"]'::jsonb,false,21,0,0,100,0,0),
('tiktok_ads-vip-triple-monthly','tiktok_ads','vip','triple',3,'monthly',1,200,'["free_usd_budget", "ai_targeting", "support_247", "full_bot_features", "priority"]'::jsonb,false,22,0,0,100,0,0),
('tiktok_ads-vip-triple-quarterly','tiktok_ads','vip','triple',3,'quarterly',3,500,'["free_usd_budget", "ai_targeting", "support_247", "full_bot_features", "priority"]'::jsonb,false,23,0,0,100,0,0),
('tiktok_ads-vip-triple-yearly','tiktok_ads','vip','triple',3,'yearly',12,1800,'["free_usd_budget", "ai_targeting", "support_247", "full_bot_features", "priority"]'::jsonb,false,24,0,0,100,0,0),
('tiktok_ads-vip-unlimited-monthly','tiktok_ads','vip','unlimited',999,'monthly',1,500,'["free_usd_budget", "ai_targeting", "support_247", "full_bot_features", "priority"]'::jsonb,false,25,0,0,100,0,0),
('tiktok_ads-vip-unlimited-quarterly','tiktok_ads','vip','unlimited',999,'quarterly',3,1250,'["free_usd_budget", "ai_targeting", "support_247", "full_bot_features", "priority"]'::jsonb,false,26,0,0,100,0,0),
('tiktok_ads-vip-unlimited-yearly','tiktok_ads','vip','unlimited',999,'yearly',12,5000,'["free_usd_budget", "ai_targeting", "support_247", "full_bot_features", "priority"]'::jsonb,false,27,0,0,100,0,0),
('tiktok_studio-basic-single-monthly','tiktok_studio','basic','single',1,'monthly',1,250,'["content_plan", "catalog_import"]'::jsonb,false,28,0,0,100,0,0),
('tiktok_studio-basic-single-quarterly','tiktok_studio','basic','single',1,'quarterly',3,625,'["content_plan", "catalog_import"]'::jsonb,false,29,0,0,100,0,0),
('tiktok_studio-basic-single-yearly','tiktok_studio','basic','single',1,'yearly',12,2500,'["content_plan", "catalog_import"]'::jsonb,false,30,0,0,100,0,0),
('tiktok_studio-basic-triple-monthly','tiktok_studio','basic','triple',3,'monthly',1,500,'["content_plan", "catalog_import"]'::jsonb,false,31,0,0,100,0,0),
('tiktok_studio-basic-triple-quarterly','tiktok_studio','basic','triple',3,'quarterly',3,1250,'["content_plan", "catalog_import"]'::jsonb,false,32,0,0,100,0,0),
('tiktok_studio-basic-triple-yearly','tiktok_studio','basic','triple',3,'yearly',12,5000,'["content_plan", "catalog_import"]'::jsonb,false,33,0,0,100,0,0),
('tiktok_studio-basic-unlimited-monthly','tiktok_studio','basic','unlimited',999,'monthly',1,1250,'["content_plan", "catalog_import"]'::jsonb,false,34,0,0,100,0,0),
('tiktok_studio-basic-unlimited-quarterly','tiktok_studio','basic','unlimited',999,'quarterly',3,3125,'["content_plan", "catalog_import"]'::jsonb,false,35,0,0,100,0,0),
('tiktok_studio-basic-unlimited-yearly','tiktok_studio','basic','unlimited',999,'yearly',12,12500,'["content_plan", "catalog_import"]'::jsonb,false,36,0,0,100,0,0),
('tiktok_studio-medium-single-monthly','tiktok_studio','medium','single',1,'monthly',1,500,'["content_plan", "auto_publish", "web_images", "boosting", "ai_images", "catalog_import"]'::jsonb,false,37,100,0,100,100,0),
('tiktok_studio-medium-single-quarterly','tiktok_studio','medium','single',1,'quarterly',3,1250,'["content_plan", "auto_publish", "web_images", "boosting", "ai_images", "catalog_import"]'::jsonb,false,38,100,0,100,100,0),
('tiktok_studio-medium-single-yearly','tiktok_studio','medium','single',1,'yearly',12,5000,'["content_plan", "auto_publish", "web_images", "boosting", "ai_images", "catalog_import"]'::jsonb,false,39,100,0,100,100,0),
('tiktok_studio-medium-triple-monthly','tiktok_studio','medium','triple',3,'monthly',1,1000,'["content_plan", "auto_publish", "web_images", "boosting", "ai_images", "catalog_import"]'::jsonb,false,40,100,0,100,100,0),
('tiktok_studio-medium-triple-quarterly','tiktok_studio','medium','triple',3,'quarterly',3,2500,'["content_plan", "auto_publish", "web_images", "boosting", "ai_images", "catalog_import"]'::jsonb,false,41,100,0,100,100,0),
('tiktok_studio-medium-triple-yearly','tiktok_studio','medium','triple',3,'yearly',12,10000,'["content_plan", "auto_publish", "web_images", "boosting", "ai_images", "catalog_import"]'::jsonb,false,42,100,0,100,100,0),
('tiktok_studio-medium-unlimited-monthly','tiktok_studio','medium','unlimited',999,'monthly',1,2500,'["content_plan", "auto_publish", "web_images", "boosting", "ai_images", "catalog_import"]'::jsonb,false,43,100,0,100,100,0),
('tiktok_studio-medium-unlimited-quarterly','tiktok_studio','medium','unlimited',999,'quarterly',3,6250,'["content_plan", "auto_publish", "web_images", "boosting", "ai_images", "catalog_import"]'::jsonb,false,44,100,0,100,100,0),
('tiktok_studio-medium-unlimited-yearly','tiktok_studio','medium','unlimited',999,'yearly',12,25000,'["content_plan", "auto_publish", "web_images", "boosting", "ai_images", "catalog_import"]'::jsonb,false,45,100,0,100,100,0),
('tiktok_studio-vip-single-monthly','tiktok_studio','vip','single',1,'monthly',1,1000,'["content_plan", "auto_publish", "web_images", "boosting", "brain_memory", "ai_images", "ai_images_max", "ai_image_edit", "ai_video", "selective_boost", "all_bots_access", "catalog_import"]'::jsonb,false,46,100,10,100,100,10),
('tiktok_studio-vip-single-quarterly','tiktok_studio','vip','single',1,'quarterly',3,2500,'["content_plan", "auto_publish", "web_images", "boosting", "brain_memory", "ai_images", "ai_images_max", "ai_image_edit", "ai_video", "selective_boost", "all_bots_access", "catalog_import"]'::jsonb,false,47,100,10,100,100,10),
('tiktok_studio-vip-single-yearly','tiktok_studio','vip','single',1,'yearly',12,10000,'["content_plan", "auto_publish", "web_images", "boosting", "brain_memory", "ai_images", "ai_images_max", "ai_image_edit", "ai_video", "selective_boost", "all_bots_access", "catalog_import"]'::jsonb,false,48,100,10,100,100,10),
('tiktok_studio-vip-triple-monthly','tiktok_studio','vip','triple',3,'monthly',1,2000,'["content_plan", "auto_publish", "web_images", "boosting", "brain_memory", "ai_images", "ai_images_max", "ai_image_edit", "ai_video", "selective_boost", "all_bots_access", "catalog_import"]'::jsonb,false,49,100,10,100,100,10),
('tiktok_studio-vip-triple-quarterly','tiktok_studio','vip','triple',3,'quarterly',3,5000,'["content_plan", "auto_publish", "web_images", "boosting", "brain_memory", "ai_images", "ai_images_max", "ai_image_edit", "ai_video", "selective_boost", "all_bots_access", "catalog_import"]'::jsonb,false,50,100,10,100,100,10),
('tiktok_studio-vip-triple-yearly','tiktok_studio','vip','triple',3,'yearly',12,20000,'["content_plan", "auto_publish", "web_images", "boosting", "brain_memory", "ai_images", "ai_images_max", "ai_image_edit", "ai_video", "selective_boost", "all_bots_access", "catalog_import"]'::jsonb,false,51,100,10,100,100,10),
('tiktok_studio-vip-unlimited-monthly','tiktok_studio','vip','unlimited',999,'monthly',1,5000,'["content_plan", "auto_publish", "web_images", "boosting", "brain_memory", "ai_images", "ai_images_max", "ai_image_edit", "ai_video", "selective_boost", "all_bots_access", "catalog_import"]'::jsonb,false,52,100,10,100,100,10),
('tiktok_studio-vip-unlimited-quarterly','tiktok_studio','vip','unlimited',999,'quarterly',3,12500,'["content_plan", "auto_publish", "web_images", "boosting", "brain_memory", "ai_images", "ai_images_max", "ai_image_edit", "ai_video", "selective_boost", "all_bots_access", "catalog_import"]'::jsonb,false,53,100,10,100,100,10),
('tiktok_studio-vip-unlimited-yearly','tiktok_studio','vip','unlimited',999,'yearly',12,50000,'["content_plan", "auto_publish", "web_images", "boosting", "brain_memory", "ai_images", "ai_images_max", "ai_image_edit", "ai_video", "selective_boost", "all_bots_access", "catalog_import"]'::jsonb,false,54,100,10,100,100,10)
on conflict (id) do nothing;
