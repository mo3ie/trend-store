import { NextRequest, NextResponse } from "next/server";
import { drainDeferred } from "@/services/botEngine";

// Scheduled drain of throttle-deferred comments (Vercel cron, every minute).
// Protected by CRON_SECRET: Vercel sends it as `Authorization: Bearer <secret>`.
export async function GET(req: NextRequest) {
  // FAIL CLOSED: a missing CRON_SECRET must never leave this endpoint open (audit #5).
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) {
    return new NextResponse("Cron secret not configured", { status: 503 });
  }
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const result = await drainDeferred();
  return NextResponse.json({ ok: true, ...result });
}
