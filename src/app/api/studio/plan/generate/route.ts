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
  const entitled = await hasProduct(user.id, "studio", pageId).catch(() => false);
  if (!entitled) return NextResponse.json({ error: "subscription_required", code: "subscribe", message: "انتهت التجربة المجانية — اشترك في «الموظف الذكي» للمتابعة" }, { status: 402 });

  const postsPerDay = Math.max(1, Math.min(10, Number(body.postsPerDay) || 3));
  const durationDays = Math.max(1, Math.min(30, Number(body.durationDays) || 7));
  const total = Math.min(postsPerDay * durationDays, 40); // cap to keep AI output + cost sane
  const startDate = body.startDate ? new Date(body.startDate) : new Date();
  const types = Array.isArray(body.types) ? body.types.map(String).filter(Boolean).slice(0, 20) : [];
  const guidance = typeof body.guidance === "string" ? body.guidance.slice(0, 800).trim() : "";

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

  const system = [
    "You are an expert Arabic social-media manager for a small business in LIBYA.",
    "Design a Facebook content plan. Write engaging LIBYAN-friendly ARABIC captions that sell without being pushy.",
    `Produce EXACTLY ${total} posts total, spread as ${postsPerDay} per day over ${durationDays} days.`,
    types.length
      ? `Use ONLY these post angles (rotate among them): ${types.join(" | ")}. The "type" field must be one of these (in Arabic).`
      : "Vary the angle: single-product highlight, offer/discount, bundle, tip/how-to, question/engagement, testimonial-style, new-arrival.",
    guidance ? `Follow the owner's guidance closely: ${guidance}` : "",
    memory?.style ? `This owner's established STYLE/voice (keep to it): ${memory.style}` : "",
    memory?.notes ? `The owner's accumulated preferences over time (respect them): ${memory.notes}` : "",
    "Each caption: a strong hook, value, ONE clear call to action, the store's phone or link when relevant, and 2-5 fitting emojis.",
    "Only use products from the catalog. Pick the best product(s) for each post.",
    "image_prompt: a short ENGLISH visual description to generate a photo for the post (product-focused, clean, well-lit).",
    "Return ONLY JSON, no prose, exactly:",
    '{"summary": "<one short Arabic sentence>", "posts": [{"day": <1..N>, "slot": <1..postsPerDay>, "product": "<exact catalog name or empty>", "type": "<short Arabic label>", "caption": "<Arabic>", "hashtags": "<#.. #..>", "cta": "<short Arabic>", "image_prompt": "<English>"}]}',
  ].join(" ");
  const userMsg = `STORE INFO:\n${brandLines || "(none)"}\n\nCATALOG (${items.length} items):\n${catalog}`;

  let parsed: { summary?: string; posts?: AIPost[] };
  try {
    const text = await aiComplete({ system, user: userMsg, maxTokens: 12000, temperature: 0.85 });
    parsed = parseJsonReply(text);
  } catch (e) {
    console.error("studio plan generate failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "تعذّر توليد الخطة، حاول مجدداً" }, { status: 502 });
  }
  const aiPosts = Array.isArray(parsed.posts) ? parsed.posts.slice(0, total) : [];
  if (aiPosts.length === 0) return NextResponse.json({ error: "لم يُنتج المساعد منشورات، حاول مجدداً" }, { status: 502 });

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
      start_date: startDate.toISOString().slice(0, 10), status: "draft",
      summary: typeof parsed.summary === "string" ? parsed.summary : null,
    }).select().single();
  if (planErr || !plan) return NextResponse.json({ error: planErr?.message || "تعذّر إنشاء الخطة" }, { status: 500 });

  const rows = aiPosts.map((ap, i) => {
    const day = Math.max(1, Math.min(durationDays, Number(ap.day) || Math.floor(i / postsPerDay) + 1));
    const slot = Math.max(1, Math.min(postsPerDay, Number(ap.slot) || (i % postsPerDay) + 1));
    const when = new Date(startDate);
    when.setDate(when.getDate() + (day - 1));
    when.setHours(slotTime(slot), 0, 0, 0);
    const prod = matchProduct(ap.product);
    const prompt = ap.image_prompt || (prod ? `${prod.name} product photo, clean studio lighting` : "attractive product photo");
    const productImg = prod?.images?.[0];
    return {
      plan_id: plan.id, user_id: user.id, page_id: pageId,
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
