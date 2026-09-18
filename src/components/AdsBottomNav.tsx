"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Home, Megaphone, MessageSquareReply, Bot, Wallet, LifeBuoy, X, Phone } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useTheme } from "@/hooks/useTheme";
import WalletModal from "@/components/WalletModal";

const G_HERO = "linear-gradient(140deg,#6d28d9 0%,#d6409f 55%,#ff7a59 100%)";
const PINK   = "#d6409f";
const SUPPORT_PHONE = "218918621511"; // WhatsApp support

// Shared quick-access bar for the Facebook Tools area (ads + bot + AI employee).
// Context-aware: highlights the current section and shows a section-specific help
// guide. Fixed to the bottom; pages reserve paddingBottom for it.
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

  const section: "ads" | "bot" | "studio" | "home" =
    path.startsWith("/studio") ? "studio" : path.startsWith("/bot") ? "bot" : path.startsWith("/ads") ? "ads" : "home";

  const items = [
    { key: "home",   icon: Home,               label: t("الرئيسية", "Home"),   href: "/facebook", active: section === "home" },
    { key: "ads",    icon: Megaphone,          label: t("الإعلانات", "Ads"),   href: "/ads",      active: section === "ads" },
    { key: "bot",    icon: MessageSquareReply, label: t("الرد الآلي", "Bot"),  href: "/bot",      active: section === "bot" },
    { key: "studio", icon: Bot,                label: t("الموظف", "Employee"), href: "/studio",   active: section === "studio" },
    { key: "wallet", icon: Wallet,             label: t("المحفظة", "Wallet"),  onClick: () => setWallet(true) },
    { key: "help",   icon: LifeBuoy,           label: t("الدعم", "Support"),   onClick: () => setHelp(true) },
  ];

  // Section-specific support guide.
  const GUIDES = {
    ads: {
      title: t("كيف تنشئ إعلاناً؟", "How to create an ad"),
      steps: [
        t("اربط صفحة فيسبوك من زر «ربط صفحة».", "Connect your Facebook Page via “Connect a Page”."),
        t("اضغط «حملة جديدة»، اختر صفحتك ثم المنشور المراد تمويله.", "Tap “New campaign”, pick your Page then the post to boost."),
        t("اختر الهدف، الباقة والمدة (أو الميزانية الحرة لـ VIP).", "Choose the goal, package & duration (or a free VIP budget)."),
        t("حدّد الاستهداف: المدن، العمر، الجنس، والاهتمامات.", "Set targeting: cities, age, gender, interests."),
        t("ادفع بالدينار، ويبدأ إعلانك بعد مراجعة فيسبوك خلال دقائق.", "Pay in LYD; your ad starts after a short Facebook review."),
      ],
      cta: () => router.push("/ads/create"),
      ctaLabel: t("حملة جديدة", "New campaign"),
    },
    bot: {
      title: t("كيف تفعّل الرد الآلي؟", "How to set up the bot"),
      steps: [
        t("اربط صفحة فيسبوك وفعّل الاشتراك الشهري.", "Connect a Page and activate the monthly subscription."),
        t("اضبط رسالة الردّ العام والرسالة الخاصة.", "Set the public reply and the private message."),
        t("أضف قواعد كلمات مفتاحية أو فعّل الذكاء الاصطناعي.", "Add keyword rules or enable AI replies."),
        t("اختر منشورات معينة أو كل المنشورات للرد عليها.", "Pick specific posts or all posts to auto-reply on."),
        t("يعمل البوت 24/7 ويردّ فوراً على كل تعليق.", "The bot runs 24/7 and replies instantly to every comment."),
      ],
      cta: () => router.push("/bot"),
      ctaLabel: t("إعداد البوت", "Set up bot"),
    },
    studio: {
      title: t("كيف يعمل الموظف الذكي؟", "How the AI Employee works"),
      steps: [
        t("املأ «بيانات المتجر»: الاسم، النبرة، الهواتف، العناوين، الشعار.", "Fill “Store info”: name, voice, phones, addresses, logo."),
        t("أضف «الأصناف» بأسعارها وصورها (أو قائمة سريعة بالأسماء).", "Add “Catalog” items with prices & images (or a quick name list)."),
        t("اختر أفكار المنشورات وعدد المنشورات يومياً، ثم «توليد الخطة».", "Pick post ideas and posts/day, then “Generate plan”."),
        t("راجع الخطة، عدّل النصوص والصور والأوقات، واعتمدها.", "Review the plan, edit captions/images/times, then approve."),
        t("«عقل الموظف» يتذكّر أسلوبك ويطوّره في كل خطة.", "The “Employee brain” remembers your style and refines it each plan."),
      ],
      cta: () => router.push("/studio"),
      ctaLabel: t("الموظف الذكي", "AI Employee"),
    },
    home: {
      title: t("أدوات فيسبوك", "Facebook Tools"),
      steps: [
        t("الإعلانات: روّج منشوراتك بحملات حقيقية على Meta.", "Ads: boost your posts with real Meta campaigns."),
        t("الرد الآلي: ردّ على تعليقات صفحتك 24/7.", "Bot: auto-reply to your Page comments 24/7."),
        t("الموظف الذكي: خطة نشر يومية كاملة بالذكاء.", "AI Employee: a full AI daily posting plan."),
      ],
      cta: () => router.push("/facebook"),
      ctaLabel: t("استكشف الأدوات", "Explore tools"),
    },
  };
  const guide = GUIDES[section];

  return (
    <>
      <div style={{ position: "fixed", insetInline: 0, bottom: 0, zIndex: 40, background: c.bar, borderTop: `1px solid ${c.border}`, direction: rtl ? "rtl" : "ltr", boxShadow: "0 -6px 24px rgba(0,0,0,0.18)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(6,1fr)", padding: "6px 4px" }}>
          {items.map((it) => (
            <button key={it.key} onClick={() => (it.onClick ? it.onClick() : router.push(it.href!))}
              style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 0", color: it.active ? PINK : c.muted }}>
              <it.icon size={19} />
              <span style={{ fontSize: 9.5, fontWeight: it.active ? 800 : 600, whiteSpace: "nowrap" }}>{it.label}</span>
            </button>
          ))}
        </div>
      </div>

      {wallet && <WalletModal onClose={() => setWallet(false)} />}

      {help && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setHelp(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12, direction: rtl ? "rtl" : "ltr" }}>
          <div style={{ background: c.bar, color: c.text, width: "100%", maxWidth: 480, borderRadius: 22, padding: 22, fontFamily: "Cairo,sans-serif", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontWeight: 900, fontSize: 17, display: "flex", alignItems: "center", gap: 8 }}><LifeBuoy size={18} color={PINK} /> {guide.title}</div>
              <button onClick={() => setHelp(false)} style={{ background: "none", border: "none", color: c.muted, cursor: "pointer" }}><X size={20} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
              {guide.steps.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: G_HERO, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ fontSize: 13.5, color: c.text, lineHeight: 1.6, paddingTop: 2 }}>{s}</div>
                </div>
              ))}
            </div>
            <button onClick={() => { setHelp(false); guide.cta(); }}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", background: G_HERO, borderRadius: 13, padding: "12px 0", color: "#fff", fontWeight: 900, fontSize: 15, border: "none", cursor: "pointer", fontFamily: "inherit", marginBottom: 10 }}>
              {guide.ctaLabel}
            </button>
            <a href={`https://wa.me/${SUPPORT_PHONE}`} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, width: "100%", background: light ? "#f0fdf4" : "rgba(34,197,94,0.12)", borderRadius: 13, padding: "12px 0", color: "#16a34a", fontWeight: 900, fontSize: 14.5, textDecoration: "none", border: "1px solid rgba(34,197,94,0.3)" }}>
              <Phone size={16} /> {t("تواصل مع الدعم عبر واتساب", "Contact support on WhatsApp")}
            </a>
          </div>
        </div>
      )}
    </>
  );
}
