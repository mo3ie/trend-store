"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Home, Smartphone, ShoppingCart, Package, User } from "lucide-react";
import { isGlassPath } from "@/lib/uiGlass";

const CART_KEY = "trend_cart";

function cartCount(): number {
  try {
    const items = JSON.parse(localStorage.getItem(CART_KEY) || "[]") as { quantity?: number }[];
    return items.reduce((n, i) => n + (Number(i.quantity) || 1), 0);
  } catch {
    return 0;
  }
}

/**
 * TREND Glass mobile bottom bar for every store page except the homepage
 * (which has its own). Phones only — hidden above 880px by CSS. Adds
 * `has-gnav` on <html> so pages get bottom padding and nothing hides under it.
 */
export default function GlassNav() {
  const pathname = usePathname() || "/";
  const show = isGlassPath(pathname) && pathname !== "/";
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sync = () => setCount(cartCount());
    sync();
    window.addEventListener("trend:add", sync);
    window.addEventListener("trend:cart", sync); // any cart write (qty change, remove, clear)
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("trend:add", sync);
      window.removeEventListener("trend:cart", sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, [pathname]);

  useEffect(() => {
    document.documentElement.classList.toggle("has-gnav", show);
  }, [show]);

  if (!show) return null;

  const tabs = [
    { href: "/", label: "الرئيسية", Icon: Home, on: false },
    { href: "/products", label: "المتجر", Icon: Smartphone, on: pathname.startsWith("/products") },
    { href: "/cart", label: "السلة", Icon: ShoppingCart, on: pathname.startsWith("/cart"), badge: count },
    { href: "/orders", label: "طلباتي", Icon: Package, on: pathname.startsWith("/orders") },
    { href: "/account", label: "حسابي", Icon: User, on: pathname.startsWith("/account") },
  ];

  return (
    <nav className="g-bnav" aria-label="التنقل">
      {tabs.map(({ href, label, Icon, on, badge }) => (
        <a key={href} href={href} className={on ? "on" : undefined} aria-current={on ? "page" : undefined} {...(href === "/cart" ? { "data-cart-icon": "" } : {})}>
          <span className="ic">
            <Icon size={21} strokeWidth={1.8} />
            {badge ? <i>{badge > 9 ? "9+" : badge}</i> : null}
          </span>
          <span>{label}</span>
        </a>
      ))}
    </nav>
  );
}
