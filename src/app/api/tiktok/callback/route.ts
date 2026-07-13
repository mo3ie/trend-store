import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { exchangeTikTokCode, getTikTokAccount } from "@/services/tiktok";

// GET — TikTok OAuth callback. Creates the bot config for the account and stores the
// access/refresh token, then returns to /tiktok-bot.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const base  = process.env.NEXT_PUBLIC_BASE_URL || "https://trendstore-ly.com";

  if (!code || !state) return NextResponse.redirect(`${base}/tiktok-bot?error=cancelled`);

  let userId: string;
  try {
    userId = Buffer.from(state, "base64").toString("utf-8");
  } catch {
    return NextResponse.redirect(`${base}/tiktok-bot?error=invalid_state`);
  }

  try {
    const auth = await exchangeTikTokCode(code, `${base}/api/tiktok/callback`);
    // On TikTok the business_id is the account's open_id.
    const businessId = auth.openId;
    const account = await getTikTokAccount(auth.accessToken, businessId).catch(() => null);

    const { data: config, error } = await supabaseAdmin.from("bot_configs").upsert({
      user_id:      userId,
      page_id:      businessId,
      page_name:    account?.displayName || account?.username || "TikTok",
      page_picture: account?.avatarUrl ?? null,
      platform:     "tiktok",
    }, { onConflict: "user_id,page_id,platform" }).select().single();
    if (error) throw new Error(error.message);

    // Store/refresh the account token (one per TikTok account — no rotation pool here,
    // since TikTok comment limits are per-account, not per-poster).
    const expiresAt = new Date(Date.now() + auth.expiresIn * 1000).toISOString();
    const { data: existing } = await supabaseAdmin
      .from("bot_page_tokens").select("id").eq("config_id", config.id).limit(1).maybeSingle();

    if (existing) {
      await supabaseAdmin.from("bot_page_tokens").update({
        access_token: auth.accessToken, refresh_token: auth.refreshToken,
        expires_at: expiresAt, status: "active", fail_count: 0,
      }).eq("id", existing.id);
    } else {
      await supabaseAdmin.from("bot_page_tokens").insert({
        config_id:     config.id,
        user_id:       userId,
        page_id:       businessId,
        label:         account?.username || "TikTok",
        access_token:  auth.accessToken,
        refresh_token: auth.refreshToken,
        expires_at:    expiresAt,
      });
    }

    return NextResponse.redirect(`${base}/tiktok-bot?success=1`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "error";
    const reason = encodeURIComponent(msg.slice(0, 180));
    return NextResponse.redirect(`${base}/tiktok-bot?error=oauth_failed&reason=${reason}`);
  }
}
