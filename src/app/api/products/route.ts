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
  // Characters that would break PostgREST's or() filter syntax are stripped.
  const search   = (searchParams.get("search") || "").replace(/[,()%*\\]/g, " ").trim().slice(0, 60);
  const limit    = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));

  // Customers only ever see what is in stock, and never the quantity. `?all=1` (admins only) shows everything.
  const all = searchParams.get("all") === "1" && (await requireAdmin()).ok;
  let query = supabaseAdmin.from("products").select("*").order("created_at", { ascending: false }).limit(limit);
  if (!all) query = query.gt("quantity", 0);

  if (category) query = query.eq("category", category);
  if (search) {
    // Every word must match (name, category or description): "ايفون 15 برو" finds "iPhone 15 Pro" style names too.
    for (const w of search.split(/\s+/).filter(Boolean).slice(0, 4)) query = query.or(`name.ilike.%${w}%,category.ilike.%${w}%,description.ilike.%${w}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // `quantity` is the canonical DB column; a legacy `stock` column lingers at 0.
  // Prefer quantity (?? falls back only when quantity is null, not when stock is 0).
  return NextResponse.json(data?.map((p: any) => all ? { ...p, stock: p.quantity ?? p.stock } : { ...p, quantity: undefined, stock: 999 }));
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { name, description, price, stock, category, image_url, images, variants, old_price } =
      await req.json();
    // "Before" price for offers: kept only when it is a positive number; empty clears it.
    const oldPrice = old_price === "" || old_price == null ? null : Number(old_price);
    if (oldPrice !== null && !(oldPrice > 0)) return NextResponse.json({ error: "السعر قبل التخفيض غير صحيح" }, { status: 400 });

    if (!name || price == null || stock == null) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("products").insert({
      name,
      description,
      price,
      old_price: oldPrice,
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
