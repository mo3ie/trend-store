import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import { getValidAccessToken } from "@/lib/tiktokTokens";
import { uploadCommentImage, businessIdFromOpenId, TikTokError } from "@/services/tiktok";
import { renderCodeCard, commentImagesArmed } from "@/services/codeCard";
import { siteHost } from "@/lib/siteUrl";

/**
 * Answers the one question the documentation will not: does TikTok let THIS app
 * upload a comment image?
 *
 * The endpoint `/business/comment/image/upload/` is real and documented, but no
 * source — TikTok's reference, the SDKs, or any third party — names the scope it
 * requires. It may be covered by `comment.list.manage`, which we hold. The only
 * way to find out is to call it, and the only sensible place to find out is here,
 * deliberately, rather than discovering it inside the live reply path.
 *
 * ## What this does NOT do
 *
 * It posts nothing. It uploads an image and stops. No comment is created, no
 * customer sees anything, no `private_links` row is minted and no code is spent.
 * The uploaded image is referenced by nobody and simply expires. So this is safe
 * to run repeatedly while diagnosing, which is exactly what a probe needs to be.
 *
 * ## Reading the answer
 *
 *   ok: true              → the scope is sufficient. The card feature is real.
 *   ok: false, tiktokCode → TikTok refused, and that code is the finding. Record
 *                           it; it is the fact the docs are missing.
 *   ok: false, render     → our renderer failed, which is OUR bug, not TikTok's.
 *                           Fonts are the usual cause on a serverless image.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const accountId = req.nextUrl.searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ error: "accountId مطلوب" }, { status: 400 });

  // Ownership, not just authentication: an account id is guessable, and an upload
  // spends the owner's rate-limit budget.
  const { data: account } = await supabaseAdmin
    .from("tiktok_accounts")
    .select("id, tiktok_account_id, display_name, username")
    .eq("id", accountId).eq("user_id", user.id).maybeSingle();
  if (!account) return NextResponse.json({ error: "الحساب غير موجود" }, { status: 404 });

  // A throwaway code: five characters from the same alphabet, never stored, and
  // pointing at a token that was never minted, so the URL resolves to nothing.
  const code = "TEST1";
  const png = await renderCodeCard({
    code,
    url: `${siteHost("/r/")}${code}`,
    domainLabel: siteHost("/r"),
    brand: account.display_name || account.username || null,
  });
  if (!png) {
    return NextResponse.json({
      ok: false, stage: "render",
      message: "تعذّر توليد الصورة — المشكلة عندنا لا عند تيك توك",
    });
  }

  const token = await getValidAccessToken(account.id);
  if (!token) {
    return NextResponse.json({ ok: false, stage: "token", message: "لا يوجد توكن صالح — أعد ربط الحساب" });
  }

  try {
    const image = await uploadCommentImage(token, businessIdFromOpenId(account.tiktok_account_id), png);
    if (!image) {
      return NextResponse.json({
        ok: false, stage: "upload", bytes: png.byteLength,
        message: "تيك توك قبلت الطلب لكنها لم ترجع صورة",
      });
    }
    return NextResponse.json({
      ok: true, stage: "upload", bytes: png.byteLength,
      image: { width: image.width, height: image.height },
      message: "الصلاحية تكفي — الردّ بصورة ممكن",
      armed: { global: commentImagesArmed() },
    });
  } catch (err) {
    if (err instanceof TikTokError) {
      return NextResponse.json({
        ok: false, stage: "upload", bytes: png.byteLength,
        tiktokCode: err.ttCode ?? null, requestId: err.requestId ?? null,
        message: err.message,
      });
    }
    return NextResponse.json({ ok: false, stage: "upload", message: "فشل غير متوقع" });
  }
}
