import sharp from "sharp";
import QRCode from "qrcode";
import opentype from "opentype.js";
import { CARD_FONT_B64 } from "@/assets/fonts/cardFont";

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

/*
 * Parsed once per process, not per card. Parsing is ~1ms and a busy video can
 * mint dozens of cards a minute; there is no reason to pay it each time.
 */
let FONT: opentype.Font | null = null;
function font(): opentype.Font {
  if (!FONT) {
    const bytes = Buffer.from(CARD_FONT_B64, "base64");
    FONT = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));
  }
  return FONT;
}

/**
 * One line of text, as <path> data rather than <text>.
 *
 * This is the whole fix for the empty-box card: a path carries its own shape, so
 * the renderer needs no font, no fontconfig and no system font directory. Nothing
 * is left that can be absent.
 *
 * `letterSpacing` is applied by drawing glyph by glyph, because opentype's
 * getPath has no notion of tracking and the five-character code wants air
 * between its letters to be read off a phone at a glance.
 */
function textPath(
  text: string, x: number, y: number, size: number, fill: string, letterSpacing = 0,
): string {
  const f = font();
  if (!letterSpacing) {
    const d = f.getPath(text, x, y, size).toPathData(2);
    return d ? `<path d="${d}" fill="${fill}"/>` : "";
  }
  let cursor = x;
  const parts: string[] = [];
  for (const ch of text) {
    const d = f.getPath(ch, cursor, y, size).toPathData(2);
    if (d) parts.push(`<path d="${d}" fill="${fill}"/>`);
    cursor += f.getAdvanceWidth(ch, size) + letterSpacing;
  }
  return parts.join("");
}

/** Width of a line as it will actually be drawn, for fitting and centring. */
function textWidth(text: string, size: number, letterSpacing = 0): number {
  const w = font().getAdvanceWidth(text, size);
  return w + Math.max(0, [...text].length - 1) * letterSpacing;
}

/** Largest size at or below `max` that fits `maxWidth`. Long shop names shrink. */
function fitSize(text: string, max: number, maxWidth: number, letterSpacing = 0): number {
  let size = max;
  while (size > 8 && textWidth(text, size, letterSpacing) > maxWidth) size -= 2;
  return size;
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
     * Every line is drawn as paths — see textPath. There is no font-family
     * anywhere in this document on purpose: the previous version named a stack
     * five deep and every single one was missing on the render host.
     *
     * The code is sized to FIT rather than fixed at 190px. A six-character code
     * at a fixed size silently overran the card's right edge and sat under the
     * QR; letting it shrink means the card cannot be broken by its own content.
     */
    const PAD = 90;
    const INNER = W - PAD * 2;
    const codeSpacing = 14;
    const codeSize = fitSize(code, 190, INNER - 40, codeSpacing);
    const brandSize = brand ? fitSize(brand, 46, INNER) : 0;
    const domainSize = fitSize(domain, 46, INNER);

    const yBrand = 190;
    const yLabel = brand ? 262 : 210;
    const yCode = (brand ? 470 : 430) - (190 - codeSize) * 0.35;
    const yRule = yCode + 52;
    const yAt = yRule + 86;
    const yDomain = yAt + 66;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect x="48" y="48" width="${W - 96}" height="${H - 96}" rx="48" fill="${CARD}" stroke="${BORDER}" stroke-width="3"/>
  <rect x="48" y="48" width="${W - 96}" height="14" rx="7" fill="${ACCENT}"/>
  ${brand ? textPath(brand, PAD, yBrand, brandSize, TEXT) : ""}
  ${textPath("YOUR CODE", PAD, yLabel, 38, MUTED)}
  ${textPath(code, PAD, yCode, codeSize, TEXT, codeSpacing)}
  <rect x="${PAD}" y="${yRule}" width="${INNER}" height="2" fill="${BORDER}"/>
  ${textPath("Enter it at", PAD, yAt, 40, MUTED)}
  ${textPath(domain, PAD, yDomain, domainSize, ACCENT)}
  <rect x="${W - qrSize - 138}" y="${H - qrSize - 138}" width="${qrSize + 96}" height="${qrSize + 96}" rx="28" fill="#ffffff"/>
  ${qr}
  ${textPath("or scan the code", PAD, H - 110, 32, MUTED)}
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
 * The global kill switch for comment images. ON unless explicitly turned off.
 *
 * It shipped the other way round — off until `TIKTOK_COMMENT_IMAGE=on` was set —
 * mirroring the DM feature's two switches. That was the wrong copy. The DM switch
 * guards something that cannot be taken back: a message sent to a stranger. This
 * guards an image upload whose only failure mode is that TikTok refuses it and
 * the reply goes out as the text it would have been anyway.
 *
 * So the second gate bought nothing and cost a trip to the environment variables
 * before the merchant could even see the feature. And it did not really buy
 * "stoppable without a deploy" either: `bot_configs.reply_image` is a toggle on
 * the merchant's own screen and takes effect on the next comment.
 *
 * Set TIKTOK_COMMENT_IMAGE=off to stop it for every account at once — which is
 * what a global switch is actually for.
 */
export function commentImagesArmed(): boolean {
  const v = (process.env.TIKTOK_COMMENT_IMAGE || "").trim().toLowerCase();
  return !(v === "off" || v === "0" || v === "false");
}
