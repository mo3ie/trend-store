import { NextRequest, NextResponse } from "next/server";
import { drainDeferred } from "@/services/botEngine";

// Scheduled drain of throttle-deferred comments (Vercel cron, every minute).
// Protected by CRON_SECRET: Vercel sends it as `Authorization: Bearer <secret>`.
export async function GET(req: NextRequest) {
  const secret = (process.env.CRON_SECRET || "").trim();
  const auth = req.headers.get("authorization") || "";
  if (secret && auth !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const result = await drainDeferred();
  return NextResponse.json({ ok: true, ...result });
}
