import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/authUser";
import { requireAdsContext } from "@/lib/tiktokAdsContext";
import { searchLocations } from "@/services/tiktokAdsCampaigns";
import { TikTokAdsError } from "@/services/tiktokAds";

export const maxDuration = 30;

/**
 * GET ?q=&advertiserId=&objective= — targeting locations.
 *
 * Unlike Meta's geo search, TikTok offers no query endpoint: it returns the whole
 * location tree for the objective, so an empty `q` is a legitimate request (it lists
 * countries) and the filtering happens server-side in the service.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const objective = req.nextUrl.searchParams.get("objective") || "REACH";

  const ctx = await requireAdsContext(user.id, req.nextUrl.searchParams.get("advertiserId"));
  if (!ctx.ok) return ctx.res;

  try {
    const locations = await searchLocations(ctx.ctx.token, ctx.ctx.advertiserId, q, objective);
    return NextResponse.json({ locations });
  } catch (e) {
    if (e instanceof TikTokAdsError) console.error(e.toLogLine(user.id));
    return NextResponse.json({ error: "تعذّر جلب المواقع", locations: [] }, { status: 502 });
  }
}
