import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/apiAuth";
import { db } from "@/lib/market";
import { safeName } from "@/lib/safeName";
import { rateLimited } from "@/lib/catalog";

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

// Customer photo upload for marketplace listings (signed-in users only).
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  if (rateLimited(`mkup:${user.id}`, 30, 10 * 60_000)) return NextResponse.json({ error: "صور كثيرة — استنى شوية" }, { status: 429 });
  const f = (await req.formData()).get("file") as File | null;
  if (!f) return NextResponse.json({ error: "لا يوجد ملف" }, { status: 400 });
  if (!TYPES.includes(f.type)) return NextResponse.json({ error: "صور فقط" }, { status: 400 });
  if (f.size > 4 * 1024 * 1024) return NextResponse.json({ error: "الصورة أكبر من 4MB" }, { status: 400 });
  const path = `market/${user.id}/${Date.now()}-${safeName(f.name)}`;
  const { error } = await db.storage.from("products").upload(path, Buffer.from(await f.arrayBuffer()), { contentType: f.type });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ url: db.storage.from("products").getPublicUrl(path).data.publicUrl });
}
