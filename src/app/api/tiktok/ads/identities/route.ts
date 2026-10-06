import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/authUser";
import { requireAdsContext } from "@/lib/tiktokAdsContext";
import { getIdentities } from "@/services/tiktokAdsCampaigns";
import { TikTokAdsError } from "@/services/tiktokAds";

export const maxDuration = 30;

/**
 * GET ?advertiserId= — the identities this ad account can advertise as.
 *
 * There is no TikTok equivalent of "boost this post URL": a Spark Ad runs under the
 * identity that owns the video, so an empty list is not an empty state to shrug at —
 * it means nothing can be promoted until the advertiser links their TikTok account
 * inside Ads Manager. Hence the explicit `needsLink` flag rather than `[]`.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const ctx = await requireAdsContext(user.id, req.nextUrl.searchParams.get("advertiserId"));
  if (!ctx.ok) return ctx.res;

  try {
    const identities = await getIdentities(ctx.ctx.token, ctx.ctx.advertiserId);
    return NextResponse.json({
      identities,
      needsLink: identities.length === 0,
      message: identities.length === 0
        ? "لا يوجد حساب تيك توك مرتبط بحساب الإعلانات. اربط حسابك من TikTok Ads Manager ← الأصول ← هويات، ثم أعد المحاولة."
        : null,
    });
  } catch (e) {
    if (e instanceof TikTokAdsError) console.error(e.toLogLine(user.id));
    return NextResponse.json({ error: "تعذّر جلب الهويات من تيك توك", identities: [] }, { status: 502 });
  }
}
