/**
 * Colour palette for the bot screens.
 *
 * `/bot` and `/bot/[pageId]` were written with hard-coded dark values — a fixed
 * gradient, `#fff` text, `rgba(255,255,255,…)` surfaces. The global theme toggle
 * sits on every page, so pressing it there flipped the `.light` class and changed
 * nothing: the button worked, the screen did not. This gives both files one
 * palette that follows the theme, the same way the /ads and /studio screens do.
 */
export interface BotColors {
  gradient: string;
  text: string;
  muted: string;
  dim: string;
  card: string;
  surface: string;
  border: string;
  borderSoft: string;
  input: string;
  menu: string;
  toast: string;
  shadow: string;
}

export function botColors(light: boolean): BotColors {
  return light
    ? {
        gradient:   "linear-gradient(135deg, #f4f6fb 0%, #e9eefb 100%)",
        text:       "#16131f",
        muted:      "#5b6472",
        dim:        "#8b93a1",
        card:       "rgba(255,255,255,0.92)",
        surface:    "rgba(15,19,32,0.04)",
        border:     "rgba(15,19,32,0.12)",
        borderSoft: "rgba(15,19,32,0.07)",
        input:      "rgba(15,19,32,0.03)",
        menu:       "#ffffff",
        toast:      "#ffffff",
        shadow:     "0 8px 30px rgba(15,19,32,0.15)",
      }
    : {
        gradient:   "linear-gradient(135deg, #0f0f1a 0%, #0d1b2a 100%)",
        text:       "#ffffff",
        muted:      "#94a3b8",
        dim:        "#64748b",
        card:       "rgba(255,255,255,0.04)",
        surface:    "rgba(255,255,255,0.06)",
        border:     "rgba(255,255,255,0.1)",
        borderSoft: "rgba(255,255,255,0.06)",
        input:      "rgba(255,255,255,0.06)",
        menu:       "#111827",
        toast:      "#1e293b",
        shadow:     "0 8px 30px rgba(0,0,0,0.5)",
      };
}
