"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sun, Moon } from "lucide-react";

/**
 * Floating dark/light toggle. The actual class is applied pre-paint by the
 * inline script in layout.tsx (no flash); this just flips it + persists.
 */
// The Facebook-tools screens carry their own theme button in FbHeader; the floating one
// there was a second copy of the same button and sat on top of the content on phones.
const OWN_TOGGLE = /^\/(facebook|ads|bot|studio|subscriptions)(\/|$)/;

export default function ThemeToggle() {
  const [light, setLight] = useState(false);
  const pathname = usePathname() || "/";

  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
  }, []);

  const toggle = () => {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle("light", next);
    try { localStorage.setItem("theme", next ? "light" : "dark"); } catch {}
  };

  if (OWN_TOGGLE.test(pathname)) return null;

  return (
    <button
      onClick={toggle}
      aria-label={light ? "تفعيل الوضع الداكن" : "تفعيل الوضع الفاتح"}
      title={light ? "الوضع الداكن" : "الوضع الفاتح"}
      className="theme-fab fixed left-4 bottom-24 md:bottom-6 z-[55] w-11 h-11 rounded-full flex items-center justify-center border border-purple-500/30 bg-[var(--surface-glass)] light:border-purple-300 backdrop-blur shadow-lg hover:scale-105 transition-transform"
    >
      {light
        ? <Moon size={18} className="text-purple-600" />
        : <Sun size={18} className="text-amber-300" />}
    </button>
  );
}
