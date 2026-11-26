import sharp from "sharp";
import QRCode from "qrcode";

/**
 * The picture the bot posts under a comment: the code, big, and a QR beside it.
 *
 * ## Why a picture at all
 *
 * A TikTok comment is 150 characters of plain text, and a URL inside one is dead
 * — no tap target, on any account. So the code has to be read by a human eye off
 * a crowded comment list, on a phone, in a column of other people's replies, and
 * then retyped. Plain text loses that fight. A card wins it: it is the only thing
 * in the thread that is not grey text, so the person who asked finds their own
 * answer instantly, and the people scrolling past see the shop's name.
 *
 * ## What is deliberately NOT on it
 *
 * The price. The card is as public as the comment it hangs under — anyone
 * scrolling can read it, screenshot it, repost it. Putting the price on the card
 * would hand it to exactly the audience the whole mechanic exists to withhold it
 * from. The card carries the KEY, never what the key opens.
 *
 * ## Why there is no Arabic on it
 *
 * Arabic needs shaping and a font that has the glyphs. This renders through
 * librsvg inside sharp, on a serverless Linux image whose font set we do not
 * control, and the failure mode is not an error — it is a card full of empty
 * boxes, posted publicly, under the merchant's video, where they find out from a
 * customer. Latin letters, digits and the shop's domain survive any font.
 *
 * The Arabic instruction is not lost: it rides in the reply's `text` field, which
 * TikTok renders with its own fonts, right beside the image. Each half does what
 * it is good at.
 *
 * ## The QR
 *
 * It encodes the one-off link itself, so it inherits that link's limits: one
 * open, 24 hours, a different code for every customer. Scanning it and typing the
 * code lead to the same page and burn the same single open.
 *
 * It is the SECOND path, not the first, and the layout says so — the code is
 * huge, the QR is a corner tile. A customer watching TikTok on their phone cannot
 * photograph their own screen; for them the QR is useless and the code is
 * everything. The QR earns its space for the other cases: someone watching on a
 * desktop or a TV, or showing the video to the person standing next to them.
 */

const W = 1080;
const H = 1080;

/** Matches /r and the storefront, so the card and the page it opens look related. */
const BG = "#0b0f1a";
const CARD = "#141a2b";
const BORDER = "#242c42";
const TEXT = "#f2f4f8";
const MUTED = "#98a0b8";
const ACCENT = "#fe2c55";

/**
 * Escapes the five XML characters. Every string here comes from the merchant's
 * own settings, and an unescaped `&` in a shop name produces not a wrong card but
 * an invalid document that sharp refuses outright.
 */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/**
 * Keeps only what a font we cannot choose is certain to have.
 *
 * The brand name is the risk: it is typed by the merchant and is very often
 * Arabic. Rather than render boxes, anything outside the Latin range is dropped,
 * and a name that disappears entirely leaves the slot empty — the card still
 * works, because the code and the domain are what the customer needs.
 */
function latinOnly(s: string, max: number): string {
  return (s || "").replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * The QR as a nested <svg>, so it keeps its own coordinate system and we do not
 * have to rescale every module by hand.
 *
 * Error correction M, not L: this gets photographed off a screen at an angle, and
 * the extra redundancy costs a few modules of density against a scan that fails.
 */
async function qrFragment(url: string, x: number, y: number, size: number): Promise<string> {
  const svg = await QRCode.toString(url, {
    type: "svg", errorCorrectionLevel: "M", margin: 0, color: { dark: "#000000", light: "#ffffff" },
  });
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1] || "0 0 33 33";
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${viewBox}">${inner}</svg>`;
}

export interface CodeCardInput {
  /** The five-character token — the thing the customer types. */
  code: string;
  /** The full one-off URL the QR encodes. */
  url: string;
  /** Shown under the code so the customer knows where to type it. */
  domainLabel: string;
  /** The shop's name, if it survives `latinOnly`. */
  brand?: string | null;
}

/**
 * Renders the card to PNG bytes.
 *
 * Returns null instead of throwing. Nothing about this feature is worth losing a
 * reply over: every caller falls back to the text-only comment, which is the
 * behaviour that shipped before the card existed and is still a complete answer.
 */
export async function renderCodeCard(input: CodeCardInput): Promise<Uint8Array | null> {
  try {
    const code = (input.code || "").toUpperCase().slice(0, 8);
    if (!code) return null;

    const brand = latinOnly(input.brand || "", 28);
    const domain = latinOnly(input.domainLabel || "", 40);
    const qrSize = 300;
    const qr = await qrFragment(input.url, W - qrSize - 90, H - qrSize - 90, qrSize);

    /*
     * Font stack, widest-net first. DejaVu ships with practically every Linux
     * image; Liberation and Arial cover the rest; the generic families are the
     * floor. No webfont is referenced: librsvg would have to fetch it, and a
     * network call inside image rendering is a failure waiting for a bad day.
     */
    const mono = "DejaVu Sans Mono, Liberation Mono, Courier New, monospace";
    const sans = "DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif";

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect x="48" y="48" width="${W - 96}" height="${H - 96}" rx="48" fill="${CARD}" stroke="${BORDER}" stroke-width="3"/>
  <rect x="48" y="48" width="${W - 96}" height="14" rx="7" fill="${ACCENT}"/>
  ${brand ? `<text x="90" y="190" font-family="${sans}" font-size="46" font-weight="bold" fill="${TEXT}">${esc(brand)}</text>` : ""}
  <text x="90" y="${brand ? 262 : 210}" font-family="${sans}" font-size="38" fill="${MUTED}">YOUR CODE</text>
  <text x="90" y="${brand ? 470 : 430}" font-family="${mono}" font-size="190" font-weight="bold" fill="${TEXT}" letter-spacing="14">${esc(code)}</text>
  <rect x="90" y="${brand ? 520 : 480}" width="${W - 180}" height="2" fill="${BORDER}"/>
  <text x="90" y="${brand ? 606 : 566}" font-family="${sans}" font-size="40" fill="${MUTED}">Enter it at</text>
  <text x="90" y="${brand ? 672 : 632}" font-family="${sans}" font-size="46" font-weight="bold" fill="${ACCENT}">${esc(domain)}</text>
  <rect x="${W - qrSize - 138}" y="${H - qrSize - 138}" width="${qrSize + 96}" height="${qrSize + 96}" rx="28" fill="#ffffff"/>
  ${qr}
  <text x="90" y="${H - 110}" font-family="${sans}" font-size="32" fill="${MUTED}">or scan →</text>
</svg>`;

    const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
    // The 5 MB ceiling is TikTok's. A flat-colour card is ~40 KB, so this only
    // ever fires if something upstream has gone badly wrong.
    if (png.byteLength > 5 * 1024 * 1024) return null;
    return new Uint8Array(png);
  } catch {
    return null;
  }
}

/**
 * The global arm for comment images.
 *
 * The per-merchant `bot_configs.reply_image` is the other half, and both must be
 * on. Two switches, for the same reason the DM feature has two: the scope this
 * upload needs is undocumented, so the first real traffic is an experiment, and
 * an experiment must be stoppable from the environment without a deploy and
 * without touching anyone's settings.
 */
export function commentImagesArmed(): boolean {
  const v = (process.env.TIKTOK_COMMENT_IMAGE || "").trim().toLowerCase();
  return v === "on" || v === "1" || v === "true";
}
