"use client";

import { useState } from "react";

/**
 * The order button, and the reason it is a client component.
 *
 * It used to be `<a href="/api/r/{token}/wa">` — one server hop that recorded the
 * click and then redirected to wa.me. The hop is worth having: it is the only
 * number in the funnel that means money, how many people who SAW the price went
 * on to ask for the product.
 *
 * But the customer arrives inside TikTok's in-app browser, and that browser
 * refuses to follow a redirect off our origin. The live result was a grey shield
 * and "TikTok can't open this page directly. Copy and paste the link into your
 * browser to continue" — the customer had the price, wanted to order, and was
 * handed a dead end at the last step.
 *
 * So the link now points STRAIGHT at wa.me, which the in-app browser handles,
 * and the tracking goes out alongside it as a beacon that cannot block or break
 * navigation. Measurement must never stand between a customer and a purchase.
 *
 * And because even a direct wa.me can be blocked in a locked-down webview, the
 * number is printed underneath with a copy button. Something on this screen
 * always works.
 */
export function OrderActions({
  token, waUrl, phone, c,
}: {
  token: string;
  waUrl: string;
  /** Plain digits, for the fallback that needs no app at all. */
  phone: string;
  c: { text: string; muted: string; border: string; wa: string; card: string };
}) {
  const [copied, setCopied] = useState("");

  function track() {
    // Fire-and-forget. `keepalive` lets it survive the page being replaced by
    // WhatsApp; a failure here is invisible and must stay that way.
    try {
      const url = `/api/r/${encodeURIComponent(token)}/wa?beacon=1`;
      if (navigator.sendBeacon) navigator.sendBeacon(url);
      else fetch(url, { method: "POST", keepalive: true }).catch(() => {});
    } catch { /* never block the order */ }
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard is blocked in some in-app browsers. The old trick still works.
      const el = document.createElement("textarea");
      el.value = value;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      try { document.execCommand("copy"); } catch { /* nothing left to try */ }
      document.body.removeChild(el);
    }
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  }

  return (
    <div style={{ marginTop: 16 }}>
      <a
        href={waUrl} target="_blank" rel="noopener noreferrer" onClick={track}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
          background: c.wa, color: "#06281a", textDecoration: "none",
          borderRadius: 12, padding: "15px 18px", fontSize: 16.5, fontWeight: 800,
        }}
      >
        <WhatsAppIcon /> اطلب الآن على واتساب
      </a>

      {/* The path that needs no app, no redirect and no permission. */}
      <button
        onClick={() => copy(phone, "رقم")}
        style={{
          width: "100%", marginTop: 9, background: "transparent",
          border: `1px solid ${c.border}`, borderRadius: 11, padding: "11px 14px",
          color: c.muted, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        <span style={{ direction: "ltr", fontWeight: 700, color: c.text }}>+{phone}</span>
        <span>{copied === "رقم" ? "نُسخ ✓" : "انسخ الرقم"}</span>
      </button>
    </div>
  );
}

/** Copy button for the price itself — people screenshot it, which loses the text. */
export function CopyPrice({ body, c }: { body: string; c: { muted: string; border: string } }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try { await navigator.clipboard.writeText(body); } catch { /* ignore */ }
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
      style={{
        background: "transparent", border: "none", color: c.muted, fontSize: 12,
        cursor: "pointer", fontFamily: "inherit", padding: "6px 2px", fontWeight: 700,
      }}
    >
      {done ? "نُسخ ✓" : "انسخ السعر"}
    </button>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.825 9.825 0 016.993 2.898 9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.889 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}
