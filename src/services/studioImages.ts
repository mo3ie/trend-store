/**
 * Studio image + video generation, tiered by subscription plan.
 *
 * The generator a customer gets is decided by the feature flags on their plan, so
 * the tiers stay a pricing decision in the database rather than a code branch:
 *
 *   basic   → free            Pollinations (FLUX, free endpoint, no key)
 *   medium  → ai_images       FLUX.2 [dev]   ~$0.012 / megapixel
 *   vip     → ai_images_max   FLUX.2 [pro]   ~$0.03 first megapixel
 *             ai_image_edit   FLUX.2 [pro] edit — redraw a catalog photo from a prompt
 *             ai_video        Kling 2.5 Turbo Pro — ~$0.35 per 5-second clip
 *
 * Everything paid runs through fal.ai (`FAL_KEY`). With no key configured every
 * tier silently falls back to the free generator, so the product keeps working.
 * Model ids are env-overridable because providers rename endpoints.
 */

export type ImageTier = "free" | "pro" | "max";

export const MODELS = {
  pro:   process.env.FAL_IMAGE_MODEL_PRO  || "fal-ai/flux-2-dev",
  max:   process.env.FAL_IMAGE_MODEL_MAX  || "fal-ai/flux-2-pro",
  edit:  process.env.FAL_EDIT_MODEL       || "fal-ai/flux-2-pro/edit",
  video: process.env.FAL_VIDEO_MODEL      || "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
};

// Indicative unit costs in USD, used for the in-app cost notice and admin reporting.
// Verified against fal.ai pricing on 2026-09-20; re-check before changing plan prices.
export const UNIT_COST_USD = {
  free: 0,
  pro:  0.012,   // FLUX.2 [dev], 1 MP
  max:  0.03,    // FLUX.2 [pro], first MP
  edit: 0.03,    // FLUX.2 [pro] edit, first MP
  video: 0.35,   // Kling 2.5 Turbo Pro, 5 seconds
};

export const hasFal = () => Boolean((process.env.FAL_KEY || "").trim());

/** Which generator this feature set is entitled to. */
export function tierFor(features: Set<string> | string[]): ImageTier {
  const f = features instanceof Set ? features : new Set(features);
  if (f.has("ai_images_max") && hasFal()) return "max";
  if (f.has("ai_images") && hasFal()) return "pro";
  return "free";
}

/** The free generator: a plain URL, generated on demand by Pollinations. No API call. */
export function pollinations(prompt: string): string {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=1024&height=1024&nologo=true&model=flux&enhance=true&seed=${Math.floor(Math.random() * 1e6)}`;
}

async function falRun<T>(model: string, body: Record<string, unknown>): Promise<T> {
  const key = (process.env.FAL_KEY || "").trim();
  if (!key) throw new Error("fal_not_configured");
  const r = await fetch(`https://fal.run/${model}`, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!r.ok) throw await falError(r);
  return await r.json() as T;
}

// A locked account authenticates fine and then refuses every call. Without this it
// surfaces as an opaque 403 and looks indistinguishable from a broken key.
async function falError(r: Response): Promise<Error> {
  const text = (await r.text()).slice(0, 300);
  if (r.status === 403 && /TOP_UP|locked/i.test(text)) return new Error("fal_no_credit");
  return new Error(`fal_${r.status}:${text}`);
}

// Turn a thrown provider error into something a shop owner can act on.
export function falErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : "";
  if (msg === "fal_no_credit") return "رصيد مزوّد الصور (fal.ai) نفد — اشحن الحساب لتفعيل الجودة العالية.";
  if (msg === "fal_not_configured") return "مولّد الصور المدفوع غير مُفعّل.";
  if (msg.startsWith("fal_401") || msg.startsWith("fal_403")) return "مفتاح مزوّد الصور غير صالح.";
  return "تعذّر توليد الصورة — حاول مرة أخرى.";
}

type FalImages = { images?: Array<{ url?: string }> };

/**
 * Make an image for a post. Falls back to the free generator on any paid-path
 * failure — a plan must never end up with no image because a provider blipped.
 * Returns the url and which tier actually produced it.
 */
export async function generateImage(prompt: string, tier: ImageTier): Promise<{ url: string; tier: ImageTier }> {
  if (tier === "free" || !hasFal()) return { url: pollinations(prompt), tier: "free" };
  try {
    const d = await falRun<FalImages>(MODELS[tier], { prompt, image_size: "square_hd", num_images: 1 });
    const url = d.images?.[0]?.url;
    if (!url) throw new Error("fal_empty");
    return { url, tier };
  } catch {
    return { url: pollinations(prompt), tier: "free" };
  }
}

/**
 * Redraw an existing image (a real catalog photo) from an instruction — new
 * background, added branding, a cleaner studio look. VIP only: unlike generation
 * there is no free fallback, because a silent fall back to a *generated* image
 * would replace the customer's real product with an invented one.
 */
export async function editImage(imageUrl: string, prompt: string): Promise<string> {
  const d = await falRun<FalImages>(MODELS.edit, { prompt, image_urls: [imageUrl], image_size: "square_hd" });
  const url = d.images?.[0]?.url;
  if (!url) throw new Error("fal_empty");
  return url;
}

// ── Video (queued) ───────────────────────────────────────────────────────────
// A clip takes minutes, far past any serverless request limit, so video uses
// fal's queue API: submit returns a request id, and the UI polls for the result.

export async function submitVideo(prompt: string, imageUrl?: string): Promise<string> {
  const key = (process.env.FAL_KEY || "").trim();
  if (!key) throw new Error("fal_not_configured");
  const body: Record<string, unknown> = { prompt, duration: "5" };
  if (imageUrl) body.image_url = imageUrl;
  const r = await fetch(`https://queue.fal.run/${MODELS.video}`, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!r.ok) throw await falError(r);
  const d = await r.json() as { request_id?: string };
  if (!d.request_id) throw new Error("fal_no_request_id");
  return d.request_id;
}

export type VideoStatus =
  | { state: "pending" }
  | { state: "done"; url: string }
  | { state: "failed"; message: string };

export async function videoStatus(requestId: string): Promise<VideoStatus> {
  const key = (process.env.FAL_KEY || "").trim();
  if (!key) return { state: "failed", message: "fal_not_configured" };
  const base = `https://queue.fal.run/${MODELS.video}/requests/${encodeURIComponent(requestId)}`;

  const s = await fetch(`${base}/status`, { headers: { Authorization: `Key ${key}` }, cache: "no-store" });
  if (!s.ok) return { state: "failed", message: `status_${s.status}` };
  const sd = await s.json() as { status?: string };
  if (sd.status !== "COMPLETED") {
    return sd.status === "IN_QUEUE" || sd.status === "IN_PROGRESS"
      ? { state: "pending" }
      : { state: "failed", message: sd.status || "unknown" };
  }

  const r = await fetch(base, { headers: { Authorization: `Key ${key}` }, cache: "no-store" });
  if (!r.ok) return { state: "failed", message: `result_${r.status}` };
  const d = await r.json() as { video?: { url?: string } };
  const url = d.video?.url;
  return url ? { state: "done", url } : { state: "failed", message: "no_video" };
}
