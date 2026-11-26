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
/*
 * Five, not seven, because the customer TYPES this.
 *
 * TikTok renders a URL in a comment as plain text -- there is no tap target, on
 * any account. So the realistic path is the one every TikTok shop already uses: a
 * fixed clickable link in the profile bio, and a short code in the comment. Two
 * extra characters are two more chances to mistype a price on a phone.
 *
 * 31^5 is 28.6 million, against links that live 24 hours. Guessing one is not a
 * realistic attack, and the page behind it holds a price, not an account.
 */
const TOKEN_LEN = 5;

/** ~31^7 ≈ 2.7e10 — far too sparse to walk, andeach row is rate-limited behind a route. */
export function newToken(): string {
  const bytes = new Uint8Array(TOKEN_LEN);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

/*
 * One open, 24 hours.
 *
 * Chosen by the operator over the gentler 3-in-48: the whole point of hiding the
 * price is that learning it costs a comment, and a link that opens three times is
 * a link that can be handed to two friends. At one open the only way to see the
 * price a second time is to comment again -- which is the behaviour the mechanic
 * is built to produce.
 *
 * This is survivable for the customer ONLY because the view cookie makes refreshes
 * free (see /r/[token]). Without it, one open would mean one accidental
 * back-button and a lost sale.
 */
export const DEFAULT_TTL_HOURS = 24;
export const DEFAULT_MAX_OPENS = 1;
/** What the merchant's public comment says when they have not written their own. */
/*
 * The default comment, written for a platform where the URL is not tappable.
 * "الرابط في البايو" is the convention every TikTok user already knows, so the
 * comment carries a short code and points at the bio rather than printing a URL
 * nobody can press.
 */
export const DEFAULT_LINK_TEXT = "كودك {code} — افتح الرابط في البايو واكتب الكود لترى السعر 🔑";

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
 * Two placeholders, because the platforms need different shapes:
 *
 *   {code}  the bare token. For TikTok, where a URL in a comment is dead text and
 *           the customer reaches the page through the bio link instead.
 *   {link}  the full URL. Right anywhere it is actually tappable.
 *
 * A template naming {code} and not {link} gets NO url appended: that merchant
 * chose the bio flow, and pasting an unpressable URL underneath would only make
 * the comment longer and look broken. Naming neither keeps the old behaviour.
 */
export function composePublicReply(
  template: string | null, url: string, fallback?: string | null, token?: string,
): string {
  const base = (template || "").trim() || (fallback || "").trim() || DEFAULT_LINK_TEXT;
  const code = token || url.split("/").pop() || "";
  const hasCode = base.includes("{code}");
  const hasLink = base.includes("{link}");

  let out = base.split("{code}").join(code).split("{link}").join(url);

  /*
   * A template naming neither placeholder gets BOTH, each on its own line.
   *
   * It used to get the URL alone, and that failed in a way only a live test
   * showed: the code is the URL's last segment, so a merchant whose text was
   * "تم الرد عليك داخل الرابط الخاص 📩" saw one line ending in /r/AB3K9 and no
   * code anywhere. Reported exactly: "الكود ظهر مع الرابط، خلي الكود بروحه".
   *
   * He is right, and it is not a cosmetic point. The two serve different people.
   * The code alone is what someone on a phone reads and retypes at the bio link,
   * and digging it out of the tail of a URL is work. The full URL is what someone
   * on a desktop copies. Printing them on separate lines costs one newline and
   * serves both; printing only the URL served neither well.
   *
   * ## The lines are LABELLED, and that was the second lesson
   *
   * They shipped bare for one comment's lifetime, on the theory that a naked code
   * survives a glance down a crowded list. It does — and it means nothing when it
   * lands. The live reply read:
   *
   *     تم الرد عليك داخل الرابط الخاص 📩
   *     7UT8S
   *     https://www.trendstore-ly.com/r/7UT8S
   *
   * Reported as "مبهم، لماذا سيفعل الزبون". Exactly right. Someone who typed
   * "بكم" is shown a passive sentence, five characters of apparent noise, and a
   * URL that TikTok does not make tappable. Nothing tells them that a PRICE is
   * behind it, and nothing tells them what to DO. Legibility was never the
   * problem; the comment had no verb.
   *
   * So each line now says what it is and what to do with it. Three short words
   * are cheap. A customer who shrugs and scrolls is not.
   */
  if (!hasCode && !hasLink) out = `${out}\n${LABEL_CODE}${code}\n${LABEL_LINK}${url}`;
  return clampComment(out, code, url);
}

/*
 * Written as instructions, not as nouns. "كودك" and "أو افتح" tell the reader
 * that the first is theirs to use and the second is the alternative — the two
 * facts a stranger needs and cannot infer from a bare string.
 */
const LABEL_CODE = "كودك: ";
const LABEL_LINK = "أو افتح: ";

/**
 * TikTok rejects a comment over 150 characters outright.
 *
 * Which is a silent bot: the reply fails, the customer gets nothing, and nothing
 * on the merchant's screen says why. Nobody had checked, and the margin is
 * thinner than it looks — the URL alone is ~37 characters and the labelled code
 * another ~13, so a merchant with a two-sentence greeting is already over.
 *
 * Degrading in order, keeping the most useful thing last:
 *
 *   1. drop the URL line  — the code plus the bio link is the designed path, and
 *                           the URL is not tappable on TikTok anyway
 *   2. trim the merchant's own text — their words yield before the mechanism,
 *                           because a warm sentence with no code is useless
 *   3. hard cut           — never return something TikTok will refuse
 */
export const COMMENT_MAX = 150;

export function clampComment(text: string, code: string, url: string): string {
  const len = (s: string) => [...s].length;   // codepoints: an emoji is one char
  if (len(text) <= COMMENT_MAX) return text;

  const withoutUrl = text.split(`\n${LABEL_LINK}${url}`).join("").split(`\n${url}`).join("");
  if (len(withoutUrl) <= COMMENT_MAX) return withoutUrl;

  // Keep the tail — the code lives there — and shorten the merchant's opening.
  const tail = `\n${LABEL_CODE}${code}`;
  const head = withoutUrl.endsWith(tail) ? withoutUrl.slice(0, -tail.length) : withoutUrl;
  const room = COMMENT_MAX - len(tail) - 1;
  if (room > 8) return `${[...head].slice(0, room).join("").trim()}…${tail}`;

  return [...withoutUrl].slice(0, COMMENT_MAX).join("");
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
