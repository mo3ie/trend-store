import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX = 8 * 1024 * 1024;

// Public: customers attach photos of the faulty device to a maintenance request.
// Server-side upload (service role) into the public `maintenance` bucket, with
// type + size validation so it can't be abused as an arbitrary file host.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File;
    if (!file) return NextResponse.json({ error: "لا يوجد ملف" }, { status: 400 });
    if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "صور فقط" }, { status: 400 });
    if (file.size > MAX) return NextResponse.json({ error: "الحجم يتجاوز 8 ميجابايت" }, { status: 400 });

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `public/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());

    const { error } = await db.storage.from("maintenance").upload(path, buf, { contentType: file.type });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data } = db.storage.from("maintenance").getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl });
  } catch {
    return NextResponse.json({ error: "فشل رفع الصورة" }, { status: 500 });
  }
}
