"use client";

import { useEffect, useState } from "react";

// Reflects the app's dark/light mode for components that style with inline JS
// objects (the /ads flow) rather than Tailwind `light:` classes. The `.light`
// class lives on <html> (set pre-paint by layout.tsx, flipped by ThemeToggle);
// we mirror it and re-render on any change via a MutationObserver.
export function useTheme() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    const el = document.documentElement;
    const read = () => setLight(el.classList.contains("light"));
    read();
    const obs = new MutationObserver(read);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return { light, dark: !light };
}
