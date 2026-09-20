import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import { featuresFor } from "@/lib/entitlements";
import { claim, getQuota, refund } from "@/lib/studioQuota";
import { generateImage, tierFor } from "@/services/studioImages";

export const maxDuration = 60;

/**
 * POST { postIds: string[] } — regenerate these posts' images on the paid tier.
 *
 * Plans are generated entirely on the free generator, because most posts end up
 * using a catalog photo or a web image anyway. This is the deliberate, metered
 * step: the owner picks the posts worth spending the month's allowance on.
 *
 * Only as many posts are upgraded as the allowance covers, and anything that
 * fails hands its unit back rather than burning it.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const postIds: string[] = Array.isArray(b.postIds) ? b.postIds.map(String).filter(Boolean).slice(0, 40) : [];
  if (postIds.length === 0) return NextResponse.json({ error: "اختر منشوراً واحداً على الأقل" }, { status: 400 });

  const { data: posts } = await supabaseAdmin
    .from("studio_posts").select("id, image_prompt, page_id")
    .eq("user_id", user.id).in("id", postIds);
  if (!posts || posts.length === 0) return NextResponse.json({ error: "لا منشورات" }, { status: 404 });

  const features = await featuresFor(user.id, "studio", posts[0].page_id).catch(() => new Set<string>());
  const tier = tierFor(features);
  if (tier === "free") {
    return NextResponse.json({
      error: "upgrade_required", code: "ai_images",
      message: "الجودة العالية متاحة من الباقة المتوسطة فما فوق.",
    }, { status: 402 });
  }

  const { granted, state } = await claim(user.id, "images", posts.length);
  if (granted <= 0) {
    return NextResponse.json({
      error: "quota_exceeded", quota: state,
      message: "انتهت حصة الصور عالية الجودة لهذا الشهر — اشترِ باقة إضافية أو استخدم التوليد المجاني.",
    }, { status: 402 });
  }

  const target = posts.slice(0, granted);
  let upgraded = 0, failed = 0;

  // Small concurrency: fast enough for 40 posts, gentle on the provider.
  const queue = [...target];
  await Promise.all(Array.from({ length: Math.min(5, queue.length) }, async () => {
    for (;;) {
      const p = queue.shift();
      if (!p) return;
      const { url, tier: used } = await generateImage(p.image_prompt || "product photo", tier);
      if (used === "free") { failed++; continue; }   // the paid call fell through
      await supabaseAdmin.from("studio_posts")
        .update({ image_url: url, image_source: "ai", image_tier: used })
        .eq("id", p.id);
      upgraded++;
    }
  }));

  if (failed > 0) await refund(user.id, "images", failed);

  const { data: updated } = await supabaseAdmin
    .from("studio_posts").select("*").in("id", postIds);

  return NextResponse.json({
    upgraded, failed,
    skipped: posts.length - target.length,     // beyond this month's allowance
    quota: await getQuota(user.id),
    posts: updated || [],
  });
}
