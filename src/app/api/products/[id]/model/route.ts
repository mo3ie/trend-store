import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/apiAuth";

/**
 * AI image → 3D model (Meshy image-to-3d). Needs MESHY_API_KEY.
 * POST starts a job from the product photo; GET polls it and, when done,
 * copies the .glb into our own storage and sets products.model_url.
 */
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const API = "https://api.meshy.ai/openapi/v1/image-to-3d";
type Params = Promise<{ id: string }>;

const key = () => (process.env.MESHY_API_KEY || "").trim();

export async function POST(req: NextRequest, { params }: { params: Params }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!key()) return NextResponse.json({ error: "التوليد بالذكاء الاصطناعي يحتاج مفتاح MESHY_API_KEY" }, { status: 503 });
  const { id } = await params;
  const { imageUrl } = await req.json().catch(() => ({ imageUrl: "" }));
  if (!/^https:\/\//.test(String(imageUrl))) return NextResponse.json({ error: "صورة غير صالحة" }, { status: 400 });

  const r = await fetch(API, {
    method: "POST",
    headers: { authorization: `Bearer ${key()}`, "content-type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, enable_pbr: true, should_remesh: true, should_texture: true }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.result) return NextResponse.json({ error: d.message || `فشل بدء التوليد (${r.status})` }, { status: 502 });
  await db.from("products").update({ model_task: String(d.result) }).eq("id", id);
  return NextResponse.json({ task: d.result });
}

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!key()) return NextResponse.json({ error: "no key" }, { status: 503 });
  const { id } = await params;
  const { data: p } = await db.from("products").select("model_task,model_url").eq("id", id).single();
  if (!p?.model_task) return NextResponse.json({ status: "NONE", model_url: p?.model_url || null });

  const r = await fetch(`${API}/${encodeURIComponent(p.model_task)}`, { headers: { authorization: `Bearer ${key()}` }, cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return NextResponse.json({ status: "ERROR", error: d.message || r.status }, { status: 502 });

  if (d.status === "SUCCEEDED" && d.model_urls?.glb) {
    const glb = await fetch(d.model_urls.glb);
    if (!glb.ok) return NextResponse.json({ status: "ERROR", error: "تعذّر تنزيل النموذج" }, { status: 502 });
    const buf = Buffer.from(await glb.arrayBuffer());
    const path = `public/3d/ai-${id}-${Date.now()}.glb`;
    const up = await db.storage.from("products").upload(path, buf, { contentType: "model/gltf-binary" });
    if (up.error) return NextResponse.json({ status: "ERROR", error: up.error.message }, { status: 500 });
    const url = db.storage.from("products").getPublicUrl(path).data.publicUrl;
    await db.from("products").update({ model_url: url, model_task: null }).eq("id", id);
    return NextResponse.json({ status: "SUCCEEDED", model_url: url });
  }
  if (d.status === "FAILED" || d.status === "CANCELED") {
    await db.from("products").update({ model_task: null }).eq("id", id);
  }
  return NextResponse.json({ status: d.status, progress: d.progress ?? 0 });
}
