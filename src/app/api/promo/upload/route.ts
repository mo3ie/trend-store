import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";

// Image upload for ad creatives (e.g. the Page-likes ad image) — available to any
// signed-in customer. Files land in the public `products` bucket under a per-user
// `ads/` prefix; the public URL is passed to Meta as the creative image.
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "لم يتم إرسال ملف" }, { status: 400 });
    if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "نوع الملف غير مسموح (صور فقط)" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "حجم الملف يتجاوز 8 ميجابايت" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `ads/${user.id}/${Date.now()}-${file.name.replace(/\s/g, "_")}`;

    const { error } = await supabaseAdmin.storage
      .from("products").upload(fileName, buffer, { contentType: file.type, upsert: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data } = supabaseAdmin.storage.from("products").getPublicUrl(fileName);
    return NextResponse.json({ url: data.publicUrl });
  } catch {
    return NextResponse.json({ error: "خطأ في الرفع" }, { status: 500 });
  }
}
