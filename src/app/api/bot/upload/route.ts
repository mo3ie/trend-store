import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";

// Attachment upload for bot replies — available to any signed-in customer (unlike
// /api/upload which is admin-only). Files land in the public `products` bucket under
// a per-user prefix and the public URL is sent to Meta as a message attachment.
const ALLOWED = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif",
  "application/pdf",
];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "لم يتم إرسال ملف" }, { status: 400 });
    if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "نوع الملف غير مسموح" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "حجم الملف يتجاوز 10 ميجابايت" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `bot/${user.id}/${Date.now()}-${file.name.replace(/\s/g, "_")}`;

    const { error } = await supabaseAdmin.storage
      .from("products").upload(fileName, buffer, { contentType: file.type, upsert: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data } = supabaseAdmin.storage.from("products").getPublicUrl(fileName);
    const type = file.type === "application/pdf" ? "file" : "image";
    return NextResponse.json({ url: data.publicUrl, type });
  } catch {
    return NextResponse.json({ error: "خطأ في الرفع" }, { status: 500 });
  }
}
