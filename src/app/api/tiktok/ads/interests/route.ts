import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/authUser";
import { requireAdsContext } from "@/lib/tiktokAdsContext";
import { searchInterestCategories } from "@/services/tiktokAdsCampaigns";
import { TikTokAdsError } from "@/services/tiktokAds";

export const maxDuration = 30;

/** GET ?q=&advertiserId= — detailed-targeting interest categories. */
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") || "").trim();

  const ctx = await requireAdsContext(user.id, req.nextUrl.searchParams.get("advertiserId"));
  if (!ctx.ok) return ctx.res;

  try {
    const interests = await searchInterestCategories(ctx.ctx.token, ctx.ctx.advertiserId, q);
    return NextResponse.json({ interests });
  } catch (e) {
    if (e instanceof TikTokAdsError) console.error(e.toLogLine(user.id));
    return NextResponse.json({ error: "تعذّر جلب الاهتمامات", interests: [] }, { status: 502 });
  }
}
