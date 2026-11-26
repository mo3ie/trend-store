import { normalize } from "@/services/replyDecision";

/**
 * Does this comment ask about the price?
 *
 * ## Why this file exists
 *
 * The bot had no idea. `decide()` puts every generated answer — the catalog's and
 * the AI's alike — into `privateText`, and `tiktokEngine` then sends ANY private
 * text through the one-off link. So on a merchant running `private_delivery =
 * 'link'`, a customer asking "توصّلون لمصراتة؟" was handed a five-character code
 * and told to go to the bio and type it, to be told yes.
 *
 * That is not privacy, it is an obstacle. Hiding the price is a deliberate trade:
 * the customer pays a comment, and the comment lifts the video. Nobody trades
 * anything for a delivery answer, so gating one costs a sale and teaches the
 * audience that the codes are not worth chasing — which devalues the real ones.
 *
 * So the gate needs an opinion, and this is it: price questions go behind the
 * code, everything else is answered in the open, under the video, where it also
 * works as an advertisement for how fast the shop answers.
 *
 * ## Why keywords and not the model
 *
 * Asking the AI to classify costs a second call on every comment, against a
 * shared free daily budget ([[groq daily token cap]] — 200K tokens/day burns in
 * hours), adds a second failure mode, and is slower. "Is this asking a price" is
 * a closed question in a narrow domain: a word list decides it, in microseconds,
 * for nothing, offline, deterministically — and a merchant can read the list and
 * predict the behaviour, which they cannot do with a model.
 *
 * The cost of a miss is also asymmetric, and that shapes the list. A false NO
 * answers a price in public — the merchant's own catalog text, under their own
 * video; mildly bad. A false YES hands a code to someone who asked about
 * delivery; worse, because it wastes their patience and their trust. So the list
 * stays tight: words that genuinely mean price, not words that merely co-occur
 * with it.
 */

/**
 * Normalised price words. `normalize()` has already lower-cased, stripped
 * tashkeel, folded أإآ→ا, ى→ي, ة→ه, and removed punctuation and emoji, so these
 * are written in that folded form.
 *
 * Libyan Arabic first, because that is who comments on these videos: "بقداش",
 * "قداش", "بشحال" are the everyday forms and none of them contains the word
 * سعر, so a list built from Modern Standard Arabic alone would miss most real
 * customers.
 */
/**
 * Words that must match a token EXACTLY (after the prefix strip below).
 *
 * `تمن` is the reason this list is separate. It is the Libyan spelling of ثمن
 * (price), and it is also the first three letters of تمنية (eight) and يتمنى
 * (wishes). Allowed to match as a prefix it fires on "تمنية ايام" — a delivery
 * question — and hands that customer a code. So it matches whole or not at all.
 */
const EXACT = [
  // Libyan / Maghrebi — the everyday forms, and none of them contains سعر, so a
  // list built from Modern Standard Arabic alone would miss most real customers.
  "قداش", "شحال", "قداه", "تمن",
  // Levantine / Gulf / Egyptian — subscribers are not all Libyan.
  "بكم", "بكام", "كام", "بيكم", "بيكام",
  "hm",
];

/**
 * Words that may carry an Arabic possessive suffix: سعر → سعرها, سعركم, سعرهم.
 *
 * Matched as a prefix, but ONLY when what follows is a real suffix (see SUFFIXES).
 * A plain `startsWith` would be wrong in the same way `تمن` is wrong — it is the
 * suffix check, not the prefix, that makes this safe.
 */
const PREFIX = [
  "سعر", "اسعار", "ثمن", "قيم", "كلف", "تكلف",
  "price", "prices", "pricing", "cost", "costs",
];

/** Multi-word phrases, found anywhere in the normalised string. */
const PHRASES = ["how much", "howmuch", "what is the price", "whats the price"];

/**
 * Everything Arabic glues to the FRONT of a noun. Stripped so "بالسعر",
 * "وسعرها" and "للسعر" all reduce to the word being asked about.
 *
 * Longest first: "بال" must be tried before "ب", or "بالسعر" becomes "السعر"
 * and the ال never comes off.
 */
const CLITICS = ["بال", "وال", "فال", "لل", "ال", "ب", "و", "ف", "ل"];

/**
 * Suffixes a price noun may legitimately take. Anything else after the prefix
 * means it is a DIFFERENT word, which is exactly what keeps تمنية out.
 *
 * The ت forms (ته، تها) carry the feminine ة that `normalize` has already folded
 * to ه: قيمة → قيمه, and its possessive قيمته.
 */
const SUFFIXES = new Set([
  "", "ه", "ها", "هم", "هن", "هما", "ك", "كم", "كن", "ي", "نا",
  "ته", "تها", "تهم", "تك", "تكم", "تنا", "ات", "اتها", "اتكم",
]);

/** Removes one leading clitic, longest match first. */
function stripClitic(w: string): string {
  for (const c of CLITICS) {
    if (w.length > c.length + 1 && w.startsWith(c)) return w.slice(c.length);
  }
  return w;
}

function hits(token: string, extraExact: string[]): boolean {
  if (!token) return false;
  if (EXACT.includes(token) || extraExact.includes(token)) return true;
  for (const w of PREFIX) {
    if (token.length >= w.length && token.startsWith(w) && SUFFIXES.has(token.slice(w.length))) {
      return true;
    }
  }
  return false;
}

/**
 * True when the text asks what something costs.
 *
 * `extra` is the merchant's own additions (`bot_configs.price_keywords`), because
 * no list written here can know a particular shop's regulars. They are matched
 * exactly, not as prefixes: a merchant adding a word cannot be expected to have
 * reasoned about what else it is the beginning of.
 */
export function asksPrice(text: string, extra?: string[] | null): boolean {
  const norm = normalize(text || "");
  if (!norm) return false;

  const extraExact = (extra || []).map((w) => normalize(w)).filter(Boolean);

  for (const p of [...PHRASES, ...extraExact.filter((w) => w.includes(" "))]) {
    if (norm.includes(p)) return true;
  }

  /*
   * Matched per TOKEN, never as a substring of the whole message. Substring
   * matching looks equivalent and is not: "hm" is inside almost any English
   * word, and "تمن" is inside "تمنية".
   */
  for (const raw of norm.split(" ")) {
    if (hits(raw, extraExact)) return true;          // بكم — clitic is part of the word
    if (hits(stripClitic(raw), extraExact)) return true;  // السعر، بسعر، وسعرها
  }
  return false;
}

/**
 * How a shop wants price questions recognised.
 *
 *   "words"   the built-in list, plus anything the merchant added. The default.
 *   "ai"      ask the model on every comment. Catches phrasings no list holds —
 *             "هل هو غالي؟", "ميزانيتي ٣٠٠٠" — and costs a call per comment out
 *             of a shared free daily budget, so it is opt-in and says so.
 *   "manual"  ONLY the merchant's own words. For a shop that wants the gate to
 *             fire on exactly what it listed and nothing else.
 */
export type PriceMode = "words" | "ai" | "manual";

/** The built-in list, for the screen to show. Invisible rules cannot be trusted. */
export const BUILTIN_PRICE_WORDS: string[] = [
  "قداش", "بقداش", "شحال", "بشحال", "قداه",
  "بكم", "بكام", "كام", "بيكم",
  "سعر", "السعر", "سعرها", "أسعار", "ثمن", "تمن", "قيمة", "كلفة", "تكلفة",
  "price", "cost", "how much",
];

/**
 * The gate, with the mode applied.
 *
 * Async only because "ai" needs a round trip; the other two resolve immediately.
 * `classify` is injected rather than imported so this file stays free of the AI
 * stack — it is pure matching logic and every one of its tests runs offline.
 *
 * In "ai" mode a failed or unavailable model falls back to the word list rather
 * than to a guess. The wrong direction to fail is silently open: a price said out
 * loud cannot be taken back, while an over-gated delivery answer costs one
 * customer a walk.
 */
export async function asksPriceSmart(
  message: string,
  mode: PriceMode,
  extra?: string[] | null,
  classify?: (text: string) => Promise<boolean | null>,
): Promise<boolean> {
  if (mode === "manual") {
    const words = (extra || []).map((w) => w.trim()).filter(Boolean);
    // No words listed means nothing can match — which would gate nothing at all
    // and quietly publish every price. The built-ins hold the floor.
    return words.length ? asksPrice(message, words) : asksPrice(message);
  }
  if (mode === "ai" && classify) {
    const verdict = await classify(message).catch(() => null);
    if (verdict !== null && verdict !== undefined) return verdict;
  }
  return asksPrice(message, extra);
}

/**
 * Should this answer be hidden, or said out loud?
 *
 * Synchronous form, kept for callers that already know the verdict. See
 * `shouldGateAsync` for the one the engine uses.
 */
export function shouldGate(
  source: string, message: string, extra?: string[] | null,
): boolean {
  if (source === "ai") return asksPrice(message, extra);
  return true;
}

/** The same decision, honouring the merchant's chosen mode. */
export async function shouldGateAsync(
  source: string,
  message: string,
  mode: PriceMode,
  extra?: string[] | null,
  classify?: (text: string) => Promise<boolean | null>,
): Promise<boolean> {
  if (source !== "ai") return true;
  return asksPriceSmart(message, mode, extra, classify);
}
