"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * One input, and it does the forgiving things a customer on a phone needs.
 *
 * They are copying five characters off a TikTok comment: they will include the
 * surrounding word, type lowercase, or paste the whole URL. All three work here,
 * because the alternative is a customer who cannot see a price they were sent
 * and a merchant who blames the tool.
 */

const C = {
  bg: "#0b0f1a", card: "#141a2b", border: "#242c42", text: "#f2f4f8",
  muted: "#98a0b8", accent: "#fe2c55",
};

/** Mirrors the mint alphabet: no 0/O/1/I/l, so those are never valid input. */
const ALLOWED = /[^23456789ABCDEFGHJKMNPQRSTUVWXYZ]/g;

export function CodeEntry() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  /**
   * Upper-cases first, so a lowercase paste survives, then drops anything that
   * is not in the alphabet -- which also strips a pasted `https://.../r/` prefix
   * down to just the token.
   */
  function clean(raw: string): string {
    return raw.toUpperCase().replace(ALLOWED, "").slice(0, 5);
  }

  function go(e: React.FormEvent) {
    e.preventDefault();
    const v = clean(code);
    if (v.length < 5) { setErr("الكود خمسة أحرف وأرقام"); return; }
    router.push(`/r/${v}`);
  }

  return (
    <div dir="rtl" style={{
      minHeight: "100dvh", background: C.bg, display: "flex", alignItems: "center",
      justifyContent: "center", padding: "24px 16px",
      fontFamily: "system-ui, -apple-system, 'Segoe UI', Tahoma, sans-serif",
    }}>
      <form onSubmit={go} style={{
        width: "100%", maxWidth: 400, background: C.card,
        border: `1px solid ${C.border}`, borderRadius: 18, padding: "26px 22px",
      }}>
        <div style={{ fontSize: 34, textAlign: "center", marginBottom: 10 }}>🔑</div>
        <div style={{ fontSize: 19, fontWeight: 800, color: C.text, textAlign: "center" }}>
          اكتب الكود لترى السعر
        </div>
        <div style={{ fontSize: 13.5, color: C.muted, textAlign: "center", lineHeight: 1.8, marginTop: 8 }}>
          الكود وصلك في ردّ على تعليقك — خمسة أحرف وأرقام
        </div>

        <input
          value={code}
          onChange={(e) => { setCode(clean(e.target.value)); setErr(""); }}
          autoFocus
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="A7K2M"
          aria-label="الكود"
          style={{
            width: "100%", boxSizing: "border-box", marginTop: 18,
            background: "#0f1424", border: `1.5px solid ${err ? C.accent : C.border}`,
            borderRadius: 13, padding: "16px 14px", color: C.text,
            fontSize: 30, fontWeight: 800, textAlign: "center",
            letterSpacing: "9px", direction: "ltr", fontFamily: "ui-monospace, monospace",
          }}
        />

        {err && (
          <div style={{ fontSize: 12.5, color: C.accent, textAlign: "center", marginTop: 9, fontWeight: 700 }}>
            {err}
          </div>
        )}

        <button type="submit" disabled={code.length < 5} style={{
          width: "100%", marginTop: 16, padding: "15px 0", borderRadius: 12, border: "none",
          background: code.length < 5 ? "#39415a" : C.accent,
          color: "#fff", fontSize: 16.5, fontWeight: 800, fontFamily: "inherit",
          cursor: code.length < 5 ? "not-allowed" : "pointer",
        }}>
          اعرض السعر
        </button>

        <div style={{ fontSize: 11.5, color: C.muted, textAlign: "center", marginTop: 14, lineHeight: 1.8 }}>
          لم يصلك كود؟ علّق على الفيديو وسيصلك خلال ثوانٍ.
        </div>
      </form>
    </div>
  );
}
