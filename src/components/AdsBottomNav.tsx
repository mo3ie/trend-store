"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Home, Megaphone, MessageSquareReply, Wallet, LifeBuoy, X, Check, Phone } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useTheme } from "@/hooks/useTheme";
import WalletModal from "@/components/WalletModal";

const G_HERO = "linear-gradient(140deg,#6d28d9 0%,#d6409f 55%,#ff7a59 100%)";
const PINK   = "#d6409f";
const SUPPORT_PHONE = "218918621511"; // WhatsApp support

// Shared quick-access bar for the Facebook Tools area (ads + bot). Fixed to the
// bottom; the ads pages already reserve paddingBottom for it.
export default function AdsBottomNav() {
  const router = useRouter();
  const path = usePathname();
  const { t, rtl } = useLang();
  const { light } = useTheme();
  const [wallet, setWallet] = useState(false);
  const [help, setHelp] = useState(false);

  const c = light
    ? { bar: "#ffffff", border: "rgba(120,60,160,0.14)", text: "#1e1330", muted: "#8b7d97" }
    : { bar: "#150f22", border: "rgba(255,255,255,0.10)", text: "#f6eefb", muted: "#7a6d88" };

  const items = [
    { key: "home",   icon: Home,                label: t("فيسبوك", "Facebook"), href: "/facebook", active: path === "/facebook" },
    { key: "ads",    icon: Megaphone,           label: t("الإعلانات", "Ads"),   href: "/ads",      active: path.startsWith("/ads") },
    { key: "bot",    icon: MessageSquareReply,  label: t("الرد الآلي", "Bot"),   href: "/bot",      active: path.startsWith("/bot") },
    { key: "wallet", icon: Wallet,              label: t("المحفظة", "Wallet"),  onClick: () => setWallet(true) },
    { key: "help",   icon: LifeBuoy,            label: t("الدعم", "Support"),   onClick: () => setHelp(true) },
  ];

  const steps = [
    t("اربط صفحة فيسبوك من زر «ربط صفحة».", "Connect your Facebook Page via “Connect a Page”."),
    t("اضغط «حملة جديدة»، اختر صفحتك ثم المنشور المراد تمويله.", "Tap “New campaign”, pick your Page then the post to boost."),
    t("اختر الباقة والمدة (أو الميزانية الحرة لـ VIP).", "Choose a package & duration (or a free VIP budget)."),
    t("حدّد الاستهداف: المدن، العمر، الجنس، والاهتمامات.", "Set targeting: cities, age, gender, interests."),
    t("ادفع بالدينار، ويبدأ إعلانك بعد مراجعة فيسبوك خلال دقائق.", "Pay in LYD; your ad starts after a short Facebook review."),
  ];

  return (
    <>
      <div style={{ position: "fixed", insetInline: 0, bottom: 0, zIndex: 40, background: c.bar, borderTop: `1px solid ${c.border}`, direction: rtl ? "rtl" : "ltr", boxShadow: "0 -6px 24px rgba(0,0,0,0.18)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(5,1fr)", padding: "6px 8px" }}>
          {items.map((it) => (
            <button key={it.key} onClick={() => (it.onClick ? it.onClick() : router.push(it.href!))}
              style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 0", color: it.active ? PINK : c.muted }}>
              <it.icon size={20} />
              <span style={{ fontSize: 10.5, fontWeight: it.active ? 800 : 600 }}>{it.label}</span>
            </button>
          ))}
        </div>
      </div>

      {wallet && <WalletModal onClose={() => setWallet(false)} />}

      {help && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setHelp(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12, direction: rtl ? "rtl" : "ltr" }}>
          <div style={{ background: c.bar, color: c.text, width: "100%", maxWidth: 480, borderRadius: 22, padding: 22, fontFamily: "Cairo,sans-serif", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 17, display: "flex", alignItems: "center", gap: 8 }}><LifeBuoy size={18} color={PINK} /> {t("كيف تنشئ إعلاناً؟", "How to create an ad")}</div>
              <button onClick={() => setHelp(false)} style={{ background: "none", border: "none", color: c.muted, cursor: "pointer" }}><X size={20} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
              {steps.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: G_HERO, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ fontSize: 13.5, color: c.text, lineHeight: 1.6, paddingTop: 2 }}>{s}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: light ? "#f0fdf4" : "rgba(34,197,94,0.1)", borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 12.5, color: "#16a34a" }}>
              <Check size={15} /> {t("نفس الخطوات ستتوفّر قريباً لبوت الرد الآلي.", "The same steps will soon be available for the Auto-Reply Bot.")}
            </div>
            <a href={`https://wa.me/${SUPPORT_PHONE}`} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, width: "100%", background: G_HERO, borderRadius: 13, padding: "13px 0", color: "#fff", fontWeight: 900, fontSize: 15, textDecoration: "none" }}>
              <Phone size={17} /> {t("تواصل مع الدعم", "Contact support")}
            </a>
          </div>
        </div>
      )}
    </>
  );
}
