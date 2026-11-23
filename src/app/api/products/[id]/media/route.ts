import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/apiAuth";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
type Params = Promise<{ id: string }>;

const isUrl = (u: unknown) => typeof u === "string" && /^https:\/\/[^\s]+$/.test(u) && u.length < 1000;

/** Saves a product's 360° frames and/or its 3D model URL (admin only). */
export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (Array.isArray(body.spin_images)) {
    const frames = body.spin_images.filter(isUrl).slice(0, 72);
    patch.spin_images = frames;
  }
  if ("model_url" in body) patch.model_url = body.model_url === null ? null : isUrl(body.model_url) ? body.model_url : undefined;
  if (patch.model_url === undefined) delete patch.model_url;
  if (!Object.keys(patch).length) return NextResponse.json({ error: "لا يوجد شيء للحفظ" }, { status: 400 });
  const { error } = await db.from("products").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
