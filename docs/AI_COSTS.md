# Where the AI money goes

Every action in the product that calls a model, what it costs, who can reach it,
and whether it is capped. Audited from the code on 2026-09-20.

There are two completely different kinds of AI cost here, and mixing them up is
what makes the bill look unpredictable:

- **Paid media** (fal.ai) — images and video. Cents per click. **This is the bill.**
- **Text models** (Groq → Gemini → Claude, in that order) — captions, targeting,
  translation, bot replies. Groq is free or near-free and is tried first, so in
  practice this rounds to nothing unless Groq is down and the chain falls through
  to Claude.

---

## 1. Paid media — the only actions that cost real money

All four are metered against the **same monthly allowance** (images and video are
counted separately). Prices are fal.ai list prices for a 1-megapixel image.

| # | Button | Where | Who | Model | Cost | Counts against |
|---|--------|-------|-----|-------|------|----------------|
| 1 | **صور بجودة عالية** | Plan tab → select posts → toolbar | medium + VIP | FLUX.2 [dev] / [pro] | $0.012 / $0.03 | images |
| 2 | **إعادة توليد الصورة** (regenerate) | Post editor | medium + VIP | FLUX.2 [dev] / [pro] | $0.012 / $0.03 | images |
| 3 | **تعديل الصورة بالذكاء الاصطناعي** | Post editor | VIP only | FLUX.2 [pro] edit | $0.03 | images |
| 4 | **توليد فيديو من وصف** | Post editor | VIP only | Kling 2.5 Turbo Pro | $0.35 / 5s | videos |

**Monthly allowance per plan** (editable in the admin price panel):

| Plan | Images | Videos | Worst-case monthly cost to you |
|---|---|---|---|
| basic | 0 | 0 | **$0** — free generator only |
| medium | 100 | 0 | 100 × $0.012 = **$1.20** |
| VIP | 100 | 10 | 100 × $0.03 + 10 × $0.35 = **$6.50** |
| free trial (3 days) | 10 | 1 | ≈ **$0.65** |
| admin | unlimited | unlimited | uncapped — your own account |

Against a 500 LYD medium plan and a 1000 LYD VIP plan, media cost is roughly
**1–2% of revenue** at full usage. Most customers will not exhaust the allowance.

**Top-up packs** (`STUDIO_TOPUP_*` env, default): +100 images or +10 videos, 100 LYD
each. At ~8 LYD/USD that is ~$12.50 revenue against $1.20 (images) or $3.50
(videos) of cost. Packs expire with the current month — they do not accumulate.

**Refunds:** a claim is handed back whenever the provider call fails, so a customer
never loses allowance to an outage.

---

## 2. Free — no media cost, ever

These stay unlimited on purpose. A customer who has spent their allowance must
still be able to finish a content plan, which is why none of this is capped.

| Action | Where | Who | Notes |
|---|---|---|---|
| Image generation during **plan generation** | Plan tab | everyone | Always the free generator. Generating a plan spends **nothing**. |
| **بحث الصور** (6 sources) | Post editor | everyone | Stock APIs, free tiers |
| **رفع ملف الكتالوج** | Catalog tab | everyone | Parsing only |
| **رفع فيديو من جهازك** | Post editor | everyone | Storage only |
| Catalog product photos | Plan tab | everyone | Already yours |

---

## 3. Text models — Groq first, so effectively free

Each of these is one short LLM call. Groq is tried first and is free/near-free;
Gemini's free tier is next; Claude is the last resort. Cost only appears if the
first two fail.

| Action | Where | Who | Tokens |
|---|---|---|---|
| **توليد خطة المحتوى** | Studio → Plan | studio subscribers | Largest — one call for up to 40 posts |
| **الاستهداف الذكي للمنشور** | Post editor → boost | studio subscribers | Small |
| **ترجمة استعلام البحث** AR→EN | Image search | everyone | Tiny (~30 tokens), cached |
| **المساعد الذكي للاستهداف** | /ads | ads VIP tier | Small |
| **صياغة نص الإعلان** | /ads | ads users | Small |
| **ردود البوت بالذكاء** | Auto-reply bot | bot VIP (`ai_reply`) | Small, **per incoming comment** |

⚠️ The bot's AI replies are the one text cost that scales with *traffic* rather
than with clicks. A page receiving thousands of comments a day is the only realistic
way to run up a text-model bill here.

---

## 4. What is NOT capped

Worth knowing deliberately:

1. **Admin accounts are unlimited** on every paid action. Your own testing is not
   metered — watch it, because it is real money on the same fal.ai balance.
2. **Bot AI replies** have no per-customer cap; they are throttled per page for
   anti-spam reasons, not for cost.
3. **Ad spend itself** is separate money and is not in this document — it is
   charged to the Meta ad account, not to fal.ai.

---

## 5. Quick arithmetic

At **8 LYD per USD**:

- One high-quality image (VIP): $0.03 ≈ **0.24 LYD**
- One 5-second clip: $0.35 ≈ **2.80 LYD**
- A VIP customer using their whole monthly allowance: $6.50 ≈ **52 LYD** against a
  **1000 LYD** subscription.
- $20 of fal.ai credit buys roughly **1600** medium-tier images, **660** VIP images,
  or **57** clips.
