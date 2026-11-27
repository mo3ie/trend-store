import { discountPct } from "@/lib/sale";

/**
 * The struck-through "before" price + a "-30%" badge. Renders nothing unless
 * old_price is a real before-price (higher than the current price), so it can be
 * dropped next to any existing price without changing how normal products look.
 */
export default function OldPrice({ price, oldPrice, unit, size = "sm" }: { price: number; oldPrice?: number | null; unit?: string; size?: "sm" | "lg" }) {
  const pct = discountPct(price, oldPrice);
  if (!pct) return null;
  const fs = size === "lg" ? 16 : 12;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap", lineHeight: 1.2 }}>
      <s style={{ color: "var(--muted, #8a94a6)", fontSize: fs, fontWeight: 600, textDecorationThickness: 1.5, textDecorationColor: "#ef4444" }}>
        {Number(oldPrice)}{unit ? ` ${unit}` : ""}
      </s>
      <span style={{ background: "#ef4444", color: "#fff", fontSize: fs - 1, fontWeight: 800, padding: size === "lg" ? "3px 9px" : "1px 6px", borderRadius: 7, direction: "ltr" }}>-{pct}%</span>
    </span>
  );
}
