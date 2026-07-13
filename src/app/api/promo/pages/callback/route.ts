import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { exchangeCodeForToken, getUserPages, type MetaPage } from "@/services/meta";

// For each connected page that already has a bot config, append this login's Page
// token to the bot's rotation pool (skipping tokens already stored). This is how a
// customer "links several Facebook accounts" to one bot for anti-block failover.
async function appendPoolTokens(userId: string, pages: MetaPage[]): Promise<void> {
  const { data: configs } = await supabaseAdmin
    .from("bot_configs").select("id, page_id, page_name")
    .eq("user_id", userId).eq("platform", "meta");
  if (!configs?.length) return;
  const byPage = new Map(configs.map((c) => [c.page_id, c]));

  for (const p of pages) {
    const cfg = byPage.get(p.id);
    if (!cfg) continue;
    const { data: existing } = await supabaseAdmin
      .from("bot_page_tokens").select("id")
      .eq("config_id", cfg.id).eq("access_token", p.access_token).maybeSingle();
    if (existing) continue;
    await supabaseAdmin.from("bot_page_tokens").insert({
      config_id:    cfg.id,
      user_id:      userId,
      page_id:      p.id,
      label:        p.name || "حساب إضافي",
      access_token: p.access_token,
    });
  }
}

// GET — Meta OAuth callback
// Saves connected pages to DB then redirects to /ads/connect
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://trendstore-ly.com";

  if (error || !code || !state) {
    return NextResponse.redirect(`${base}/ads/connect?error=cancelled`);
  }

  let userId: string;
  try {
    userId = Buffer.from(state, "base64").toString("utf-8");
  } catch {
    return NextResponse.redirect(`${base}/ads/connect?error=invalid_state`);
  }

  try {
    const redirectUri = `${base}/api/promo/pages/callback`;
    const userToken   = await exchangeCodeForToken(code, redirectUri);
    const pages       = await getUserPages(userToken);

    if (!pages.length) {
      return NextResponse.redirect(`${base}/ads/connect?error=no_pages`);
    }

    // Upsert each page
    const rows = pages.map((p) => ({
      user_id:          userId,
      platform:         "meta",
      page_id:          p.id,
      page_name:        p.name,
      page_picture:     p.picture?.data?.url ?? null,
      page_access_token: p.access_token,
      connection_type:  "oauth",
    }));

    await supabaseAdmin
      .from("connected_pages")
      .upsert(rows, { onConflict: "user_id,page_id" });

    // Bot token pool: if any freshly-connected page already has a bot config, append
    // this account's Page token to the rotation pool (a different admin FB account =
    // an extra token that lets the bot fail over when one gets rate-limited).
    await appendPoolTokens(userId, pages);

    return NextResponse.redirect(`${base}/ads/connect?success=1`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "error";
    console.error("Meta OAuth callback error:", msg);
    // Surface the real Graph error in the URL so failures are diagnosable
    const reason = encodeURIComponent(msg.slice(0, 180));
    return NextResponse.redirect(`${base}/ads/connect?error=oauth_failed&reason=${reason}`);
  }
}
