import { NextRequest, NextResponse } from "next/server";
import { libyaDay, runDraw, ensureDraw } from "@/lib/dailyGift";

// Daily at 21:05 Libya: draw today's winner, and open tomorrow's draw (publishing its seed hash).
export async function GET(req: NextRequest) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret || (req.headers.get("authorization") || "") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const r = await runDraw(libyaDay());
  await ensureDraw(libyaDay(1));
  return NextResponse.json({ ok: true, ...r });
}
