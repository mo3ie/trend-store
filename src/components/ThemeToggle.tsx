"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

/**
 * Floating dark/light toggle. The actual class is applied pre-paint by the
 * inline script in layout.tsx (no flash); this just flips it + persists.
 */
export default function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
  }, []);

  const toggle = () => {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle("light", next);
    try { localStorage.setItem("theme", next ? "light" : "dark"); } catch {}
  };

  return (
    <button
      onClick={toggle}
      aria-label={light ? "تفعيل الوضع الداكن" : "تفعيل الوضع الفاتح"}
      title={light ? "الوضع الداكن" : "الوضع الفاتح"}
      className="fixed bottom-5 left-5 z-50 w-11 h-11 rounded-full flex items-center justify-center border border-purple-500/30 bg-[#0f1320]/80 light:bg-white/90 light:border-purple-300 backdrop-blur shadow-lg hover:scale-105 transition-transform"
    >
      {light
        ? <Moon size={18} className="text-purple-600" />
        : <Sun size={18} className="text-amber-300" />}
    </button>
  );
}
