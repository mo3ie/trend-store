import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import { getActiveGrant } from "@/lib/tiktokAdsTokens";

/**
 * Designates the ONE TikTok ad account that funds every customer's campaigns.
 *
 * The Facebook model, finally matched: `META_AD_ACCOUNT_ID` has always been the
 * platform's own account paying for everyone, while TikTok ran each campaign on
 * the customer's own advertiser — and still charged them in LYD for the spend.
 * See sql/44 for the full contradiction.
 *
 * The owner links an advertiser account through the ordinary flow
 * (/api/tiktok/ads/connect — same state binding, same encrypted storage) and
 * then marks it here. No token is ever pasted into an environment variable.
 *
 * ## Why this is admin-only, enforced here
 *
 * Whoever owns the flagged grant owns the card that pays for every campaign on
 * the platform. A merchant who could set this flag would redirect everyone's ad
 * spend onto — or off — their own account. The allowlist is the same one the
 * middleware uses for /admin, read from the environment so it is not a constant
 * someone edits in a hurry.
 */

function isAdmin(email: string | null | undefined): boolean {
  const allow = (process.env.ADMIN_EMAILS || "mo3iemohamed@gmail.com")
    .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return !!email && allow.includes(email.toLowerCase());
}

/** GET — who is currently funding campaigns, and can this admin take it over? */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  if (!isAdmin(user.email)) return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });

  const [{ data: current }, mine] = await Promise.all([
    supabaseAdmin.from("tiktok_ads_authorizations")
      .select("user_id, advertiser_ids, connected_at")
      .eq("is_platform", true).eq("status", "active").maybeSingle(),
    getActiveGrant(user.id),
  ]);

  return NextResponse.json({
    // Never the token, and never another user's id — only whether one is set.
    configured: !!current,
    advertiserIds: (current?.advertiser_ids as string[] | null) ?? [],
    connectedAt: current?.connected_at ?? null,
    isMine: !!current && current.user_id === user.id,
    canSet: !!mine,
  });
}

/**
 * POST — make THIS admin's linked advertiser the platform account.
 *
 * Clears any previous flag first. The partial unique index in sql/44 would
 * otherwise reject the insert, and more importantly two flagged rows would make
 * "which card is paying" depend on row order.
 */
export async function POST() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  if (!isAdmin(user.email)) return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });

  const grant = await getActiveGrant(user.id);
  if (!grant) {
    return NextResponse.json({
      error: "not_connected",
      message: "اربط حساب الإعلانات بهذا الحساب أولاً، ثم اجعله الحساب المموّل.",
    }, { status: 400 });
  }
  if (!((grant.advertiser_ids as string[] | null) || []).length) {
    return NextResponse.json({
      error: "no_advertiser",
      message: "الربط لا يشمل أي حساب إعلاني — أنشئ حساباً في TikTok Ads Manager ثم أعد الربط.",
    }, { status: 400 });
  }

  await supabaseAdmin.from("tiktok_ads_authorizations")
    .update({ is_platform: false }).eq("is_platform", true);

  const { error } = await supabaseAdmin.from("tiktok_ads_authorizations")
    .update({ is_platform: true }).eq("id", grant.id);
  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });

  return NextResponse.json({ ok: true, advertiserIds: grant.advertiser_ids });
}

/**
 * DELETE — stop funding customers from this account.
 *
 * The grant itself is left connected: unflagging must not also disconnect the
 * owner's own ads. After this, a customer with no account of their own gets
 * "إعلانات تيك توك غير مهيّأة بعد" rather than a campaign billed to nobody.
 */
export async function DELETE() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  if (!isAdmin(user.email)) return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });

  await supabaseAdmin.from("tiktok_ads_authorizations")
    .update({ is_platform: false }).eq("is_platform", true);
  return NextResponse.json({ ok: true });
}
