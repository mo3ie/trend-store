import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import { pollinations as freeImage } from "@/services/studioImages";

/**
 * Every post ships with a working auto-reply already filled in, built from the
 * product it advertises. The owner opens the post and edits, disables or clears
 * it — rather than facing an empty form and leaving the bot silent by default.
 */
function defaultReply(prod: { name?: string; price_text?: string | null } | null, cta?: string) {
  const name = prod?.name?.trim();
  const price = prod?.price_text?.trim();
  const detail = name
    ? `${name}${price ? ` — السعر: ${price}` : ""}.`
    : "شكراً لاهتمامك!";
  return {
    enabled: true,
    public_replies: [
      "راسلناك على الخاص ✅",
      "تم إرسال التفاصيل لك في الخاص 🌸",
      "شكراً لتفاعلك — التفاصيل وصلتك خاص ✅",
    ],
    private_reply: `${detail} ${cta?.trim() || "للطلب أو الاستفسار راسلنا هنا مباشرة."}`.trim(),
    like: true,
  };
}
import { aiComplete, hasAI, parseJsonReply } from "@/services/ai";
import { hasProduct } from "@/lib/entitlements";

// A full plan can take ~15s to generate — raise the function limit above the ~10s default.
export const maxDuration = 60;

// Free image generation (no key) — FLUX model + prompt enhancement for much better
// quality than the default. Used when a post has no product photo.
// Re-exported for older callers; the tiered generator lives in services/studioImages.
export { pollinations } from "@/services/studioImages";



interface AIPost {
  day?: number; slot?: number; product?: string; type?: string;
  caption?: string; hashtags?: string; cta?: string; image_prompt?: string;
  // TikTok only — a video script rather than a photo post.
  hook?: string; scenes?: Array<{ t?: string; do?: string; text?: string }>;
  screen_text?: string; sound?: string; duration_sec?: number;
}

// POST — generate a content plan. Body: { pageId, postsPerDay, durationDays, startDate? }
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  if (!hasAI()) return NextResponse.json({ error: "الذكاء الاصطناعي غير متاح حالياً" }, { status: 503 });

  const body = await req.json();
  const pageId = String(body.pageId || "");
  if (!pageId) return NextResponse.json({ error: "pageId مطلوب" }, { status: 400 });

  // Studio gate: admins + 3-day trial pass; afterwards a Studio subscription is required.
  // Which platform this page belongs to decides the product — and the price.
  const { data: ttAccount } = await supabaseAdmin
    .from("tiktok_accounts").select("id")
    .eq("user_id", user.id).eq("tiktok_account_id", pageId).is("revoked_at", null).maybeSingle();
  const platform: "meta" | "tiktok" = ttAccount ? "tiktok" : "meta";
  const entitled = await hasProduct(user.id, platform === "tiktok" ? "tiktok_studio" : "studio", pageId).catch(() => false);
  if (!entitled) return NextResponse.json({ error: "subscription_required", code: "subscribe", message: "انتهت التجربة المجانية — اشترك في «الموظف الذكي» للمتابعة" }, { status: 402 });

  const postsPerDay = Math.max(1, Math.min(10, Number(body.postsPerDay) || 3));
  const durationDays = Math.max(1, Math.min(30, Number(body.durationDays) || 7));
  const total = Math.min(postsPerDay * durationDays, 40); // cap to keep AI output + cost sane
  const startDate = body.startDate ? new Date(body.startDate) : new Date();
  const types = Array.isArray(body.types) ? body.types.map(String).filter(Boolean).slice(0, 20) : [];
  const guidance = typeof body.guidance === "string" ? body.guidance.slice(0, 800).trim() : "";
  // Free text, deliberately not a list of dialects — see sql/38. A per-plan value
  // wins over the saved brand default, so the owner can write one campaign in
  // English without changing what their shop normally sounds like.
  const languageOverride = typeof body.language === "string" ? body.language.slice(0, 200).trim() : "";

  const [{ data: brand }, { data: products }, { data: memory }] = await Promise.all([
    supabaseAdmin.from("studio_brands").select("*").eq("user_id", user.id).eq("page_id", pageId).maybeSingle(),
    supabaseAdmin.from("studio_products").select("*").eq("user_id", user.id).eq("page_id", pageId).eq("active", true),
    supabaseAdmin.from("studio_memory").select("style, notes").eq("user_id", user.id).eq("page_id", pageId).maybeSingle(),
  ]);
  const items = (products || []).filter((p) => p.available !== false);
  if (items.length === 0) return NextResponse.json({ error: "أضف أصنافاً متوفّرة أولاً في الكتالوج" }, { status: 400 });

  const brandLines = [
    brand?.brand_name && `Store: ${brand.brand_name}`,
    brand?.tone && `Voice: ${brand.tone}`,
    brand?.phones?.length && `Phones: ${brand.phones.join(", ")}`,
    brand?.addresses?.length && `Addresses: ${brand.addresses.join(" | ")}`,
    brand?.links?.length && `Links: ${brand.links.join(" , ")}`,
    brand?.hours && `Hours: ${brand.hours}`,
    brand?.extra && `Extra: ${brand.extra}`,
  ].filter(Boolean).join("\n");
  const catalog = items.map((p) => `- ${p.name}${p.category ? ` [${p.category}]` : ""}${p.price_text ? ` — ${p.price_text}` : ""}`).join("\n");

  /*
   * The language the posts are written in.
   *
   * This used to be welded into the system prompt ("...in LIBYA", "LIBYAN-friendly
   * ARABIC"), which was right for one shop and wrong for every other subscriber.
   * Worse, it was invisible and unreachable: an owner could type "اكتب بالفصحى"
   * into the guidance box and lose the argument to an instruction they could not
   * see.
   *
   * Now it is the owner's own words, passed through verbatim, and it is stated
   * TWICE — once at the top of the prompt and once as the last line. A single
   * mention early in a long instruction list is the first thing a model drops.
   *
   * Empty means Libyan Arabic, so nothing changes for anyone who had a plan
   * before this field existed.
   */
  const lang = languageOverride || (brand?.language as string | null)?.trim() || "";
  const languageLine = lang
    ? `LANGUAGE — this overrides every other style instruction: write ALL customer-facing text (caption, hook, on-screen text, CTA, hashtags) in exactly this language/dialect/style as the owner described it: "${lang}". Do not translate it into anything else, and do not default to Libyan Arabic.`
    : "LANGUAGE: write all customer-facing text in warm, natural LIBYAN Arabic.";
  const languageReminder = lang
    ? `FINAL REMINDER — the language is non-negotiable: "${lang}".`
    : "";

  // The two platforms get different prompts because they are different deliverables:
  // a Facebook post is a caption plus an image, a TikTok is a SCRIPT whose first two
  // seconds decide whether anyone watches at all. Asking one prompt to serve both
  // produced Facebook captions with a TikTok label on them.
  const tiktokSystem = (n: number, avoid: string[]) => [
    "You are an expert TikTok content strategist for a small retail business.",
    languageLine,
    "Design a plan of SHORT VERTICAL VIDEOS (9:16). Every item is a video to FILM, never a photo post.",
    `Produce EXACTLY ${n} videos.`,
    avoid.length ? `These angles/products were already used earlier in the same plan — do NOT repeat them, find genuinely different ideas: ${avoid.join(" | ")}` : "",
    types.length
      ? `Use ONLY these angles (rotate among them): ${types.join(" | ")}. The "type" field must be one of these (in Arabic).`
      : "Vary the angle: product reveal, before/after, unboxing, a common customer question answered, a price reveal, a quick how-to, a trend/duet idea.",
    guidance ? `Follow the owner's guidance closely: ${guidance}` : "",
    memory?.style ? `This owner's established STYLE/voice (keep to it): ${memory.style}` : "",
    memory?.notes ? `The owner's accumulated preferences over time (respect them): ${memory.notes}` : "",
    "hook: the FIRST 0-2 SECONDS of on-screen text, at most 40 characters. This is the most important line — it must stop the scroll. Never a greeting, never the brand name.",
    "scenes: 3-5 ordered beats the owner can film from. Each: t (a time range like \"0-3s\"), do (what to SHOW — concrete and filmable with a phone), text (optional on-screen text).",
    "screen_text: the main text overlay across the video, short.",
    "sound: a suggested sound or trend DESCRIBED in words (for example: a fast trending sound, calm music) — never a made-up song id.",
    "duration_sec: 12-30.",
    "caption: the description under the video, short, with ONE clear call to action and the price when relevant.",
    "IMPORTANT: on TikTok there are no automated private messages, so if the video is about a product, the PRICE must appear in the caption or the on-screen text — not left for a DM.",
    "Only use products from the catalog. Pick the best product for each video.",
    "image_prompt: a short ENGLISH visual description for the COVER FRAME of the video (vertical, product-focused, well-lit). This one field is ALWAYS English — it feeds an image generator, it is never shown to a customer.",
    languageReminder,
    "Return ONLY JSON, no prose, exactly:",
    '{"summary": "<one short sentence>", "posts": [{"product": "<exact catalog name or empty>", "type": "<short label>", "hook": "<<=40 chars>", "scenes": [{"t":"0-3s","do":"...","text":"..."}], "screen_text": "...", "sound": "...", "duration_sec": <12..30>, "caption": "...", "hashtags": "<#.. #..>", "cta": "<short>", "image_prompt": "<English>"}]}',
  ].filter(Boolean).join(" ");

  const metaSystem = (n: number, avoid: string[]) => [
    "You are an expert social-media manager for a small retail business.",
    languageLine,
    "Design a Facebook content plan. Write engaging captions that sell without being pushy.",
    `Produce EXACTLY ${n} posts.`,
    avoid.length ? `These angles/products were already used earlier in the same plan — do NOT repeat them, find genuinely different ideas: ${avoid.join(" | ")}` : "",
    types.length
      ? `Use ONLY these post angles (rotate among them): ${types.join(" | ")}. The "type" field must be one of these (in Arabic).`
      : "Vary the angle: single-product highlight, offer/discount, bundle, tip/how-to, question/engagement, testimonial-style, new-arrival.",
    guidance ? `Follow the owner's guidance closely: ${guidance}` : "",
    memory?.style ? `This owner's established STYLE/voice (keep to it): ${memory.style}` : "",
    memory?.notes ? `The owner's accumulated preferences over time (respect them): ${memory.notes}` : "",
    "Each caption: a strong hook, value, ONE clear call to action, the store's phone or link when relevant, and 2-5 fitting emojis.",
    "Only use products from the catalog. Pick the best product(s) for each post.",
    "image_prompt: a short ENGLISH visual description to generate a photo for the post (product-focused, clean, well-lit). This one field is ALWAYS English — it feeds an image generator, it is never shown to a customer.",
    languageReminder,
    "Return ONLY JSON, no prose, exactly:",
    '{"summary": "<one short sentence>", "posts": [{"product": "<exact catalog name or empty>", "type": "<short label>", "caption": "...", "hashtags": "<#.. #..>", "cta": "<short>", "image_prompt": "<English>"}]}',
  ].filter(Boolean).join(" ");

  const buildSystem = platform === "tiktok" ? tiktokSystem : metaSystem;
  const userMsg = `STORE INFO:\n${brandLines || "(none)"}\n\nCATALOG (${items.length} items):\n${catalog}`;

  /*
   * Generated in BATCHES, not in one call.
   *
   * The plan used to be a single request for up to 40 posts inside a 12,000-token
   * budget — about 300 tokens per post, and a TikTok post has to carry a hook,
   * 3-5 scenes, on-screen text, a sound, a caption, hashtags, a CTA and an English
   * image prompt. There was no room to be good, and quality visibly decayed down
   * the list as the model rationed what was left.
   *
   * Smaller batches give each post roughly five times the room, and each call
   * carries the ideas already used so later batches diverge instead of
   * rediscovering the same three angles.
   *
   * The cost is real and worth stating: four calls repeat the catalog four times,
   * so a plan spends noticeably more of the free daily token budget than it did.
   * That is the trade — fewer plans per day, each one worth posting.
   *
   * Partial success is kept. A model that fails on batch 3 of 4 has still written
   * 30 usable posts, and throwing them away to show one error message would be a
   * worse outcome for the owner than a slightly short plan they can top up.
   */
  const BATCH = 10;
  const batches: number[] = [];
  for (let left = total; left > 0; left -= BATCH) batches.push(Math.min(BATCH, left));

  const aiPosts: AIPost[] = [];
  const used: string[] = [];
  let summary: string | null = null;
  let lastErr: unknown = null;

  for (const n of batches) {
    try {
      const text = await aiComplete({
        system: buildSystem(n, used.slice(-18)),
        user: userMsg,
        // ~600 tokens per post plus room to think, instead of ~300 with no room.
        maxTokens: Math.max(4000, n * 700),
        // Lowered from 0.85. With a model this size, high temperature buys
        // randomness, not depth — and the variety we actually wanted now comes
        // from the "already used" list, which is a far more reliable source of it.
        temperature: 0.7,
        // The whole point of this route is ideas, and `gpt-oss` is a reasoning
        // model that was being told not to reason. The token budget above is
        // deliberately generous so thinking cannot starve the answer.
        reasoningEffort: "medium",
      });
      const parsed = parseJsonReply<{ summary?: string; posts?: AIPost[] }>(text);
      const got = Array.isArray(parsed.posts) ? parsed.posts.slice(0, n) : [];
      if (summary === null && typeof parsed.summary === "string") summary = parsed.summary;
      for (const p of got) {
        aiPosts.push(p);
        const tag = [p.type, p.product].filter(Boolean).join(" · ");
        if (tag) used.push(tag);
      }
    } catch (e) {
      lastErr = e;
      console.error("studio plan batch failed:", e instanceof Error ? e.message : e);
    }
  }

  if (aiPosts.length === 0) {
    console.error("studio plan generate failed:", lastErr instanceof Error ? lastErr.message : lastErr);
    return NextResponse.json({ error: "تعذّر توليد الخطة، حاول مجدداً" }, { status: 502 });
  }

  // Match an AI product string to a catalog item (loose containment match).
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  function matchProduct(name?: string) {
    if (!name) return null;
    const n = norm(name);
    return items.find((p) => { const pn = norm(p.name); return pn === n || pn.includes(n) || n.includes(pn); }) || null;
  }
  // Slot times spread between 10:00 and 21:00.
  function slotTime(slot: number) {
    if (postsPerDay === 1) return 18;
    const start = 10, end = 21;
    return Math.round(start + ((end - start) * (slot - 1)) / Math.max(1, postsPerDay - 1));
  }

  // Create the plan.
  const { data: plan, error: planErr } = await supabaseAdmin
    .from("studio_plans").insert({
      user_id: user.id, page_id: pageId, posts_per_day: postsPerDay, duration_days: durationDays,
      start_date: startDate.toISOString().slice(0, 10), status: "draft", platform,
      summary,
    }).select().single();
  if (planErr || !plan) return NextResponse.json({ error: planErr?.message || "تعذّر إنشاء الخطة" }, { status: 500 });

  const rows = aiPosts.map((ap, i) => {
    // Position comes from the merged index, not from the model.
    // Each batch numbers its own posts from 1, so asking the model for a day and
    // slot would now produce four posts all claiming day 1 slot 1. The index is
    // also simply more reliable: it guarantees an even spread, which the model
    // only approximated even when it was answering for the whole plan at once.
    const day = Math.max(1, Math.min(durationDays, Math.floor(i / postsPerDay) + 1));
    const slot = (i % postsPerDay) + 1;
    const when = new Date(startDate);
    when.setDate(when.getDate() + (day - 1));
    when.setHours(slotTime(slot), 0, 0, 0);
    const prod = matchProduct(ap.product);
    const prompt = ap.image_prompt || (prod ? `${prod.name} product photo, clean studio lighting` : "attractive product photo");
    const productImg = prod?.images?.[0];
    return {
      plan_id: plan.id, user_id: user.id, page_id: pageId, platform,
      scheduled_for: when.toISOString(),
      caption: ap.caption || "",
      hashtags: ap.hashtags || null,
      cta: ap.cta || null,
      post_type: ap.type || null,
      product_id: prod?.id || null,
      image_prompt: prompt,
      image_url: productImg || "",          // filled below at the customer's tier
      image_source: productImg ? "product" : "ai",
      reply_config: defaultReply(prod, ap.cta),
      status: "draft",
      // The video script. Null on Facebook rows — a caption is not a hook, and
      // storing one as the other would make the storyboard lie.
      hook: platform === "tiktok" ? (ap.hook || null) : null,
      scenes: platform === "tiktok" && Array.isArray(ap.scenes)
        ? ap.scenes.slice(0, 6).map((sc) => ({
            t: String(sc?.t ?? ""), do: String(sc?.do ?? ""), text: String(sc?.text ?? ""),
          })).filter((sc) => sc.do || sc.text)
        : null,
      screen_text: platform === "tiktok" ? (ap.screen_text || null) : null,
      sound: platform === "tiktok" ? (ap.sound || null) : null,
      duration_sec: platform === "tiktok"
        ? Math.max(8, Math.min(60, Number(ap.duration_sec) || 18))
        : null,
    };
  });

  // Images: a real catalog photo wins outright; everything else starts on the FREE
  // generator. Nothing here spends the month's paid allowance — the owner decides
  // which posts deserve it afterwards, from the plan view.
  for (const r of rows) if (!r.image_url) r.image_url = freeImage(r.image_prompt);
  const { data: posts, error: postsErr } = await supabaseAdmin.from("studio_posts").insert(rows).select();
  if (postsErr) return NextResponse.json({ error: postsErr.message }, { status: 500 });

  // Grow the owner's brain: remember this run's guidance (deduped, capped).
  if (guidance) {
    const prev = memory?.notes || "";
    if (!prev.includes(guidance)) {
      const merged = (prev ? prev + "\n• " : "• ") + guidance;
      await supabaseAdmin.from("studio_memory").upsert(
        { user_id: user.id, page_id: pageId, notes: merged.slice(-3500), updated_at: new Date().toISOString() },
        { onConflict: "user_id,page_id" }
      );
    }
  }

  return NextResponse.json({ plan, posts: posts || [] });
}
