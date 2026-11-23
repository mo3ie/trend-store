import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { entriesDigest } from "@/lib/dailyGift";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// GET ?day=YYYY-MM-DD → the exact ordered entry list used by a finished draw
// (entry id + anonymous tag), so anyone can recompute the winner.
export async function GET(req: NextRequest) {
  const day = req.nextUrl.searchParams.get("day") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return NextResponse.json({ error: "bad day" }, { status: 400 });
  const { data: draw } = await db.from("daily_draws").select("drawn_at").eq("day", day).maybeSingle();
  if (!draw?.drawn_at) return NextResponse.json({ error: "السحب لم يتم بعد" }, { status: 409 });
  const { data } = await db.from("daily_draw_entries").select("id,user_id").eq("day", day).order("id");
  const { list, hash } = entriesDigest(data || [], day);
  return new NextResponse(list, { headers: { "content-type": "text/plain; charset=utf-8", "x-entries-hash": hash } });
}
