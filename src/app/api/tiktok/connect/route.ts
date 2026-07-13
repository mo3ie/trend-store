import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/authUser";
import { buildTikTokOAuthUrl } from "@/services/tiktok";

// GET — returns the TikTok OAuth URL for connecting a Business account.
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://trendstore-ly.com";
  const redirectUri = `${base}/api/tiktok/callback`;
  const state = Buffer.from(user.id).toString("base64");

  return NextResponse.json({ url: buildTikTokOAuthUrl(redirectUri, state) });
}
