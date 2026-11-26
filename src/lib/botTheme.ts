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
  // Same palette as every «أدوات فيسبوك» screen (src/lib/fbTheme.ts).
  return light
    ? {
        gradient:   "#F6F8FC",
        text:       "#111827",
        muted:      "#64748B",
        dim:        "#6b7a90",
        card:       "#FFFFFF",
        surface:    "#F1F4FA",
        border:     "#E8ECF4",
        borderSoft: "#EEF1F6",
        input:      "#F1F4FA",
        menu:       "#FFFFFF",
        toast:      "#FFFFFF",
        shadow:     "0 1px 2px rgba(17,24,39,.04), 0 8px 24px -18px rgba(17,24,39,.18)",
      }
    : {
        gradient:   "#0B1120",
        text:       "#F8FAFC",
        muted:      "#A0AEC0",
        dim:        "#8391a7",
        card:       "#111827",
        surface:    "#1A2436",
        border:     "#263247",
        borderSoft: "#1d2738",
        input:      "#1A2436",
        menu:       "#111827",
        toast:      "#1A2436",
        shadow:     "0 8px 30px rgba(0,0,0,0.5)",
      };
}
