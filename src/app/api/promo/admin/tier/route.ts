import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/apiAuth";

// GET — list current VIP customers (admin)
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, tier")
    .eq("tier", "vip")
    .order("full_name", { ascending: true });
  return NextResponse.json({ vips: data || [] });
}

// POST — set a customer's tier by email. Body: { email, tier: "vip"|"regular" }
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { email, tier } = await req.json().catch(() => ({}));
  if (!email || !["vip", "regular"].includes(tier)) {
    return NextResponse.json({ error: "البريد ونوع الفئة مطلوبان" }, { status: 400 });
  }

  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("email", email.trim())
    .maybeSingle();

  if (!prof) return NextResponse.json({ error: "لا يوجد عميل بهذا البريد" }, { status: 404 });

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ tier })
    .eq("id", prof.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
