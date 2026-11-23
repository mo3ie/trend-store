import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/apiAuth";
import { runCatalogCheck } from "@/lib/catalogCheck";

export const maxDuration = 60;
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/** GET: latest report (or ?id=) + history list. POST: run a check now. */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const id = req.nextUrl.searchParams.get("id");
  const q = db.from("catalog_reports").select("id,created_at,trigger,checked,issues,fixes,summary");
  const { data: report } = id ? await q.eq("id", id).maybeSingle() : await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data: history } = await db.from("catalog_reports").select("id,created_at,trigger,checked,summary").order("created_at", { ascending: false }).limit(30);
  return NextResponse.json({ report: report || null, history: history || [] });
}

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const r = await runCatalogCheck("manual");
    return NextResponse.json({ ok: true, id: r.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
