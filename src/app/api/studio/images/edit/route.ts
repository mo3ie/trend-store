import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/authUser";
import { featuresFor } from "@/lib/entitlements";
import { UNIT_COST_USD, editImage, falErrorMessage, hasFal } from "@/services/studioImages";
import { claim, getQuota, refund } from "@/lib/studioQuota";

export const maxDuration = 60;

/**
 * POST { imageUrl, prompt } — redraw a real photo from an instruction.
 *
 * This is the "keep my actual product, change everything around it" path: new
 * background, studio lighting, brand colours, a seasonal setting. It is the top
 * plan's feature (`ai_image_edit`) because every call costs money, and unlike
 * generation it deliberately has no free fallback — quietly substituting an
 * invented product for the customer's real one would be worse than an error.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const imageUrl = String(b.imageUrl || "").trim();
  const prompt = String(b.prompt || "").trim();
  const pageId = b.pageId ? String(b.pageId) : undefined;
  if (!imageUrl || !prompt) {
    return NextResponse.json({ error: "imageUrl و prompt مطلوبان" }, { status: 400 });
  }

  const features = await featuresFor(user.id, "studio", pageId).catch(() => new Set<string>());
  if (!features.has("ai_image_edit")) {
    return NextResponse.json({
      error: "upgrade_required", code: "ai_image_edit",
      message: "تعديل الصور بالذكاء الاصطناعي متاح في باقة «الموظف الذكي VIP».",
    }, { status: 402 });
  }
  if (!hasFal()) {
    return NextResponse.json({ error: "not_configured", message: "مولّد الصور المدفوع غير مُفعّل" }, { status: 503 });
  }

  // An edit costs the same as a high-quality image, so it draws on that allowance.
  const { granted, state } = await claim(user.id, "images", 1);
  if (granted <= 0) {
    return NextResponse.json({
      error: "quota_exceeded", quota: state,
      message: "انتهت حصة الصور عالية الجودة لهذا الشهر — اشترِ باقة إضافية.",
    }, { status: 402 });
  }

  try {
    const url = await editImage(imageUrl, prompt);
    return NextResponse.json({ url, cost_usd: UNIT_COST_USD.edit, quota: await getQuota(user.id) });
  } catch (e) {
    await refund(user.id, "images", 1);
    return NextResponse.json({ error: "edit_failed", message: falErrorMessage(e) }, { status: 502 });
  }
}
