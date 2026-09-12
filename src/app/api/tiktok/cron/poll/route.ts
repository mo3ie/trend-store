import { NextRequest, NextResponse } from "next/server";
import { pollAllTikTok } from "@/services/tiktokEngine";

// Scheduled poll for new TikTok comments (TikTok has no comment webhook, so this is
// the only way new comments reach the bot). Protected by CRON_SECRET.
export async function GET(req: NextRequest) {
  const secret = (process.env.CRON_SECRET || "").trim();
  const auth = req.headers.get("authorization") || "";
  if (secret && auth !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const result = await pollAllTikTok();
  return NextResponse.json({ ok: true, ...result });
}
