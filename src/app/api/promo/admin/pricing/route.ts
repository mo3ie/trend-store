import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/apiAuth";
import { mergeAdsPricing } from "@/services/campaigns";

// GET — current ads pricing (admin)
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data } = await supabaseAdmin
    .from("store_settings").select("data").eq("id", 1).maybeSingle();
  const pricing = mergeAdsPricing((data?.data as { adsPricing?: unknown } | null)?.adsPricing as never);
  return NextResponse.json({ pricing });
}

// PUT — update ads pricing (admin). Merges into store_settings.data so other
// settings (appearance, contact, etc.) are never clobbered.
export async function PUT(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }
  const pricing = mergeAdsPricing(body);

  const { data: current } = await supabaseAdmin
    .from("store_settings").select("data").eq("id", 1).maybeSingle();
  const merged = { ...((current?.data as Record<string, unknown>) || {}), adsPricing: pricing };

  const { error } = await supabaseAdmin
    .from("store_settings")
    .upsert({ id: 1, data: merged, updated_at: new Date().toISOString() });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, pricing });
}
