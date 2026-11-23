import { NextRequest, NextResponse } from "next/server";
import { runCatalogCheck } from "@/lib/catalogCheck";

export const maxDuration = 60;

// Daily catalog health check. Protected by CRON_SECRET (Vercel sends it as a Bearer token).
export async function GET(req: NextRequest) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret || (req.headers.get("authorization") || "") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const r = await runCatalogCheck("cron");
    return NextResponse.json({ ok: true, id: r.id, checked: r.checked, summary: r.summary });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
