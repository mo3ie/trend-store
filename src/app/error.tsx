"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, Home } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import LangToggle from "@/components/LangToggle";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t, rtl } = useLang();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-4 relative overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      <div className="absolute top-5 end-5"><LangToggle /></div>
      <div className="fixed top-[-100px] left-[-100px] w-[400px] h-[400px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-100px] right-[-100px] w-[400px] h-[400px] bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="text-center relative max-w-sm">
        <div className="text-6xl mb-4">⚠️</div>
        <p className="text-[var(--text)] text-xl font-bold mb-2">{t("حدث خطأ غير متوقع", "Something went wrong")}</p>
        <p className="text-[var(--muted-2)] text-sm mb-8">
          {t("نعتذر عن ذلك. يمكنك المحاولة مرة أخرى أو العودة للرئيسية.", "We're sorry. You can try again or go back home.")}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-500 hover:shadow-[0_0_24px_rgba(168,85,247,0.5)] transition-all"
          >
            <RotateCcw size={18} />
            {t("إعادة المحاولة", "Try again")}
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-purple-300 border border-purple-500/30 hover:bg-purple-500/10 transition-all"
          >
            <Home size={18} />
            {t("الرئيسية", "Home")}
          </Link>
        </div>
      </div>
    </div>
  );
}
