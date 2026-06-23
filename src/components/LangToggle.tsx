"use client";

import { useLang } from "@/hooks/useLang";

/** Small AR/EN toggle button, themed, reusable on any store page. */
export default function LangToggle({ className = "" }: { className?: string }) {
  const { lang, toggle } = useLang();
  return (
    <button
      onClick={toggle}
      aria-label="language"
      className={`w-10 h-10 rounded-xl flex items-center justify-center border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-bold text-xs hover:border-purple-500 transition-colors ${className}`}
    >
      {lang === "ar" ? "EN" : "ع"}
    </button>
  );
}
