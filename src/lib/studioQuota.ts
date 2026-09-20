import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAccess } from "@/lib/entitlements";

/**
 * Metering for the paid ("strong") AI in the Studio.
 *
 * Only three actions cost money — a high-quality image, an AI photo edit, and a
 * video clip — so only those three are metered. The free generator, web image
 * search and catalog photos are unlimited, which is what keeps a customer who has
 * spent their allowance still able to finish a content plan.
 *
 * The window is a month anchored on the subscription's own start day, so a yearly
 * subscriber gets a monthly allowance rather than the whole year's on day one.
 */

export type QuotaKind = "images" | "videos";

// Top-up packs, bought from the wallet, valid only inside the current window.
export const TOPUP = {
  images: { price_lyd: Number(process.env.STUDIO_TOPUP_IMAGE_PRICE || 100), amount: Number(process.env.STUDIO_TOPUP_IMAGE_AMOUNT || 100) },
  videos: { price_lyd: Number(process.env.STUDIO_TOPUP_VIDEO_PRICE || 100), amount: Number(process.env.STUDIO_TOPUP_VIDEO_AMOUNT || 10) },
};

// A free trial must not be a free pass to the paid models, so it gets a token
// allowance — enough to see the quality difference, not enough to be farmed.
const TRIAL_QUOTA = { images: 10, videos: 1 };

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export interface QuotaState {
  unlimited: boolean;                    // admins only
  subscriptionId: string | null;
  periodStart: string;
  periodEnd: string;
  images: { limit: number; used: number; extra: number; left: number };
  videos: { limit: number; used: number; extra: number; left: number };
}

/** The monthly window containing `now`, counted from the subscription's start day. */
function windowFor(startsAt: string | null): { start: Date; end: Date } {
  const anchor = startsAt ? new Date(startsAt).getTime() : Date.now();
  const elapsed = Math.max(0, Math.floor((Date.now() - anchor) / MONTH_MS));
  const start = new Date(anchor + elapsed * MONTH_MS);
  return { start, end: new Date(start.getTime() + MONTH_MS) };
}

/** The studio subscription backing this user's paid generation, if any. */
async function studioSub(userId: string) {
  const nowIso = new Date().toISOString();
  const { data } = await supabaseAdmin
    .from("subscriptions").select("id, plan_id, starts_at, expires_at")
    .eq("user_id", userId).eq("product", "studio").eq("status", "active")
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("expires_at", { ascending: false })
    .limit(1).maybeSingle();
  return data;
}

/** Read (and lazily create) the current window's usage row. */
export async function getQuota(userId: string): Promise<QuotaState> {
  const access = await getAccess(userId);
  const sub = await studioSub(userId);
  const { start, end } = windowFor(sub?.starts_at ?? null);

  let imageLimit = 0, videoLimit = 0;
  if (sub?.plan_id) {
    const { data: plan } = await supabaseAdmin
      .from("subscription_plans").select("ai_image_quota, ai_video_quota")
      .eq("id", sub.plan_id).maybeSingle();
    imageLimit = Number(plan?.ai_image_quota ?? 0);
    videoLimit = Number(plan?.ai_video_quota ?? 0);
  } else if (access.trial) {
    imageLimit = TRIAL_QUOTA.images;
    videoLimit = TRIAL_QUOTA.videos;
  }

  const startIso = start.toISOString();
  let { data: row } = await supabaseAdmin
    .from("studio_usage").select("*")
    .eq("user_id", userId).eq("period_start", startIso)
    .maybeSingle();

  if (!row) {
    const ins = await supabaseAdmin.from("studio_usage").insert({
      user_id: userId, subscription_id: sub?.id ?? null,
      period_start: startIso, period_end: end.toISOString(),
    }).select().maybeSingle();
    // A racing request may have inserted it first; re-read rather than fail.
    row = ins.data ?? (await supabaseAdmin.from("studio_usage").select("*")
      .eq("user_id", userId).eq("period_start", startIso).maybeSingle()).data;
  }

  const mk = (limit: number, used: number, extra: number) => ({
    limit, used, extra, left: Math.max(0, limit + extra - used),
  });

  return {
    unlimited: access.admin,
    subscriptionId: sub?.id ?? null,
    periodStart: startIso,
    periodEnd: end.toISOString(),
    images: mk(imageLimit, Number(row?.images_used ?? 0), Number(row?.images_extra ?? 0)),
    videos: mk(videoLimit, Number(row?.videos_used ?? 0), Number(row?.videos_extra ?? 0)),
  };
}

/**
 * Claim `n` units before doing the paid work. Returns how many were actually
 * granted — callers must generate only that many. Admins are unlimited.
 */
export async function claim(userId: string, kind: QuotaKind, n = 1): Promise<{ granted: number; state: QuotaState }> {
  const state = await getQuota(userId);
  if (state.unlimited) return { granted: n, state };

  const granted = Math.min(n, state[kind].left);
  if (granted <= 0) return { granted: 0, state };

  const col = kind === "images" ? "images_used" : "videos_used";
  await supabaseAdmin.from("studio_usage")
    .update({ [col]: state[kind].used + granted })
    .eq("user_id", userId).eq("period_start", state.periodStart);

  const after = { ...state, [kind]: { ...state[kind], used: state[kind].used + granted, left: state[kind].left - granted } };
  return { granted, state: after as QuotaState };
}

/** Hand units back when the paid call failed — the customer must not pay for nothing. */
export async function refund(userId: string, kind: QuotaKind, n = 1): Promise<void> {
  if (n <= 0) return;
  const state = await getQuota(userId);
  if (state.unlimited) return;
  const col = kind === "images" ? "images_used" : "videos_used";
  await supabaseAdmin.from("studio_usage")
    .update({ [col]: Math.max(0, state[kind].used - n) })
    .eq("user_id", userId).eq("period_start", state.periodStart);
}

/** Add a bought pack to the CURRENT window only. */
export async function addExtra(userId: string, kind: QuotaKind, amount: number): Promise<QuotaState> {
  const state = await getQuota(userId);
  const col = kind === "images" ? "images_extra" : "videos_extra";
  await supabaseAdmin.from("studio_usage")
    .update({ [col]: state[kind].extra + amount })
    .eq("user_id", userId).eq("period_start", state.periodStart);
  return await getQuota(userId);
}
