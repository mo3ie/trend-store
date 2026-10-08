import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import { getValidAccessToken } from "@/lib/tiktokTokens";
import { businessIdFromOpenId, listVideos, TikTokError } from "@/services/tiktok";

export const maxDuration = 30;

/**
 * GET ?accountId= — the account's recent videos, for the per-video reply editor.
 *
 * The Facebook side lists Page posts so an owner can give one post its own reply;
 * this is the same idea on the other platform, and it feeds the same
 * `bot_configs.post_overrides` map keyed by video id.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const accountId = req.nextUrl.searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ error: "accountId مطلوب" }, { status: 400 });

  // Ownership: the account must belong to the signed-in user.
  const { data: account } = await supabaseAdmin
    .from("tiktok_accounts")
    .select("id, tiktok_account_id")
    .eq("id", accountId).eq("user_id", user.id).is("revoked_at", null)
    .maybeSingle();
  if (!account) return NextResponse.json({ error: "الحساب غير موجود" }, { status: 404 });

  const token = await getValidAccessToken(account.id);
  if (!token) {
    return NextResponse.json({
      error: "no_valid_token",
      message: "انتهت صلاحية ربط الحساب — أعد ربط حساب تيك توك.",
    }, { status: 400 });
  }

  try {
    const page = await listVideos(token, businessIdFromOpenId(account.tiktok_account_id), { maxCount: 20 });
    const videos = (page.items || []).map((v) => ({
      id: v.videoId,
      caption: v.caption || "",
      createdTime: v.createTime ?? null,
      thumbnail: v.thumbnailUrl || null,
    }));
    // An empty list and a failure look identical to a caller that only gets `videos`,
    // and they need opposite responses from the owner: post a video, versus fix the
    // connection. So the empty case says which it is.
    return NextResponse.json({
      videos,
      hasMore: page.hasMore ?? false,
      empty: videos.length === 0,
      message: videos.length === 0
        ? "لا توجد فيديوهات على هذا الحساب بعد — انشر فيديو على تيك توك ثم حدّث الصفحة."
        : null,
    });
  } catch (e) {
    // The real reason, not a shrug. TikTok's own code and message are what distinguish
    // "scope missing" from "token expired" from "account has no business profile", and
    // without them every failure reads the same and none of them can be acted on.
    const detail = e instanceof TikTokError
      ? { code: e.ttCode ?? null, reason: e.message }
      : { code: null, reason: e instanceof Error ? e.message : "unknown" };
    if (e instanceof TikTokError) console.error(e.toLogLine(user.id));
    return NextResponse.json({
      error: "video_list_failed",
      message: `تعذّر جلب الفيديوهات من تيك توك${detail.code ? ` (رمز ${detail.code})` : ""}: ${detail.reason}`,
      ...detail,
    }, { status: 502 });
  }
}
