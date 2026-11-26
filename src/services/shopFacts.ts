import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * The shop's own facts, handed to the bot so it can answer from them.
 *
 * ## The gap this closes
 *
 * The AI reply was given a persona and a page name and nothing else. Asked
 * "وين محلكم؟" it could only say a representative would follow up — while the
 * answer sat in `studio_brands`, filled in by the same merchant, on another
 * screen, for the content planner's use only. The operator put it exactly right:
 * the data should be entered once and everything should read it.
 *
 * So the bot reads the same row the Studio writes. One profile, two consumers.
 * Nothing new to fill in, and a merchant who improves their address for the
 * Studio improves their bot replies in the same keystroke.
 *
 * ## What is deliberately left out
 *
 * Prices. The catalog is a separate path with its own gate (`catalog_match`,
 * entitlement `catalog_reply`) and its answers are treated as price answers and
 * hidden behind the code. These facts go into replies that may be posted
 * PUBLICLY under the video, so anything here is something the merchant is happy
 * to see on a billboard. Address, phone and opening hours are. A price is not.
 */

export interface ShopFacts {
  brandName: string | null;
  phones: string[];
  addresses: string[];
  links: string[];
  hours: string | null;
  tone: string | null;
  /** Free text the merchant typed: delivery terms, policies, anything else. */
  extra: string | null;
  language: string | null;
}

/**
 * Loads the profile for this page, falling back to the user's only profile.
 *
 * The fallback matters: `studio_brands` is keyed by (user_id, page_id) and the
 * Studio's page_id is a Facebook Page while the bot's is a TikTok open_id. A
 * merchant who filled the profile once, for Facebook, would otherwise get
 * nothing on TikTok — which is the same "enter it twice" problem this file
 * exists to remove. One profile is unambiguous, so it is used.
 */
export async function loadShopFacts(userId: string, pageId?: string | null): Promise<ShopFacts | null> {
  const sel = "brand_name, phones, addresses, links, hours, tone, extra, language";

  if (pageId) {
    const { data } = await supabaseAdmin.from("studio_brands").select(sel)
      .eq("user_id", userId).eq("page_id", pageId).maybeSingle();
    if (data) return shape(data);
  }

  const { data: rows } = await supabaseAdmin.from("studio_brands").select(sel)
    .eq("user_id", userId).limit(2);
  if (rows?.length === 1) return shape(rows[0]);
  return null;
}

function shape(r: Record<string, unknown>): ShopFacts {
  const arr = (v: unknown) =>
    Array.isArray(v) ? v.map(String).map((x) => x.trim()).filter(Boolean).slice(0, 8) : [];
  const str = (v: unknown) => {
    const s = typeof v === "string" ? v.trim() : "";
    return s || null;
  };
  return {
    brandName: str(r.brand_name),
    phones: arr(r.phones),
    addresses: arr(r.addresses),
    links: arr(r.links),
    hours: str(r.hours),
    tone: str(r.tone),
    extra: str(r.extra),
    language: str(r.language),
  };
}

/**
 * Renders the facts as the block the model is given.
 *
 * Capped per field and overall. The system prompt travels on EVERY comment, and
 * a merchant who pastes an essay into `extra` would otherwise pay for it on every
 * reply out of a shared daily token budget — and bury the address they actually
 * wanted quoted.
 *
 * Returns "" when there is nothing worth sending, so the caller can keep its
 * existing "never invent details" instruction instead of handing the model an
 * empty FACTS heading and inviting it to fill one in.
 */
export function factsBlock(f: ShopFacts | null): string {
  if (!f) return "";
  const lines: string[] = [];
  if (f.brandName) lines.push(`Shop: ${f.brandName}`);
  if (f.addresses.length) lines.push(`Address: ${f.addresses.join(" | ").slice(0, 300)}`);
  if (f.phones.length) lines.push(`Phone: ${f.phones.join(" | ").slice(0, 160)}`);
  if (f.hours) lines.push(`Hours: ${f.hours.slice(0, 200)}`);
  if (f.links.length) lines.push(`Links: ${f.links.join(" | ").slice(0, 240)}`);
  if (f.extra) lines.push(`Other facts (delivery, policies, anything else the shop wrote): ${f.extra.slice(0, 900)}`);
  if (!lines.length) return "";
  return lines.join("\n").slice(0, 1800);
}
