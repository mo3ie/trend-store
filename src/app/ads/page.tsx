"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Megaphone, Zap, BarChart3, Users, Check, ArrowLeft, ArrowRight, Globe,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { priceFor, mergeAdsPricing, DEFAULT_ADS_PRICING, type AdsPricing, type Tier } from "@/services/campaigns";
import { useLang } from "@/hooks/useLang";
import { useTheme } from "@/hooks/useTheme";
import LangToggle from "@/components/LangToggle";

// Vivid gradient tokens — shared across dark & light (the "حيوي جريء" direction).
const G_HERO   = "linear-gradient(140deg,#6d28d9 0%,#d6409f 55%,#ff7a59 100%)";
const G_BRAND  = "linear-gradient(135deg,#ff5c8a,#ffa14a)";
const G_BLUE   = "linear-gradient(135deg,#22d3ee,#3b82f6)";
const G_PURPLE = "linear-gradient(135deg,#a855f7,#ec4899)";
const G_AMBER  = "linear-gradient(135deg,#f59e0b,#ef4444)";
const G_GREEN  = "linear-gradient(135deg,#10b981,#22d3ee)";
const FEATURE_GRADS = [G_BLUE, G_PURPLE, G_AMBER, G_GREEN];
const PAY_GRADS     = [G_GREEN, G_AMBER, G_BLUE, G_PURPLE];

export default function AdsLandingPage() {
  const router = useRouter();
  const { t, rtl } = useLang();
  const { light } = useTheme();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tier, setTier]       = useState<Tier>("regular");
  const [pricing, setPricing] = useState<AdsPricing>(DEFAULT_ADS_PRICING);

  const Fwd = rtl ? ArrowLeft : ArrowRight;

  // Theme palette.
  const c = light ? {
    bg: "#fbf7ff", text: "#1e1330", muted: "#6b5b78", dim: "#8b7d97",
    surface: "#ffffff", border: "rgba(120,60,160,0.14)",
  } : {
    bg: "#100a18", text: "#f6eefb", muted: "#a394b0", dim: "#7a6d88",
    surface: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.10)",
  };

  const features = [
    { icon: Zap,       title: t("إعداد فوري", "Instant setup"),      desc: t("اختر المنشور، ادفع، وينطلق إعلانك خلال دقائق", "Pick a post, pay, and your ad goes live within minutes") },
    { icon: Users,     title: t("استهداف دقيق", "Precise targeting"), desc: t("نصل لجمهورك في ليبيا بالمدينة والعمر والاهتمام", "We reach your audience in Libya by city, age and interest") },
    { icon: BarChart3, title: t("تتبع النتائج", "Track results"),     desc: t("تابع حملتك من لوحة تحكم شخصية", "Follow your campaign from a personal dashboard") },
    { icon: Globe,     title: t("بدون تقنية", "No tech needed"),       desc: t("لا تحتاج معرفة بالإعلانات — نتكفل بكل التفاصيل", "No ad experience required — we handle all the details") },
  ];

  const payMethods = [
    t("ادفع لي", "Edfali"), t("معاملات", "Moamalat"), t("موبي كاش", "MobiCash"), t("المحفظة", "Wallet"),
  ];

  const steps = [
    { n: "1", t: t("سجّل دخولك", "Sign in"),          d: t("أنشئ حساباً أو سجّل دخولك في ثوانٍ", "Create an account or sign in within seconds") },
    { n: "2", t: t("اربط صفحتك", "Connect your Page"), d: t("صلاحيات رسمية من Meta — آمن تماماً", "Official Meta permissions — fully secure") },
    { n: "3", t: t("أنشئ الحملة", "Create a campaign"), d: t("اختر المنشور، الميزانية والمدة", "Pick your post, budget and duration") },
    { n: "4", t: t("ادفع بالدينار", "Pay in LYD"),     d: t("ادفع لي، معاملات، موبي كاش، أو المحفظة", "Edfali, Moamalat, MobiCash, or wallet") },
    { n: "5", t: t("يبدأ إعلانك", "Your ad goes live"), d: t("نشغّل الحملة تلقائياً خلال دقائق من الدفع", "We launch the campaign automatically within minutes") },
  ];

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); setLoading(false); });
    fetch("/api/promo/me")
      .then((r) => r.json())
      .then((d) => { setTier(d.tier === "vip" ? "vip" : "regular"); setPricing(mergeAdsPricing(d.pricing)); })
      .catch(() => {});
  }, []);

  function handleStart() {
    router.push(user ? "/ads/connect" : "/login?next=/ads/connect");
  }

  const card: React.CSSProperties = { background: c.surface, border: `2px solid ${c.border}`, borderRadius: 18 };

  return (
    <div style={{ minHeight: "100vh", background: c.bg, color: c.text, fontFamily: "Cairo, sans-serif", direction: rtl ? "rtl" : "ltr", paddingBottom: 40, transition: "background .2s,color .2s" }}>

      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: G_BRAND, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Megaphone size={19} color="#fff" />
          </div>
          <div style={{ fontWeight: 900, fontSize: 15 }}>{t("ترند ستور", "Trend Store")}</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {user && (
            <button onClick={() => router.push("/ads/campaigns")}
              style={{ background: c.surface, border: `2px solid ${c.border}`, borderRadius: 11, padding: "8px 14px", color: c.text, cursor: "pointer", fontSize: 12.5, fontWeight: 800, fontFamily: "inherit" }}>
              {t("حملاتي", "My campaigns")}
            </button>
          )}
          <button onClick={() => router.push("/")}
            style={{ background: "none", border: "none", color: c.muted, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
            {t("المتجر", "Store")}
          </button>
          <LangToggle />
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: 760, margin: "0 auto", padding: "20px 18px 8px" }}>
        <div style={{ borderRadius: 28, padding: "clamp(30px,6vw,44px) clamp(22px,5vw,36px)", background: G_HERO, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -40, insetInlineEnd: -30, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.18)" }} />
          <div style={{ position: "relative" }}>
            <div style={{ display: "inline-block", background: "rgba(255,255,255,0.22)", borderRadius: 100, padding: "6px 15px", fontSize: 12.5, color: "#fff", fontWeight: 800, marginBottom: 18 }}>
              ✦ {t("إعلانات فيسبوك بضغطة", "Facebook ads in a tap")}
            </div>
            <h1 style={{ fontSize: "clamp(34px,7vw,46px)", fontWeight: 900, lineHeight: 1.12, margin: "0 0 14px", color: "#fff", letterSpacing: "-1px" }}>
              {t("وصّل إعلانك", "Get your ad")}<br />{t("للعملاء 🚀", "in front of customers 🚀")}
            </h1>
            <p style={{ color: "rgba(255,255,255,0.92)", fontSize: "clamp(14px,2.2vw,15px)", lineHeight: 1.7, margin: "0 0 26px", maxWidth: 420 }}>
              {t("اختر منشوراً، حدّد الميزانية، وادفع بالدينار — ونُطلق حملتك الحقيقية على Meta خلال دقائق.",
                 "Pick a post, set a budget, pay in LYD — and we launch your real Meta campaign within minutes.")}
            </p>
            <button onClick={handleStart} disabled={loading}
              style={{ border: "none", cursor: "pointer", borderRadius: 15, padding: "15px 30px", fontFamily: "inherit", fontWeight: 900, fontSize: 16, color: "#d6409f", background: "#fff", boxShadow: "0 12px 30px rgba(0,0,0,0.20)", display: "inline-flex", alignItems: "center", gap: 9 }}>
              {t("ابدأ الإعلان الآن", "Start advertising")}
              <Fwd size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* Stat pills */}
      <section style={{ maxWidth: 760, margin: "0 auto", padding: "14px 18px 8px" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { g: G_BLUE,   big: t("دقائق", "Minutes"), sub: t("للانطلاق", "to launch") },
            { g: G_PURPLE, big: t("4 طرق", "4 ways"),  sub: t("دفع محلية", "local payment") },
            { g: G_AMBER,  big: "Meta",                sub: t("رسمي", "official") },
          ].map((s) => (
            <div key={s.sub} style={{ flex: "1 1 100px", borderRadius: 18, padding: "16px 10px", textAlign: "center", background: s.g }}>
              <div style={{ fontSize: 21, fontWeight: 900, color: "#fff" }}>{s.big}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.92)", marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ maxWidth: 1000, margin: "0 auto", padding: "26px 18px 8px" }}>
        <h2 style={{ fontWeight: 900, fontSize: 24, margin: "0 0 16px" }}>{t("مزايا تفرق 💥", "Features that matter 💥")}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
          {features.map((f, i) => (
            <div key={f.title} style={{ ...card, padding: 18 }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: FEATURE_GRADS[i], display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <f.icon size={22} color="#fff" />
              </div>
              <div style={{ fontWeight: 800, fontSize: 15.5 }}>{f.title}</div>
              <div style={{ color: c.muted, fontSize: 13, lineHeight: 1.6, marginTop: 4 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Payment methods */}
      <section style={{ maxWidth: 800, margin: "0 auto", padding: "26px 18px 8px" }}>
        <h2 style={{ fontWeight: 900, fontSize: 24, margin: "0 0 6px" }}>{t("ادفع بالدينار 💳", "Pay in LYD 💳")}</h2>
        <p style={{ color: c.muted, fontSize: 13.5, margin: "0 0 14px" }}>{t("طرق دفع ليبية محلية — كلها مُفعّلة.", "Local Libyan payment methods — all active.")}</p>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          {payMethods.map((m, i) => (
            <div key={m} style={{ flex: "1 1 120px", borderRadius: 100, padding: "14px 8px", textAlign: "center", fontWeight: 800, fontSize: 13.5, color: "#fff", background: PAY_GRADS[i] }}>
              {m}
            </div>
          ))}
        </div>
      </section>

      {/* Packages */}
      <section style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 18px 8px" }}>
        <h2 style={{ fontWeight: 900, fontSize: 24, margin: "0 0 4px" }}>{t("الباقات والأسعار", "Packages & pricing")}</h2>
        <p style={{ color: c.muted, fontSize: 13.5, margin: "0 0 16px" }}>{t("أو حدّد ميزانية مخصّصة عند إنشاء الحملة", "Or set a custom budget when creating the campaign")}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 14 }}>
          {pricing.packages.map((pkg) => {
            const totalLyd = priceFor(pkg.usd, tier, pricing).totalLyd;
            return (
              <div key={pkg.id} style={{ ...card, padding: 22, position: "relative", ...(pkg.highlight ? { borderColor: "transparent", backgroundImage: `linear-gradient(${c.surface},${c.surface}), ${G_HERO}`, backgroundOrigin: "border-box", backgroundClip: "padding-box, border-box" } : {}) }}>
                {pkg.highlight && (
                  <div style={{ position: "absolute", top: -12, insetInlineEnd: 18, background: G_HERO, borderRadius: 100, padding: "3px 12px", fontSize: 11, fontWeight: 800, color: "#fff" }}>
                    {t("الأكثر طلبًا", "Most popular")}
                  </div>
                )}
                <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>{t(pkg.name, pkg.nameEn)}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                  <span style={{ fontSize: 38, fontWeight: 900, background: G_HERO, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{totalLyd}</span>
                  <span style={{ color: c.muted, fontSize: 13 }}>{t("د.ل", "LYD")}</span>
                </div>
                <div style={{ color: c.dim, fontSize: 12, marginBottom: 16 }}>${pkg.usd} {t("ميزانية إعلان", "ad budget")}</div>
                <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    t(`مدة: ${pkg.days} أيام`, `Duration: ${pkg.days} days`),
                    t(`وصول تقديري: ~${pkg.reach}`, `Est. reach: ~${pkg.reachEn}`),
                    t("استهداف ليبيا كاملة", "Targets all of Libya"),
                  ].map((item) => (
                    <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: c.muted }}>
                      <Check size={15} color="#ec4899" /> {item}
                    </div>
                  ))}
                </div>
                <button onClick={handleStart}
                  style={{ marginTop: 20, width: "100%", background: pkg.highlight ? G_HERO : c.surface, border: pkg.highlight ? "none" : `2px solid ${c.border}`, borderRadius: 12, padding: "12px 0", color: pkg.highlight ? "#fff" : c.text, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                  {t("اختيار هذه الباقة", "Choose this package")}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section style={{ maxWidth: 700, margin: "0 auto", padding: "30px 18px 8px" }}>
        <h2 style={{ fontWeight: 900, fontSize: 24, margin: "0 0 20px" }}>{t("كيف يعمل؟", "How it works")}</h2>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {steps.map((step, i, arr) => (
            <div key={step.n} style={{ display: "flex", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: G_HERO, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 15, color: "#fff", flexShrink: 0 }}>{step.n}</div>
                {i < arr.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 28, background: c.border, marginTop: 4 }} />}
              </div>
              <div style={{ paddingBottom: 22, paddingTop: 6 }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{step.t}</div>
                <div style={{ color: c.muted, fontSize: 13, marginTop: 3 }}>{step.d}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 640, margin: "0 auto", padding: "20px 18px 8px" }}>
        <div style={{ textAlign: "center", borderRadius: 26, padding: "clamp(30px,6vw,40px) 24px", background: G_HERO }}>
          <div style={{ fontWeight: 900, fontSize: 24, marginBottom: 8, color: "#fff" }}>{t("ابدأ حملتك اليوم 🎯", "Start your campaign today 🎯")}</div>
          <div style={{ color: "rgba(255,255,255,0.92)", fontSize: 13.5, lineHeight: 1.7, marginBottom: 22 }}>
            {t("انضمّ لمئات التجار الليبيين الذين يعزّزون مبيعاتهم عبر الإعلانات الرقمية.",
               "Join hundreds of Libyan merchants boosting their sales through digital ads.")}
          </div>
          <button onClick={handleStart}
            style={{ width: "100%", border: "none", cursor: "pointer", borderRadius: 100, padding: "16px 0", fontFamily: "inherit", fontWeight: 900, fontSize: 16, color: "#d6409f", background: "#fff" }}>
            {t("ابدأ الآن مجاناً", "Get started free")}
          </button>
        </div>
      </section>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: 24, color: c.dim, fontSize: 12 }}>
        {t("© 2025 ترند ستور — خدمات الإعلانات الرقمية", "© 2025 Trend Store — Digital advertising services")}
      </div>
    </div>
  );
}
