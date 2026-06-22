import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const search   = searchParams.get("search");
  const limit    = parseInt(searchParams.get("limit") || "50");

  let query = supabaseAdmin.from("products").select("*").order("created_at", { ascending: false }).limit(limit);

  if (category) query = query.eq("category", category);
  if (search)   query = query.or(`name.ilike.%${search}%,category.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // `quantity` is the canonical DB column; a legacy `stock` column lingers at 0.
  // Prefer quantity (?? falls back only when quantity is null, not when stock is 0).
  return NextResponse.json(data?.map((p: any) => ({ ...p, stock: p.quantity ?? p.stock })));
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { name, description, price, stock, category, image_url, images, variants } =
      await req.json();

    if (!name || price == null || stock == null) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("products").insert({
      name,
      description,
      price,
      quantity: stock,
      category,
      image_url: image_url || null,
      images: images || [],
      variants: variants || [],
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "خطأ في حفظ المنتج" }, { status: 500 });
  }
}
