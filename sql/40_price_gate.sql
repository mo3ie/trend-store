-- ─────────────────────────────────────────────────────────────────────────────
-- 40 — the price gate: only price questions go behind the code.
--
-- ## The bug this closes
--
-- `decide()` (services/replyDecision.ts) puts EVERY generated answer into the
-- `privateText` slot — the catalog's and the AI's alike. `tiktokEngine` then
-- sends any private text through the one-off link. So on a merchant running
-- `private_delivery = 'link'`, this happened:
--
--     customer:  توصّلون لمصراتة؟
--     bot:       كودك 7K2MP — افتح الرابط في البايو واكتب الكود 🔑
--     customer:  (goes to the bio, types five characters)
--     page:      نعم، نوصّل لمصراتة 🚚
--
-- A code was spent, a trip to the bio was demanded, and a one-open 24-hour token
-- was burned — to say "yes". Nobody completes that twice.
--
-- Hiding the price is a deliberate trade: the customer pays a comment, and the
-- comment is what lifts the video. The trade only works while the thing behind
-- the code is worth the walk. Gating a delivery answer does not just waste that
-- customer — it teaches everyone watching that the codes lead nowhere, which
-- devalues the real ones. The gate needed an opinion, and now it has one:
-- services/priceIntent.ts.
--
-- ## This column
--
-- The word list in priceIntent.ts covers Libyan (قداش، بقداش، شحال), Gulf and
-- Egyptian (بكم، بكام), MSA (سعر، ثمن، قيمة) and English. It cannot cover a
-- particular shop's regulars — a village spelling, a product nickname, a phrase
-- that means "how much" only to this audience. This is where the merchant adds
-- those, and the bot's own replies screen shows the list, so the behaviour stays
-- something they can read and predict rather than guess at.
--
-- Merchant words are matched WHOLE, never as prefixes: someone adding a word
-- cannot be expected to have reasoned about what else it is the beginning of.
-- That reasoning is why `تمن` ships as an exact match and `سعر` as a prefix.
--
-- NULL/empty keeps exactly the built-in behaviour. Nothing changes for anyone
-- who ignores this column.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.bot_configs
  add column if not exists price_keywords text[] not null default '{}';

comment on column public.bot_configs.price_keywords is
  'Extra words that mean "how much?" for THIS shop. Matched whole, case/tashkeel-insensitive, in addition to the built-in Arabic+English list in services/priceIntent.ts. Empty = built-ins only.';

-- ─────────────────────────────────────────────────────────────────────────────
-- The code card: replying with a picture instead of 150 characters of grey text.
--
-- TikTok's comment API accepts an image (`/business/comment/image/upload/` →
-- `image_uri` on the reply), so the code can be posted as a card: the five
-- characters at 190px, the shop's domain, and a QR of the one-off link.
--
-- ⚠️ The SCOPE this upload requires is UNDOCUMENTED. TikTok's reference names no
-- permission for that endpoint and no third-party source does either. It may be
-- covered by `comment.list.manage`, which we hold. It may not. So this ships OFF,
-- behind two switches like the DM feature, and every path falls back to the
-- text-only reply that worked before. /api/tiktok/bot/test-comment-image answers
-- the question with one real call, without posting anything publicly.
--
-- The card never carries the price — it is as public as the comment it hangs
-- under. It carries the KEY, never what the key opens. See services/codeCard.ts.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.bot_configs
  add column if not exists reply_image boolean not null default false;

comment on column public.bot_configs.reply_image is
  'Post the code as a rendered card (big code + QR) instead of plain text. Needs TIKTOK_COMMENT_IMAGE=on as well. Falls back to text silently if the upload is refused.';
