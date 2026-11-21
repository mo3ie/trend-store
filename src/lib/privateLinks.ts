import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { siteUrl } from "@/lib/siteUrl";

/**
 * The private reply, delivered by link.
 *
 * Facebook lets the bot answer a comment publicly and send the price in a DM, so
 * the price never appears under the post — that privacy IS the mechanic: the
 * customer must comment to learn it, and commenting is what lifts the post.
 *
 * TikTok gives us no DM. The Business Messaging application has been frozen by
 * TikTok since 7 Nov 2026, and when it reopens it will only serve Verified
 * Business Accounts, which effectively do not exist in Libya. So the engine did
 * the only thing available and posted the private text publicly, which hands the
 * price to every reader and destroys the reason for writing it privately.
 *
 * A token restores the property the DM provided. The comment carries an opaque
 * link; the price sits behind it. Everyone sees a link, one person opens it.
 *
 * What this is NOT: it is not a claim of secrecy. A link inside a public comment
 * can be tapped by anyone who sees it. The limits below make it impractical to
 * pass around rather than impossible to — which is the honest description, and
 * the reason the merchant-facing copy says "limited", never "private to them".
 */

/**
 * No 0/O/1/I/l. These links get read off a phone screen and retyped, and a
 * customer who mistypes their own price link blames the shop, not the font.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const TOKEN_LEN = 7;

/** ~31^7 ≈ 2.7e10 — far too sparse to walk, andeach row is rate-limited behind a route. */
export function newToken(): string {
  const bytes = new Uint8Array(TOKEN_LEN);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export const DEFAULT_TTL_HOURS = 48;
export const DEFAULT_MAX_OPENS = 3;
/** What the merchant's public comment says when they have not written their own. */
export const DEFAULT_LINK_TEXT = "تم تجهيز ردّك ✅";

export interface CreateLinkInput {
  configId: string;
  userId: string;
  platform?: string;
  pageId?: string | null;
  commentId?: string | null;
  videoId?: string | null;
  commenterName?: string | null;
  /** The resolved private text — the thing being protected. */
  body: string;
  brandName?: string | null;
  whatsappNumber?: string | null;
  whatsappText?: string | null;
  ttlHours?: number | null;
  maxOpens?: number | null;
}

/**
 * Creates the link row and returns its absolute URL.
 *
 * Returns null rather than throwing: a failure here must cost the customer the
 * private text, never the public answer. The caller falls back to its existing
 * behaviour, which is the behaviour that shipped before this feature existed.
 *
 * Re-entry is expected — the webhook and the reconciliation sweep can both reach
 * the same comment — so a conflict on (platform, comment_id) returns the link
 * that already exists instead of minting a second quote for one customer.
 */
export async function createPrivateLink(input: CreateLinkInput): Promise<string | null> {
  const body = (input.body || "").trim();
  if (!body) return null;

  const ttl = clamp(input.ttlHours ?? DEFAULT_TTL_HOURS, 1, 720);
  const maxOpens = clamp(input.maxOpens ?? DEFAULT_MAX_OPENS, 1, 50);
  const platform = input.platform || "tiktok";

  const row = {
    token: newToken(),
    config_id: input.configId,
    user_id: input.userId,
    platform,
    page_id: input.pageId ?? null,
    comment_id: input.commentId ?? null,
    video_id: input.videoId ?? null,
    commenter_name: firstName(input.commenterName),
    body,
    brand_name: input.brandName ?? null,
    whatsapp_number: normalizeWhatsApp(input.whatsappNumber),
    whatsapp_text: (input.whatsappText || "").trim() || null,
    max_opens: maxOpens,
    expires_at: new Date(Date.now() + ttl * 3_600_000).toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("private_links").insert(row).select("token").maybeSingle();

  if (data?.token) return linkUrl(data.token);

  // 23505 = unique violation. Either this comment already has a link (re-entry) or,
  // vanishingly rarely, the token collided. Both are recoverable without an error.
  if (error?.code === "23505" && input.commentId) {
    const { data: existing } = await supabaseAdmin
      .from("private_links").select("token")
      .eq("platform", platform).eq("comment_id", input.commentId).maybeSingle();
    if (existing?.token) return linkUrl(existing.token);
  }
  if (error) console.error("private_link_create_failed", error.code ?? "");
  return null;
}

export function linkUrl(token: string): string {
  return siteUrl(`/r/${token}`);
}

/**
 * Builds the comment the bot actually posts.
 *
 * The merchant writes the sentence; the engine appends the link. They cannot type
 * the URL themselves because it is minted per commenter — but a merchant who DOES
 * write `{link}` gets it placed exactly where they put it, because some want the
 * link mid-sentence and finding that impossible would feel like a bug.
 */
export function composePublicReply(template: string | null, url: string, fallback?: string | null): string {
  const base = (template || "").trim() || (fallback || "").trim() || DEFAULT_LINK_TEXT;
  if (base.includes("{link}")) return base.replace(/\{link\}/g, url);
  return `${base}\n${url}`;
}

/**
 * Digits only, with Libya's 0-prefix dropped: wa.me rejects "+", spaces and a
 * leading zero, and a merchant typing their number the way they say it aloud
 * ("0 91 ...") would otherwise produce a dead button for every customer.
 */
export function normalizeWhatsApp(raw: string | null | undefined): string | null {
  let s = (raw || "").replace(/[^\d]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = s.slice(2);
  if (s.startsWith("0")) s = `218${s.slice(1)}`;
  if (s.length < 9 || s.length > 15) return null;
  return s;
}

/** The wa.me URL for a link, with the merchant's wording pre-typed for the customer. */
export function whatsappUrl(number: string, text: string | null, token: string): string {
  const msg = (text || "").trim() || "مرحباً، أريد الاستفسار عن هذا المنتج";
  return `https://wa.me/${number}?text=${encodeURIComponent(`${msg}\n(${token})`)}`;
}

function firstName(name: string | null | undefined): string | null {
  const s = (name || "").trim();
  if (!s) return null;
  return s.split(/\s+/)[0].slice(0, 40);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.round(Number(n) || lo)));
}
