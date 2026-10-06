import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/authUser";
import { requireAdsContext } from "@/lib/tiktokAdsContext";
import { getSparkVideos } from "@/services/tiktokAdsCampaigns";
import { TikTokAdsError } from "@/services/tiktokAds";

export const maxDuration = 30;

/**
 * GET ?advertiserId=&identityId= — the organic videos eligible to be promoted.
 *
 * This is the ads-side list, which is NOT the same as the organic bot's video list:
 * the Marketing API will not accept an item id that came from the account-holder API,
 * so the two must never be mixed, however similar they look.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const identityId = req.nextUrl.searchParams.get("identityId");
  if (!identityId) return NextResponse.json({ error: "identityId مطلوب" }, { status: 400 });
  const identityType = req.nextUrl.searchParams.get("identityType") || "TT_USER";

  const ctx = await requireAdsContext(user.id, req.nextUrl.searchParams.get("advertiserId"));
  if (!ctx.ok) return ctx.res;

  try {
    const videos = await getSparkVideos(ctx.ctx.token, ctx.ctx.advertiserId, identityId, identityType);
    return NextResponse.json({ videos });
  } catch (e) {
    if (e instanceof TikTokAdsError) console.error(e.toLogLine(user.id));
    return NextResponse.json({ error: "تعذّر جلب الفيديوهات القابلة للترويج", videos: [] }, { status: 502 });
  }
}
