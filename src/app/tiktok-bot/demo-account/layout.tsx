"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Users, Video, MessageSquare, Upload, History,
  Megaphone, Layers, Image as ImageIcon, BarChart3, RotateCcw, ArrowLeft, ArrowRight, Menu, X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useLang } from "@/hooks/useLang";
import { useTikTokDemo } from "@/hooks/useTikTokDemo";
import { DemoBadge, Button } from "@/components/tiktok-demo/DemoKit";
import LangToggle from "@/components/LangToggle";

/**
 * Shell for the TikTok Accounts API prototype: sidebar navigation, the demo indicator and the
 * demo reset control. Everything inside is mock data — no production route is called.
 */
export default function DemoAccountLayout({ children }: { children: ReactNode }) {
  const { t, rtl } = useLang();
  const pathname = usePathname();
  const router = useRouter();
  const { resetDemo } = useTikTokDemo();
  const [menuOpen, setMenuOpen] = useState(false);
  const Back = rtl ? ArrowRight : ArrowLeft;

  const base = "/tiktok-bot/demo-account";
  const accountsNav = [
    { href: base, icon: LayoutDashboard, ar: "لوحة الحساب", en: "Dashboard" },
    { href: "/tiktok-bot", icon: Users, ar: "الحسابات", en: "Accounts" },
    { href: `${base}/videos`, icon: Video, ar: "الفيديوهات", en: "Videos" },
    { href: `${base}/comments`, icon: MessageSquare, ar: "التعليقات", en: "Comments" },
    { href: `${base}/publish`, icon: Upload, ar: "نشر المحتوى", en: "Publish" },
    { href: `${base}/publish#history`, icon: History, ar: "سجل النشر", en: "Publishing History" },
  ];

  // Ads section: shown for orientation only. These are NOT implemented in this prototype and
  // the existing Ads backend is untouched, so the entries are disabled rather than linked.
  const adsNav = [
    { icon: Megaphone, ar: "الحملات", en: "Campaigns" },
    { icon: Layers, ar: "المجموعات الإعلانية", en: "Ad Groups" },
    { icon: ImageIcon, ar: "الإعلانات", en: "Ads" },
    { icon: BarChart3, ar: "التقارير", en: "Reports" },
  ];

  function reset() {
    resetDemo();
    router.push("/tiktok");
  }

  const nav = (
    <nav className="flex flex-col gap-1" aria-label={t("تنقل TikTok", "TikTok navigation")}>
      <div className="px-3 pb-1 pt-2 text-[10px] font-black uppercase tracking-wider text-[var(--muted-2)]">
        TikTok
      </div>
      {accountsNav.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href + item.en}
            href={item.href}
            onClick={() => setMenuOpen(false)}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400 ${
              active
                ? "bg-gradient-to-r from-purple-600/25 to-blue-600/20 text-[var(--text)] ring-1 ring-purple-400/30"
                : "text-[var(--muted)] hover:bg-white/5 hover:text-[var(--text)]"
            }`}
          >
            <Icon size={16} aria-hidden="true" />
            <span className="flex-1">{t(item.ar, item.en)}</span>
          </Link>
        );
      })}

      <div className="px-3 pb-1 pt-4 text-[10px] font-black uppercase tracking-wider text-[var(--muted-2)]">
        {t("إعلانات TikTok", "TikTok Ads")}
      </div>
      {adsNav.map((item) => {
        const Icon = item.icon;
        return (
          <span
            key={item.en}
            aria-disabled="true"
            title={t("غير مُفعّل في هذا النموذج", "Not part of this prototype")}
            className="flex cursor-not-allowed items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--muted-2)] opacity-60"
          >
            <Icon size={16} aria-hidden="true" />
            <span className="flex-1">{t(item.ar, item.en)}</span>
            <span className="text-[10px]">{t("قريباً", "Soon")}</span>
          </span>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]" dir={rtl ? "rtl" : "ltr"}>
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--border)] bg-[var(--glass)] px-4 py-3 backdrop-blur">
        <button
          className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-white/5 lg:hidden"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={t("القائمة", "Menu")}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        <Link
          href="/tiktok"
          className="flex items-center gap-2 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--text)]"
        >
          <Back size={16} aria-hidden="true" />
          <span className="hidden sm:inline">{t("أدوات TikTok", "TikTok Tools")}</span>
        </Link>

        <div className="ms-auto flex items-center gap-2">
          <DemoBadge
            label={t("نموذج أولي", "Prototype / Demo")}
            hint={t(
              "هذه الواجهة توضّح سير عمل TikTok Accounts API المخطط له باستخدام بيانات تجريبية.",
              "This interface demonstrates the planned TikTok Accounts API workflow using demo data.",
            )}
          />
          <Button variant="ghost" onClick={reset} ariaLabel={t("إعادة ضبط النموذج", "Reset demo")} className="!px-3 !py-2">
            <RotateCcw size={14} aria-hidden="true" />
            <span className="hidden sm:inline">{t("إعادة ضبط", "Reset Demo")}</span>
          </Button>
          <LangToggle />
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-20 rounded-2xl border border-[var(--border)] bg-[var(--glass)] p-2 backdrop-blur">
            {nav}
          </div>
        </aside>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button className="absolute inset-0 bg-black/60" aria-label={t("إغلاق", "Close")} onClick={() => setMenuOpen(false)} />
            <div className="absolute inset-y-0 start-0 w-72 overflow-y-auto border-e border-[var(--border)] bg-[var(--surface)] p-3">
              {nav}
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
