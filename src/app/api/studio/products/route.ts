import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";

// GET ?pageId= — list catalog products for a Page.
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const pageId = req.nextUrl.searchParams.get("pageId");
  if (!pageId) return NextResponse.json({ error: "pageId مطلوب" }, { status: 400 });

  const { data } = await supabaseAdmin
    .from("studio_products").select("*")
    .eq("user_id", user.id).eq("page_id", pageId)
    .order("created_at", { ascending: false });
  return NextResponse.json({ products: data || [] });
}

// POST — create one product, or many at once.
// Single: { pageId, category, name, price_text, description, images[], available }
// Bulk:   { pageId, items: [{ name, category?, price_text?, available? }] }
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const b = await req.json();
  if (!b.pageId) return NextResponse.json({ error: "pageId مطلوب" }, { status: 400 });

  // Bulk quick-add: a list of item names (optionally with price/category).
  if (Array.isArray(b.items)) {
    const rows = b.items
      .filter((x: { name?: string }) => x?.name && String(x.name).trim())
      .map((x: { name: string; category?: string; price_text?: string; available?: boolean }) => ({
        user_id:    user.id,
        page_id:    String(b.pageId),
        category:   x.category ?? null,
        name:       String(x.name).trim(),
        price_text: x.price_text ?? null,
        images:     [],
        active:     true,
        available:  x.available !== false,
      }));
    if (rows.length === 0) return NextResponse.json({ error: "لا أسماء صالحة" }, { status: 400 });
    const { data, error } = await supabaseAdmin.from("studio_products").insert(rows).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ products: data || [] });
  }

  if (!b.name?.trim()) return NextResponse.json({ error: "الاسم مطلوب" }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from("studio_products").insert({
      user_id:     user.id,
      page_id:     String(b.pageId),
      category:    b.category ?? null,
      name:        String(b.name).trim(),
      price_text:  b.price_text ?? null,
      description: b.description ?? null,
      images:      Array.isArray(b.images) ? b.images.filter(Boolean) : [],
      active:      b.active !== false,
      available:   b.available !== false,
    }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product: data });
}

// PATCH — update a product. Body: { id, ...fields }
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const b = await req.json();
  if (!b.id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const k of ["category", "name", "price_text", "description", "active", "available"]) if (k in b) patch[k] = b[k];
  if (Array.isArray(b.images)) patch.images = b.images.filter(Boolean);

  const { data, error } = await supabaseAdmin
    .from("studio_products").update(patch)
    .eq("id", b.id).eq("user_id", user.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product: data });
}

// DELETE ?id=
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });
  await supabaseAdmin.from("studio_products").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
