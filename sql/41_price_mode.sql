-- ─────────────────────────────────────────────────────────────────────────────
-- 41 — how price questions get recognised: three modes, the merchant picks.
--
-- sql/40 built the gate and gave it one brain: a word list, plus whatever the
-- merchant added. That is the right default — free, instant, offline, and
-- predictable, which matters because a merchant can read a word list and know
-- what the bot will do. A model he cannot read is a bot he cannot predict.
--
-- But a list is still a list, and it cannot hold:
--
--     "هل هو غالي؟"          asking about price, no price word in it
--     "ميزانيتي ٣٠٠٠، يكفي؟"  a budget, which is a price question
--     "في تقسيط؟"             instalments
--     "worth it?"
--
-- So the operator asked for the choice to be his: let the AI understand it, or
-- give me every ready word, or let me list my own. All three, and he picks.
--
--   'words'   built-ins + his additions. The default; nothing changes for anyone.
--   'ai'      ask the model on every comment. Catches the phrasings above, and
--             costs one call per comment out of a shared free daily budget —
--             which the screen says plainly rather than burying.
--   'manual'  ONLY his words. For a shop that wants the gate to fire on exactly
--             what it listed. If the list is EMPTY the built-ins still hold the
--             floor: an empty manual list would match nothing, gate nothing, and
--             quietly publish every price — the one failure worth preventing in
--             code rather than in a warning.
--
-- In 'ai' mode a model that fails, times out or is unconfigured falls back to the
-- word list, never to "no". A price said out loud cannot be taken back; an
-- over-gated delivery answer costs one customer a walk.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.bot_configs
  add column if not exists price_mode text not null default 'words';

alter table public.bot_configs
  drop constraint if exists bot_configs_price_mode_check;

alter table public.bot_configs
  add constraint bot_configs_price_mode_check
  check (price_mode in ('words', 'ai', 'manual'));

comment on column public.bot_configs.price_mode is
  'How price questions are recognised: words (built-in list + price_keywords, the default) | ai (a model classifies every comment; costs a call each) | manual (price_keywords only, falling back to the built-ins when empty).';
