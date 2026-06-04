import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { name, description, price, stock, category, image_url, images } =
      await req.json();

    if (!name || price == null || stock == null) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("products").insert({
      name,
      description,
      price,
      stock,
      category,
      image_url: image_url || null,
      images: images || [],
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "خطأ في حفظ المنتج" }, { status: 500 });
  }
}
