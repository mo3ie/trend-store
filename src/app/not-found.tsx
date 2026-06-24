"use client";

import Link from "next/link";
import { Home, Search } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import LangToggle from "@/components/LangToggle";

export default function NotFound() {
  const { t, rtl } = useLang();

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-4 relative overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      <div className="absolute top-5 end-5"><LangToggle /></div>
      <div className="fixed top-[-100px] left-[-100px] w-[400px] h-[400px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-100px] right-[-100px] w-[400px] h-[400px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="text-center relative">
        <h1 className="text-[110px] leading-none font-black bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          404
        </h1>
        <p className="text-[var(--text)] text-xl font-bold mb-2">{t("الصفحة غير موجودة", "Page not found")}</p>
        <p className="text-[var(--muted-2)] text-sm mb-8 max-w-sm mx-auto">
          {t("ربما حُذف هذا الرابط أو تغيّر عنوانه. لنعدك إلى المسار الصحيح.", "This link may have been removed or moved. Let's get you back on track.")}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-500 hover:shadow-[0_0_24px_rgba(168,85,247,0.5)] transition-all"
          >
            <Home size={18} />
            {t("الرئيسية", "Home")}
          </Link>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-purple-300 border border-purple-500/30 hover:bg-purple-500/10 transition-all"
          >
            <Search size={18} />
            {t("تصفّح المنتجات", "Browse products")}
          </Link>
        </div>
      </div>
    </div>
  );
}
