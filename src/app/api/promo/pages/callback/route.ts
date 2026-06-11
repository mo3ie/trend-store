import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { exchangeCodeForToken, getUserPages } from "@/services/meta";

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

    return NextResponse.redirect(`${base}/ads/connect?success=1`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "error";
    console.error("Meta OAuth callback error:", msg);
    // Surface the real Graph error in the URL so failures are diagnosable
    const reason = encodeURIComponent(msg.slice(0, 180));
    return NextResponse.redirect(`${base}/ads/connect?error=oauth_failed&reason=${reason}`);
  }
}
