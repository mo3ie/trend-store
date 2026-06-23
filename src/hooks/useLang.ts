"use client";

import { useEffect, useState } from "react";

// Shared store language (AR default). Persists to localStorage and broadcasts a
// window event so every component using this hook updates in sync — so the
// toggle works the same on any page.
export function useLang() {
  const [lang, setLangState] = useState<"ar" | "en">("ar");

  useEffect(() => {
    try { if (localStorage.getItem("store-lang") === "en") setLangState("en"); } catch {}
    const handler = (e: Event) => setLangState((e as CustomEvent).detail as "ar" | "en");
    window.addEventListener("store-lang-change", handler);
    return () => window.removeEventListener("store-lang-change", handler);
  }, []);

  const setLang = (l: "ar" | "en") => {
    setLangState(l);
    try { localStorage.setItem("store-lang", l); } catch {}
    window.dispatchEvent(new CustomEvent("store-lang-change", { detail: l }));
  };

  const toggle = () => setLang(lang === "ar" ? "en" : "ar");
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  return { lang, setLang, toggle, t, rtl: lang === "ar" };
}
