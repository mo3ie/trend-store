import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import { hasProduct } from "@/lib/entitlements";
import { aiComplete, parseJsonReply, hasAI } from "@/services/ai";
import { loadShopFacts, factsBlock } from "@/services/shopFacts";

/**
 * POST /api/studio/plan/from-videos — a week's schedule built from videos the
 * merchant ALREADY HAS.
 *
 * ## Why this exists beside /plan/generate
 *
 * The planner invents videos to film: a hook, a shot list, on-screen text, a
 * sound. That is the right tool for someone starting from nothing, and the wrong
 * one for a shop whose phone is already full of clips. The operator said it
 * plainly — on TikTok the unit is a VIDEO, not a product — and asked for the
 * other direction: he brings the videos, the employee arranges them.
 *
 * So this route never writes a script. It writes the two things a finished video
 * still needs before it can go out, and that merchants put off until the clip is
 * stale: a caption worth reading, and a time worth posting at.
 *
 * ## What the model is and is not asked
 *
 * It is asked for a caption and hashtags per video, in the shop's own language,
 * from the shop's own facts. It is NOT asked for the day or the slot: the
 * schedule is computed here, which guarantees an even spread, and a model asked
 * to place twelve videos across seven days will cheerfully put four on Tuesday.
 * The same lesson the batched planner already learned.
 *
 * A video with no description still gets a caption — from the brand and the
 * catalogue — because refusing the line is worse than a generic first draft the
 * merchant can edit. Nothing here is published; everything lands as a scheduled
 * post that the existing publish path sends.
 */

export const maxDuration = 120;

interface VideoIn { url?: string; note?: string }
interface AiCaption { caption?: string; hashtags?: string }

/** Slot hours spread across the afternoon and evening, where TikTok traffic is. */
function slotTime(slot: number, perDay: number): number {
  if (perDay === 1) return 19;
  const start = 13, end = 21;
  return Math.round(start + ((end - start) * (slot - 1)) / Math.max(1, perDay - 1));
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const pageId = typeof body.pageId === "string" ? body.pageId : "";
  if (!pageId) return NextResponse.json({ error: "pageId مطلوب" }, { status: 400 });

  const videos: VideoIn[] = Array.isArray(body.videos)
    ? body.videos.filter((v: VideoIn) => typeof v?.url === "string" && v.url.startsWith("http")).slice(0, 40)
    : [];
  if (videos.length === 0) return NextResponse.json({ error: "ارفع فيديو واحداً على الأقل" }, { status: 400 });

  // This route only makes sense for a linked TikTok account: it is the platform
  // whose posts are videos, and the publish path keys off the same open id.
  const { data: ttAccount } = await supabaseAdmin
    .from("tiktok_accounts").select("id")
    .eq("user_id", user.id).eq("tiktok_account_id", pageId).is("revoked_at", null).maybeSingle();
  if (!ttAccount) return NextResponse.json({ error: "اربط حساب تيك توك أولاً" }, { status: 400 });

  const entitled = await hasProduct(user.id, "tiktok_studio", pageId).catch(() => false);
  if (!entitled) {
    return NextResponse.json({
      error: "subscription_required", code: "subscribe",
      message: "انتهت التجربة المجانية — اشترك في «الموظف الذكي» للمتابعة",
    }, { status: 402 });
  }

  const postsPerDay = Math.min(5, Math.max(1, Number(body.postsPerDay) || 1));
  const guidance = typeof body.guidance === "string" ? body.guidance.slice(0, 600).trim() : "";
  const languageOverride = typeof body.language === "string" ? body.language.slice(0, 200).trim() : "";

  const [{ data: brand }, { data: products }] = await Promise.all([
    supabaseAdmin.from("studio_brands").select("*").eq("user_id", user.id).eq("page_id", pageId).maybeSingle(),
    supabaseAdmin.from("studio_products").select("name, price_text, available")
      .eq("user_id", user.id).eq("active", true).limit(200),
  ]);

  const lang = languageOverride || (brand?.language as string | null)?.trim() || "";
  const languageLine = lang
    ? `LANGUAGE — this overrides every other style instruction: write all customer-facing text in "${lang}". Do not translate it, do not explain it, just write in it.`
    : "LANGUAGE: write all customer-facing text in warm, natural LIBYAN Arabic.";

  const catalogue = (products || [])
    .filter((p) => p.available !== false)
    .map((p) => `- ${p.name}${p.price_text ? ` — ${p.price_text}` : ""}`)
    .join("\n").slice(0, 1500);

  const facts = factsBlock(await loadShopFacts(user.id, pageId).catch(() => null));

  const system = [
    "You write TikTok captions for a small shop. The videos are ALREADY FILMED — never describe shots, scenes or how to make a video.",
    languageLine,
    "For each video write: a caption of at most 150 characters that makes someone stop and ask, and 3-6 hashtags.",
    "Never invent a price. If a price belongs in the caption, invite the comment instead — that is how this shop sells.",
    brand?.tone ? `Brand voice: ${brand.tone}` : "",
    facts ? `Shop facts you may use:\n${facts}` : "",
    catalogue ? `Products the shop sells:\n${catalogue}` : "",
    guidance ? `The owner asks: ${guidance}` : "",
    `Reply with JSON only: {"posts":[{"caption":"...","hashtags":"#a #b"}]} — exactly ${videos.length} items, in the SAME ORDER as the videos given.`,
  ].filter(Boolean).join(" ");

  const userMsg = videos
    .map((v, i) => `${i + 1}. ${(v.note || "").trim() || "(no description — write from the shop's products)"}`)
    .join("\n");

  let captions: AiCaption[] = [];
  if (hasAI()) {
    try {
      const text = await aiComplete({
        system, user: userMsg,
        maxTokens: Math.max(1200, videos.length * 220),
        temperature: 0.8, reasoningEffort: "medium",
      });
      captions = parseJsonReply<{ posts?: AiCaption[] }>(text).posts ?? [];
    } catch {
      captions = [];   // handled below — a plan without captions still beats no plan
    }
  }

  const durationDays = Math.max(1, Math.ceil(videos.length / postsPerDay));
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1);
  startDate.setHours(0, 0, 0, 0);

  const { data: plan, error: planErr } = await supabaseAdmin
    .from("studio_plans").insert({
      user_id: user.id, page_id: pageId, platform: "tiktok",
      posts_per_day: postsPerDay, duration_days: durationDays,
      start_date: startDate.toISOString().slice(0, 10), status: "draft",
      summary: `خطة من ${videos.length} فيديو جاهز`,
    }).select().single();
  if (planErr || !plan) {
    return NextResponse.json({ error: planErr?.message || "تعذّر إنشاء الخطة" }, { status: 500 });
  }

  const rows = videos.map((v, i) => {
    const day = Math.floor(i / postsPerDay) + 1;
    const slot = (i % postsPerDay) + 1;
    const when = new Date(startDate);
    when.setDate(when.getDate() + (day - 1));
    when.setHours(slotTime(slot, postsPerDay), 0, 0, 0);

    const ai = captions[i] || {};
    return {
      plan_id: plan.id, user_id: user.id, page_id: pageId, platform: "tiktok",
      scheduled_for: when.toISOString(),
      // Falling back to the merchant's own note, then to nothing, is deliberate:
      // an empty caption is editable and a wrong one is a published mistake.
      caption: (ai.caption || v.note || "").trim(),
      hashtags: ai.hashtags || null,
      video_url: v.url,
      post_type: "video",
      // Draft, never scheduled. These go out from the merchant's own account
      // under his own name; he reads them first and presses publish himself.
      status: "draft",
    };
  });

  const { error: postsErr } = await supabaseAdmin.from("studio_posts").insert(rows);
  if (postsErr) {
    await supabaseAdmin.from("studio_plans").delete().eq("id", plan.id);
    return NextResponse.json({ error: "تعذّر حفظ المنشورات" }, { status: 500 });
  }

  return NextResponse.json({
    plan,
    count: rows.length,
    // Said plainly, because a silent degradation here looks like a broken AI.
    captioned: captions.length > 0,
  });
}
