import { NextRequest, NextResponse } from "next/server";
import { db, autoComplete } from "@/lib/market";

// Daily: orders whose protection window lapsed without a dispute pay the seller.
export async function GET(req: NextRequest) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret || (req.headers.get("authorization") || "") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data } = await db.from("market_orders").select("*").eq("status", "handed_over").lt("confirm_deadline", new Date().toISOString()).limit(200);
  let done = 0;
  for (const o of data || []) if (await autoComplete(o)) done++;
  return NextResponse.json({ ok: true, completed: done });
}
