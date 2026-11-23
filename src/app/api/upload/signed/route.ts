import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/apiAuth";

/**
 * Direct-to-storage upload for big files (3D models): the serverless function
 * body limit (~4.5MB) is too small for a .glb, so the browser uploads straight
 * to Supabase Storage with a one-time signed URL. Admin only.
 */
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const EXT = /\.(glb|gltf|usdz|webp|png|jpe?g|mp4|mov|webm)$/i;

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { name } = await req.json().catch(() => ({ name: "" }));
  const clean = String(name || "").replace(/[^\w.\-]+/g, "_").slice(-80);
  if (!EXT.test(clean)) return NextResponse.json({ error: "نوع الملف غير مسموح" }, { status: 400 });
  const path = `public/3d/${Date.now()}-${clean}`;
  const { data, error } = await db.storage.from("products").createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: error?.message || "تعذّر إنشاء رابط الرفع" }, { status: 500 });
  const { data: pub } = db.storage.from("products").getPublicUrl(path);
  return NextResponse.json({ path, token: data.token, publicUrl: pub.publicUrl });
}
