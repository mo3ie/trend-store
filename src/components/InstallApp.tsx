"use client";

import { useEffect, useState } from "react";
import { Download, X, Share, PlusSquare, MoreVertical } from "lucide-react";

/**
 * «حمّل التطبيق» — installs the store as an app (PWA).
 *  Android/Chrome/Edge: the native install prompt. iPhone (Safari): a short Share → Add to Home Screen guide.
 *  Hidden when already running as the installed app. Other buttons can open it with window.dispatchEvent(new Event("trend:install")).
 */
export default function InstallApp({ variant = "button", label = "حمّل التطبيق" }: { variant?: "button" | "none"; label?: string }) {
  const [standalone, setStandalone] = useState(true);
  const [guide, setGuide] = useState<"ios" | "other" | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const sa = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    setStandalone(sa);
    const open = () => install();
    const installed = () => { setDone(true); setStandalone(true); };
    window.addEventListener("trend:install", open);
    window.addEventListener("trend:installed", installed);
    return () => { window.removeEventListener("trend:install", open); window.removeEventListener("trend:installed", installed); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function install() {
    const p = window.__trendInstall;
    if (p) {
      await p.prompt();
      const r = await p.userChoice.catch(() => null);
      if (r?.outcome === "accepted") { window.__trendInstall = null; setDone(true); }
      return;
    }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setGuide(ios ? "ios" : "other");
  }

  if (standalone && !guide) return null;
  return (
    <>
      {variant === "button" && !standalone && !done && (
        <button className="installbtn" onClick={install} title="ثبّت محل ترند كتطبيق على جهازك"><Download size={17} /><span>{label}</span></button>
      )}
      {guide && (
        <div className="inst-back" onClick={() => setGuide(null)}>
          <div className="inst-sheet" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <button className="inst-x" onClick={() => setGuide(null)} aria-label="إغلاق"><X size={18} /></button>
            <img src="/icon-192.png" alt="" className="inst-logo" />
            <h3>ثبّت تطبيق محل ترند</h3>
            <p className="inst-sub">يفتح أسرع، يشتغل حتى والنت ضعيف، وبدون متجر تطبيقات.</p>
            {guide === "ios" ? (
              <ol>
                <li><Share size={18} /> افتح الموقع في <b>Safari</b> واضغط زر <b>المشاركة</b> تحت.</li>
                <li><PlusSquare size={18} /> اختار <b>«إضافة إلى الشاشة الرئيسية»</b>.</li>
                <li><Download size={18} /> اضغط <b>«إضافة»</b> — يظهر تطبيق ترند مع تطبيقاتك.</li>
              </ol>
            ) : (
              <ol>
                <li><MoreVertical size={18} /> افتح قائمة المتصفح (⋮) فوق.</li>
                <li><Download size={18} /> اختار <b>«تثبيت التطبيق»</b> أو <b>«إضافة إلى الشاشة الرئيسية»</b>.</li>
                <li>لو ما لقيتهاش، افتح الموقع في <b>Chrome</b> وجرّب مرة ثانية.</li>
              </ol>
            )}
          </div>
        </div>
      )}
    </>
  );
}
