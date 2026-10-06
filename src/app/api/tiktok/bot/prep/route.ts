import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";

export const maxDuration = 30;

/**
 * The draft bot configuration an owner can build BEFORE linking a TikTok account.
 *
 * Every setting in this product hangs off a `bot_configs` row, and that row was only
 * created when an account linked. With linking unavailable, the whole configurable
 * surface — keyword groups, banned words, the catalog, the AI toggle, per-video
 * replies — was unreachable, so the tool looked far thinner than it is. That was the
 * owner's complaint, and it was a routing problem, not a missing feature.
 *
 * So a draft row is created on demand, keyed by a reserved page_id (`prep:<user id>`)
 * that no real TikTok account can collide with: TikTok open ids are opaque
 * alphanumerics and never contain a colon. It is created disabled, and the engines
 * only ever load configs by a real account's open id, so a draft can never answer a
 * live comment.
 *
 * When an account finally links, `adoptPrepConfig` moves the owner's work onto it
 * rather than leaving them to retype it.
 */

export function prepPageId(userId: string): string {
  return `prep:${userId}`;
}

/** GET/POST — the draft config, created on first use. */
export async function POST() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const pageId = prepPageId(user.id);

  const { data: existing } = await supabaseAdmin
    .from("bot_configs").select("*")
    .eq("user_id", user.id).eq("platform", "tiktok").eq("page_id", pageId)
    .maybeSingle();
  if (existing) return NextResponse.json({ config: existing, draft: true });

  // If a real account is already linked, its config is the one to use — a draft would
  // only split the owner's settings across two rows.
  const { data: live } = await supabaseAdmin
    .from("bot_configs").select("*")
    .eq("user_id", user.id).eq("platform", "tiktok")
    .not("page_id", "like", "prep:%")
    .limit(1).maybeSingle();
  if (live) return NextResponse.json({ config: live, draft: false });

  const { data: created, error } = await supabaseAdmin
    .from("bot_configs")
    .insert({
      user_id: user.id,
      platform: "tiktok",
      page_id: pageId,
      page_name: null,
      enabled: false,          // a draft never runs
      reply_public: true,      // TikTok replies are public; there is no other mode
      mention_author: true,
      once_per_user: true,
      catalog_match: "off",
    })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: created, draft: true });
}

export async function GET() {
  return POST();
}
