import type React from "react";
/**
 * One visual language for every «أدوات فيسبوك» screen (/facebook, /ads/*, /bot/*,
 * /studio, /subscriptions) — the palette approved with the new hub on 2026-11-26.
 * Pages read colours from here instead of keeping their own copies, so the whole
 * area changes together. Copy on these screens is Modern Standard Arabic.
 */
export const FB_FONT = '"IBM Plex Sans Arabic", var(--font-plex), Cairo, Tahoma, sans-serif';

// Brand + per-tool gradients (blue → purple family; no pink/orange).
export const G_HERO   = "linear-gradient(135deg,#438DF5 0%,#6d7cf0 55%,#9367ED 100%)";
export const G_ADS    = "linear-gradient(135deg,#438DF5,#55B7F5)";
export const G_BOT    = "linear-gradient(135deg,#20BE83,#3cc7a6)";
export const G_STUDIO = "linear-gradient(135deg,#9367ED,#6d7cf0)";
export const G_BRAND  = G_HERO;
export const G_BLUE   = "linear-gradient(135deg,#55B7F5,#438DF5)";
export const G_PURPLE = "linear-gradient(135deg,#9367ED,#438DF5)";
export const G_AMBER  = "linear-gradient(135deg,#F2A74B,#EF6262)";
export const G_GREEN  = "linear-gradient(135deg,#20BE83,#55B7F5)";
export const G_META   = "linear-gradient(135deg,#438DF5,#55B7F5)";
export const G_GOLD   = "linear-gradient(135deg,#f0b429,#ff9d2f)";

export const BLUE = "#438DF5", GREEN = "#20BE83", PURPLE = "#9367ED", AMBER = "#F2A74B", RED = "#EF6262";

export type FbPalette = {
  bg: string; text: string; muted: string; dim: string; surface: string; border: string; inputBg: string; menuBg: string;
  soft: string; chipBlue: string; blueText: string; chipGreen: string; greenText: string; chipAmber: string; amberText: string; shadow: string;
};

export function fbPalette(light: boolean): FbPalette {
  return light
    ? { bg: "#F6F8FC", text: "#111827", muted: "#64748B", dim: "#6b7a90", surface: "#FFFFFF", border: "#E8ECF4", inputBg: "#F1F4FA", menuBg: "#FFFFFF",
        soft: "#F1F4FA", chipBlue: "#EEF4FE", blueText: "#2F6FD6", chipGreen: "#E6F8F1", greenText: "#13805a", chipAmber: "#FDF3E6", amberText: "#9a5a0c",
        shadow: "0 1px 2px rgba(17,24,39,.04), 0 8px 24px -18px rgba(17,24,39,.18)" }
    : { bg: "#0B1120", text: "#F8FAFC", muted: "#A0AEC0", dim: "#8391a7", surface: "#111827", border: "#263247", inputBg: "#1A2436", menuBg: "#111827",
        soft: "#1A2436", chipBlue: "rgba(67,141,245,.16)", blueText: "#8FBBFF", chipGreen: "rgba(32,190,131,.16)", greenText: "#5fe0ad", chipAmber: "rgba(242,167,75,.16)", amberText: "#f6c27f",
        shadow: "none" };
}

/** Accent of each tool, for selected states inside that tool's screens. */
export const ACCENT = {
  ads: { main: BLUE, bg: "rgba(67,141,245,0.12)" },
  bot: { main: GREEN, bg: "rgba(32,190,131,0.12)" },
  studio: { main: PURPLE, bg: "rgba(147,103,237,0.12)" },
} as const;

/** Buttons used in page heads and cards — same look on every screen. */
export const fbBtn = (grad: string = G_HERO): React.CSSProperties => ({
  height: 44, padding: "0 18px", borderRadius: 12, border: "none", background: grad, color: "#fff", fontFamily: FB_FONT,
  fontWeight: 700, fontSize: 14.5, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none",
});
export const fbBtnGhost = (p: FbPalette): React.CSSProperties => ({
  height: 44, padding: "0 16px", borderRadius: 12, border: `1px solid ${p.border}`, background: p.surface, color: p.text, fontFamily: FB_FONT,
  fontWeight: 600, fontSize: 14.5, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none",
});
