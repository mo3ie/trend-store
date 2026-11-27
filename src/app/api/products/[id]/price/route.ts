import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
type Params = Promise<{ id: string }>;

/**
 * PATCH /api/products/[id]/price  { price, old_price }  — admin only.
 * The quick price editor in /admin/products (offer day): changes ONLY the two prices,
 * nothing else on the product. old_price empty/null → offer removed for that product.
 */
export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const price = Number(body?.price);
  if (!(price >= 0) || !Number.isFinite(price)) return NextResponse.json({ error: "السعر غير صحيح" }, { status: 400 });
  const raw = body?.old_price;
  const oldPrice = raw === "" || raw == null ? null : Number(raw);
  if (oldPrice !== null && !(oldPrice > 0)) return NextResponse.json({ error: "السعر قبل التخفيض غير صحيح" }, { status: 400 });

  const { data, error } = await supabaseAdmin.from("products").update({ price, old_price: oldPrice }).eq("id", id).select("id, price, old_price").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "المنتج غير موجود" }, { status: 404 });
  return NextResponse.json({ success: true, product: data });
}
