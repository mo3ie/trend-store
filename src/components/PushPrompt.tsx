"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BellRing, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { enablePush, syncPush, pushPermission, pushSupported, isIOS, isStandalone } from "@/lib/pushClient";

const KEY = "trend_push_later";
const HIDE_ON = /^\/(admin|login|register|auth|reset-password|moamalat-pay|offline)/;

/**
 * Offers phone notifications to SIGNED-IN customers (orders, wallet, cards, electricity,
 * recharge, market, maintenance, gift…). Shown once, after a short delay, never on admin
 * pages; «لاحقاً» hides it for a week. When permission is already granted it only
 * re-syncs the subscription silently. The bell's «إشعارات الهاتف» opens it on demand
 * (window event `trend:push`).
 */
export default function PushPrompt() {
  const path = usePathname() || "/";
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState<"ask" | "ios" | "denied">("ask");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const open = (force = false) => {
      const perm = pushPermission();
      if (perm === "granted") { if (force) { setMode("ask"); setMsg("✅ الإشعارات مفعّلة على هذا الجهاز."); setShow(true); } return; }
      if (perm === "denied") { if (force) { setMode("denied"); setShow(true); } return; }
      if (!pushSupported()) { if (isIOS() && !isStandalone()) { setMode("ios"); setShow(true); } return; }
      setMode("ask"); setShow(true);
    };
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      if (pushPermission() === "granted") { syncPush(); return; }
      let later = 0; try { later = Number(localStorage.getItem(KEY) || 0); } catch {}
      if (Date.now() - later < 7 * 864e5) return;
      timer = setTimeout(() => { if (!HIDE_ON.test(window.location.pathname)) open(); }, 9000);
    });
    const onAsk = () => { setMsg(""); open(true); };
    window.addEventListener("trend:push", onAsk);
    return () => { if (timer) clearTimeout(timer); window.removeEventListener("trend:push", onAsk); };
  }, []);

  if (!show || HIDE_ON.test(path)) return null;

  const later = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch {} setShow(false); };
  const turnOn = async () => {
    setBusy(true); setMsg("");
    const r = await enablePush();
    setBusy(false);
    if (r === "on") {
      setMsg("✅ تمام! توا توصلك الإشعارات على هاتفك.");
      fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ test: true }) }).catch(() => {});
      setTimeout(() => setShow(false), 2600);
    } else if (r === "denied") setMode("denied");
    else if (r === "ios-install") setMode("ios");
    else setMsg("ما قدرناش نفعّلها على هذا المتصفح — جرّب من تطبيق ترند أو متصفح كروم.");
  };

  return (
    <div className="pushcard" dir="rtl" role="dialog" aria-label="إشعارات الهاتف">
      <button className="pushcard-x" onClick={later} aria-label="إغلاق"><X size={16} /></button>
      <span className="pushcard-ic"><BellRing size={20} /></span>
      <div className="pushcard-txt">
        <b>خلّي أخبار ترند توصلك على هاتفك</b>
        {mode === "ask" && <p>{msg || "طلباتك، شحن المحفظة، الكروت والكهرباء، الصيانة، السوق والهدايا — أول بأول حتى والموقع مقفول."}</p>}
        {mode === "ios" && <p>على الآيفون الإشعارات تشتغل من <b>تطبيق ترند</b>: اضغط زر المشاركة ⬆️ ← «إضافة إلى الشاشة الرئيسية»، افتح التطبيق، وفعّلها من هناك.</p>}
        {mode === "denied" && <p>الإشعارات مقفولة لهذا الموقع. افتح إعدادات الموقع في المتصفح (رمز القفل 🔒 جنب العنوان) ← الإشعارات ← سماح.</p>}
        <div className="pushcard-btns">
          {mode === "ask" && !msg.startsWith("✅") && <button className="pc-on" onClick={turnOn} disabled={busy}>{busy ? "لحظة…" : "فعّل الإشعارات"}</button>}
          {mode === "ios" && <button className="pc-on" onClick={() => { window.dispatchEvent(new Event("trend:install")); setShow(false); }}>طريقة التثبيت</button>}
          <button className="pc-later" onClick={later}>{mode === "ask" && !msg.startsWith("✅") ? "لاحقاً" : "تمام"}</button>
        </div>
      </div>
    </div>
  );
}
