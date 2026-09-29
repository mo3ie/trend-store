-- Sell the smart catalog matcher on the bot's VIP plan. Idempotent.
--
-- `catalog_reply` is what lets the bot work out WHICH product a comment means —
-- from the photo it sits under, a picture the commenter attached, or the product
-- name — and answer with that product's price alone. Without the flag the matcher
-- stays off, so this is the line that actually puts it on sale.
--
-- Written as a full assignment rather than an append so re-running it cannot
-- duplicate the entry.
update subscription_plans set features =
  '["reply_keyword", "private_dm", "like", "post_targeting", "ai_reply",
    "price_reply", "catalog_reply", "priority"]'::jsonb
  where product = 'bot' and tier = 'vip';

-- The Studio's top tier already unlocks every bot capability through
-- `all_bots_access`, so it needs no change.
