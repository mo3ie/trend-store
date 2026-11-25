-- ─────────────────────────────────────────────────────────────────────────────
-- 38 — the language the AI employee writes in.
--
-- Until now the content planner hard-coded it in the prompt:
--
--     "...for a small business in LIBYA"
--     "Write engaging LIBYAN-friendly ARABIC captions"
--
-- Which is correct for exactly one customer. Every other subscriber — Egyptian,
-- Gulf, Levantine, anyone who wants Modern Standard Arabic, anyone selling to
-- English speakers — was fighting an explicit instruction in the system prompt
-- that they could not see and could not reach. They could type a request into the
-- free guidance box, and lose, because the prompt said otherwise.
--
-- ## Why free text and not a dropdown
--
-- The obvious design is a list: Libyan / MSA / Gulf / Egyptian / Levantine. The
-- operator rejected it, and he is right: "قد يريد حتى لغة انجليزية فلا نحدد له".
-- A list is a guess about who our subscribers are, and every guess excludes
-- someone — English, French, a mix of Arabic and English, a house style like
-- "فصحى مبسّطة بدون إيموجي". The field takes whatever they write and passes it
-- to the model, which understands all of it.
--
-- NULL keeps today's behaviour exactly: Libyan Arabic. Nobody's existing plans
-- change because this column appeared.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.studio_brands
  add column if not exists language text;

comment on column public.studio_brands.language is
  'Free text: the language/dialect/style the AI writes posts in. NULL = Libyan Arabic (the historic default).';
