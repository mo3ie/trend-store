-- Smart catalog matching for the comment bot. Idempotent.
--
-- A Page posts 30 photos for 30 products and gets hundreds of comments, each one
-- about ONE of them. The bot has to answer with that product's price and no other.
-- Four signals decide which product a comment means, cheapest and most certain
-- first; only the last one costs money:
--
--   1. the photo the comment sits under  -> post_ids   (certain, free)
--   2. the image attached to the comment -> image_hashes (near-certain, free)
--   3. the name/alias/SKU in the text    -> aliases, sku (deterministic, free)
--   4. AI, only when 1-3 all fail
--
-- Everything hangs off ONE product row, which is what makes "change the price list
-- and the right image follows" true by construction rather than by bookkeeping.

alter table studio_products add column if not exists aliases      text[] default '{}';
alter table studio_products add column if not exists sku          text;
-- Perceptual (dHash) fingerprints of this product's images, as hex. Compared to a
-- commenter's attachment by Hamming distance, which survives the resize and
-- re-compression Facebook applies when someone re-posts your own photo.
alter table studio_products add column if not exists image_hashes text[] default '{}';
-- The Page posts/photos that show this product.
alter table studio_products add column if not exists post_ids     text[] default '{}';
-- Numeric price for bulk updates and sorting; price_text stays the display string.
alter table studio_products add column if not exists price_number numeric;

create index if not exists studio_products_page_idx on studio_products (page_id, active);

-- off | post | name | image | all  — which signals this Page is allowed to use.
alter table bot_configs add column if not exists catalog_match text default 'off';
-- When two products match equally well, ask instead of guessing a price.
alter table bot_configs add column if not exists catalog_ambiguous_reply text;

-- Which product answered a comment, for the activity log and for tuning.
alter table bot_reply_log add column if not exists matched_product_id uuid;
alter table bot_reply_log add column if not exists match_signal text;
