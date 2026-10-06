/**
 * The TikTok area's visual language: the black stage + the chromatic split.
 *
 * The Facebook tools are built on gradient fills (purple → magenta → orange). This
 * area deliberately has **no gradient fills at all**, because the brief was that the
 * TikTok tools must not read as a second copy of the Facebook ones. Its signature is
 * two things instead:
 *
 *   1. A black 9:16 **stage** that stays black in both themes. Video is the content
 *      here, and a black vertical frame reads as "phone" instantly.
 *   2. TikTok's **chromatic offset** — pink and cyan as hard, unblurred, offset edges,
 *      never blended into each other. A pink-to-cyan gradient reads as generic neon;
 *      the offset is the actual logo mechanic.
 *
 * Readability is the reason the inks are split from the brand hues. Raw cyan
 * (#00f2ea) on a light background is about 1.5:1 contrast — unreadable — so on light
 * it may only ever be an edge, a ring or a shadow, and text uses `cyanInk`.
 */

export const TT_PINK = "#ff0050";
export const TT_CYAN = "#00f2ea";

export interface TikTokPalette {
  bg: string;
  surface: string;
  /** Inputs and rows — one step in from `surface`. */
  surface2: string;
  border: string;
  text: string;
  muted: string;
  /** Video cards and previews. Black in BOTH themes: it is the stage, not a surface. */
  stage: string;
  /** Pink for text and icons sitting on a surface (darkened on light for contrast). */
  pinkInk: string;
  /** Cyan for TEXT on a surface. Never the raw brand cyan on light. */
  cyanInk: string;
  /** Card elevation. Dark uses none; light needs a hairline lift. */
  cardShadow: string;
  danger: string;
  ok: string;
  warn: string;
}

export function tt(light: boolean): TikTokPalette {
  return light
    ? {
        bg: "#f6f7f9",          // neutral, not a pinkish tint: the brand supplies the colour
        surface: "#ffffff",
        surface2: "#eef0f4",
        border: "#e3e5ea",
        text: "#0f0f14",
        muted: "#5b5d6b",
        stage: "#000000",
        pinkInk: "#d10047",
        cyanInk: "#00807b",
        cardShadow: "0 1px 2px rgba(15,15,20,.06)",
        danger: "#c81e1e",
        ok: "#15803d",
        warn: "#b45309",
      }
    : {
        bg: "#0a0a0f",
        surface: "#14141c",
        surface2: "#1c1c27",
        border: "rgba(255,255,255,.08)",
        text: "#f5f5f7",
        muted: "#9a9aab",
        stage: "#000000",
        pinkInk: TT_PINK,
        cyanInk: TT_CYAN,
        cardShadow: "none",
        danger: "#f87171",
        ok: "#4ade80",
        warn: "#fbbf24",
      };
}

/**
 * The primary button — solid pink with a hard, unblurred cyan offset shadow.
 *
 * This single button carries the whole brand, which is why nothing else in the area
 * is decorated. The offset mirrors in RTL so the shadow always falls away from the
 * reading direction.
 */
export function ttPrimary(rtl: boolean, disabled = false): React.CSSProperties {
  return {
    background: disabled ? "#8a8a95" : TT_PINK,
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "12px 20px",
    fontSize: 15,
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : `${rtl ? "-3px" : "3px"} 3px 0 ${TT_CYAN}`,
    transition: "transform .08s, box-shadow .08s",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  };
}

export function ttSecondary(c: TikTokPalette): React.CSSProperties {
  return {
    background: "transparent",
    color: c.text,
    border: `1.5px solid ${c.border}`,
    borderRadius: 10,
    padding: "11px 18px",
    fontSize: 14.5,
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  };
}

/** Card surface. Radius 14 — squarer than the Facebook area's rounded-2xl. */
export function ttCard(c: TikTokPalette): React.CSSProperties {
  return {
    background: c.surface,
    border: `1px solid ${c.border}`,
    borderRadius: 14,
    boxShadow: c.cardShadow,
  };
}

/**
 * A 9:16 video stage. Always black, with a bottom-to-top scrim so overlay text reads
 * over any thumbnail — including a bright one.
 */
export function ttStage(): React.CSSProperties {
  return {
    background: "#000",
    borderRadius: 12,
    aspectRatio: "9 / 16",
    position: "relative",
    overflow: "hidden",
  };
}

export const TT_SCRIM = "linear-gradient(to top, rgba(0,0,0,.75), transparent 55%)";

/** On-stage caption text: TikTok's own on-screen-text look. */
export const ttOverlayText: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#fff",
  textShadow: "0 1px 2px #000",
  lineHeight: 1.45,
};

export function ttInput(c: TikTokPalette): React.CSSProperties {
  return {
    width: "100%",
    background: c.surface2,
    border: `1px solid ${c.border}`,
    borderRadius: 10,
    padding: "11px 13px",
    color: c.text,
    fontSize: 14,
    fontFamily: "inherit",
    boxSizing: "border-box",
  };
}

/** Hero numbers — views, spend, dinars. Tabular so columns of figures line up. */
export const ttHeroNum: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  fontVariantNumeric: "tabular-nums",
  lineHeight: 1.1,
};

/**
 * The screen-title accent: a 3px pink bar with a cyan bar offset 2px behind it. Used
 * on screen titles ONLY — on every card it becomes wallpaper and stops meaning
 * anything.
 */
export function ttTitleAccent(rtl: boolean): React.CSSProperties {
  return {
    position: "relative",
    [rtl ? "paddingRight" : "paddingLeft"]: 13,
    backgroundImage: `linear-gradient(${TT_PINK}, ${TT_PINK}), linear-gradient(${TT_CYAN}, ${TT_CYAN})`,
    backgroundSize: "3px 100%, 3px 100%",
    backgroundRepeat: "no-repeat, no-repeat",
    backgroundPosition: rtl
      ? "right center, calc(100% - 5px) center"
      : "left center, 5px center",
  } as React.CSSProperties;
}

/** TikTok caps a comment at 150 characters — not Facebook's limit. */
export const TT_COMMENT_MAX = 150;

/** TikTok caps the ad text at 100 characters. */
export const TT_AD_TEXT_MAX = 100;
