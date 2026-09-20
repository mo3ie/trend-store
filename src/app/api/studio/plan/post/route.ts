import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";

import { featuresFor } from "@/lib/entitlements";
import { generateImage, tierFor } from "@/services/studioImages";

// PATCH — edit one planned post.
// Body: { id, ...fields }  (caption, hashtags, cta, image_url, image_source, scheduled_for,
//         status, boost, boost_budget_usd, boost_days) — or { id, regenerate: true } to
//         make a fresh AI image from the stored image_prompt.
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const b = await req.json();
  if (!b.id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

  const patch: Record<string, unknown> = {};

  if (b.regenerate) {
    const { data: cur } = await supabaseAdmin.from("studio_posts")
      .select("image_prompt, page_id").eq("id", b.id).eq("user_id", user.id).maybeSingle();
    const prompt = cur?.image_prompt || (typeof b.image_prompt === "string" ? b.image_prompt : "product photo");
    // A single, user-initiated regeneration always runs at the customer's full tier.
    const tier = tierFor(await featuresFor(user.id, "studio", cur?.page_id).catch(() => new Set<string>()));
    const { url, tier: used } = await generateImage(prompt, tier);
    patch.image_url = url;
    patch.image_source = "ai";
    patch.image_tier = used;
  }
  for (const k of ["caption", "hashtags", "cta", "image_url", "image_source", "scheduled_for", "status", "image_prompt", "post_type", "reply_config"]) {
    if (k in b) patch[k] = b[k];
  }
  if ("boost" in b) patch.boost = !!b.boost;
  for (const k of ["boost_budget_usd", "boost_days"]) if (k in b) patch[k] = b[k];

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "لا تغييرات" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("studio_posts").update(patch).eq("id", b.id).eq("user_id", user.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data });
}

// DELETE ?id= — remove one post from the plan.
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });
  await supabaseAdmin.from("studio_posts").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
