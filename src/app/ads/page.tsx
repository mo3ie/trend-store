"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Megaphone, Zap, BarChart3, Users, ChevronLeft, ChevronRight, Check, ArrowLeft, ArrowRight,
  Star, TrendingUp, Globe,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { priceFor, mergeAdsPricing, DEFAULT_ADS_PRICING, type AdsPricing, type Tier } from "@/services/campaigns";
import { useLang } from "@/hooks/useLang";
import LangToggle from "@/components/LangToggle";

const GRADIENT = "linear-gradient(135deg, #0f0f1a 0%, #0d1b2a 50%, #0a1628 100%)";
const CARD_BG  = "rgba(255,255,255,0.04)";
const BLUE     = "#1877f2";
const BLUE_DIM = "rgba(24,119,242,0.15)";

export default function AdsLandingPage() {
  const router = useRouter();
  const { t, rtl } = useLang();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tier, setTier]       = useState<Tier>("regular");
  const [pricing, setPricing] = useState<AdsPricing>(DEFAULT_ADS_PRICING);

  const Back = rtl ? ArrowLeft : ArrowRight;
  const Fwd  = rtl ? ChevronLeft : ChevronRight;

  const features = [
    { icon: Zap,       title: t("إعداد فوري", "Instant setup"),      desc: t("اختر المنشور، ادفع، ونبدأ الإعلان خلال دقائق", "Pick a post, pay, and your ad goes live within minutes") },
    { icon: Users,     title: t("استهداف دقيق", "Precise targeting"), desc: t("نصل لجمهورك في ليبيا بالمدينة والعمر والاهتمام", "We reach your audience in Libya by city, age and interest") },
    { icon: BarChart3, title: t("تتبع النتائج", "Track results"),     desc: t("تابع حملتك من لوحة تحكم شخصية", "Follow your campaign from a personal dashboard") },
    { icon: Globe,     title: t("بدون تقنية", "No tech needed"),       desc: t("لا تحتاج معرفة بالإعلانات — نتكفل بكل التفاصيل", "No ad experience required — we handle all the details") },
  ];

  const steps = [
    { n: "1", t: t("سجّل دخولك", "Sign in"),       d: t("أنشئ حساباً أو سجّل دخولك في ثوانٍ", "Create an account or sign in within seconds") },
    { n: "2", t: t("اربط صفحتك", "Connect your Page"), d: t("صلاحيات رسمية من Meta — آمن تماماً", "Official Meta permissions — fully secure") },
    { n: "3", t: t("أنشئ الحملة", "Create a campaign"), d: t("الصق رابط المنشور، اختر الميزانية والمدة", "Paste your post link, choose budget and duration") },
    { n: "4", t: t("ادفع بالدينار", "Pay in LYD"),  d: t("ادفع لي، معاملات، موبي كاش، المحفظة", "Edfali, Moamalat, MobiCash, or wallet") },
    { n: "5", t: t("يبدأ إعلانك", "Your ad goes live"), d: t("نشغّل الحملة تلقائياً خلال دقائق من الدفع", "We launch the campaign automatically within minutes of payment") },
  ];

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
    fetch("/api/promo/me")
      .then((r) => r.json())
      .then((d) => { setTier(d.tier === "vip" ? "vip" : "regular"); setPricing(mergeAdsPricing(d.pricing)); })
      .catch(() => {});
  }, []);

  function handleStart() {
    if (!user) {
      router.push("/login?next=/ads/connect");
    } else {
      router.push("/ads/connect");
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: GRADIENT, color: "#fff", fontFamily: "Cairo, sans-serif", direction: rtl ? "rtl" : "ltr" }}>

      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${BLUE}, #6b46c1)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Megaphone size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{t("ترند ستور", "Trend Store")}</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>{t("الإعلانات الرقمية", "Digital Ads")}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {user && (
            <button onClick={() => router.push("/ads/campaigns")}
              style={{ background: "none", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "7px 16px", color: "#cbd5e1", cursor: "pointer", fontSize: 13 }}>
              {t("حملاتي", "My campaigns")}
            </button>
          )}
          <button onClick={() => router.push("/")}
            style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <Back size={16} /> {t("العودة للمتجر", "Back to store")}
          </button>
          <LangToggle />
        </div>
      </nav>

      {/* Hero */}
      <section style={{ textAlign: "center", padding: "80px 24px 60px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: BLUE_DIM, border: `1px solid ${BLUE}40`, borderRadius: 100, padding: "6px 16px", marginBottom: 28, fontSize: 13, color: "#93c5fd" }}>
          <Star size={13} fill="#93c5fd" /> {t("الإعلانات الرقمية", "Digital Ads")}
        </div>
        <h1 style={{ fontSize: "clamp(32px,6vw,58px)", fontWeight: 900, lineHeight: 1.15, marginBottom: 20, background: "linear-gradient(135deg, #fff 0%, #93c5fd 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          {t("وصّل إعلانك", "Get your ad")}<br />{t("للعملاء بسهولة", "in front of customers")}
        </h1>
        <p style={{ fontSize: "clamp(15px,2vw,18px)", color: "#94a3b8", maxWidth: 520, margin: "0 auto 40px", lineHeight: 1.7 }}>
          {t("اختر المنشور، حدد الميزانية، ونحن نهتم بالباقي. تشغيل إعلانك خلال دقائق بدون أي خبرة تقنية.",
             "Choose a post, set a budget, and we take care of the rest. Your ad goes live within minutes — no technical experience needed.")}
        </p>
        <button onClick={handleStart} disabled={loading}
          style={{ background: `linear-gradient(135deg, ${BLUE}, #6b46c1)`, border: "none", borderRadius: 14, padding: "16px 40px", color: "#fff", fontWeight: 700, fontSize: 17, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 10, boxShadow: "0 8px 32px rgba(24,119,242,0.35)" }}>
          <Megaphone size={20} />
          {t("ابدأ الإعلان الآن", "Start advertising now")}
          <Fwd size={18} />
        </button>
      </section>

      {/* Features */}
      <section style={{ padding: "20px 24px 80px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 20 }}>
          {features.map((f) => (
            <div key={f.title} style={{ background: CARD_BG, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: BLUE_DIM, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <f.icon size={20} color={BLUE} />
              </div>
              <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 15 }}>{f.title}</div>
              <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Packages */}
      <section style={{ padding: "0 24px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>{t("الباقات والأسعار", "Packages & pricing")}</h2>
          <p style={{ color: "#94a3b8", fontSize: 14 }}>{t("أو حدد ميزانية مخصصة عند إنشاء الحملة", "Or set a custom budget when creating the campaign")}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 20 }}>
          {pricing.packages.map((pkg) => {
            const totalLyd = priceFor(pkg.usd, tier, pricing).totalLyd;
            return (
            <div key={pkg.id} style={{
              background:    pkg.highlight ? `linear-gradient(135deg, ${BLUE}22, #6b46c122)` : CARD_BG,
              border:        pkg.highlight ? `1px solid ${BLUE}60` : "1px solid rgba(255,255,255,0.08)",
              borderRadius:  18,
              padding:       28,
              position:      "relative",
              transition:    "transform 0.2s",
            }}>
              {pkg.highlight && (
                <div style={{ position: "absolute", top: -12, insetInlineEnd: 20, background: `linear-gradient(135deg, ${BLUE}, #6b46c1)`, borderRadius: 100, padding: "3px 12px", fontSize: 11, fontWeight: 700 }}>
                  {t("الأكثر طلبًا", "Most popular")}
                </div>
              )}
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{t(pkg.name, pkg.nameEn)}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 36, fontWeight: 900, color: pkg.highlight ? "#93c5fd" : "#fff" }}>{totalLyd}</span>
                <span style={{ color: "#94a3b8", fontSize: 13 }}>{t("د.ل", "LYD")}</span>
              </div>
              <div style={{ color: "#64748b", fontSize: 12, marginBottom: 16 }}>${pkg.usd} {t("ميزانية إعلان", "ad budget")}</div>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  t(`مدة: ${pkg.days} أيام`, `Duration: ${pkg.days} days`),
                  t(`وصول تقديري: ~${pkg.reach}`, `Est. reach: ~${pkg.reachEn}`),
                  t("استهداف ليبيا كاملة", "Targets all of Libya"),
                ].map((item) => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#cbd5e1" }}>
                    <Check size={14} color={pkg.highlight ? BLUE : "#22c55e"} />
                    {item}
                  </div>
                ))}
              </div>
              <button onClick={handleStart}
                style={{ marginTop: 20, width: "100%", background: pkg.highlight ? `linear-gradient(135deg, ${BLUE}, #6b46c1)` : "rgba(255,255,255,0.08)", border: pkg.highlight ? "none" : "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "11px 0", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                {t("اختيار هذه الباقة", "Choose this package")}
              </button>
            </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: "0 24px 80px", maxWidth: 800, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: 26, fontWeight: 800, marginBottom: 36 }}>{t("كيف يعمل؟", "How it works")}</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {steps.map((step, i, arr) => (
            <div key={step.n} style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: `linear-gradient(135deg, ${BLUE}, #6b46c1)`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16, flexShrink: 0 }}>{step.n}</div>
                {i < arr.length - 1 && <div style={{ width: 2, height: 40, background: "rgba(255,255,255,0.08)", marginTop: 4 }} />}
              </div>
              <div style={{ paddingBottom: 28 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginTop: 10 }}>{step.t}</div>
                <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>{step.d}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ textAlign: "center", padding: "60px 24px 100px" }}>
        <div style={{ background: `linear-gradient(135deg, ${BLUE}20, #6b46c120)`, border: `1px solid ${BLUE}30`, borderRadius: 24, maxWidth: 600, margin: "0 auto", padding: "48px 32px" }}>
          <TrendingUp size={40} color={BLUE} style={{ marginBottom: 16 }} />
          <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 12 }}>{t("ابدأ حملتك اليوم", "Start your campaign today")}</h2>
          <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 28, lineHeight: 1.7 }}>
            {t("انضم لمئات التجار الليبيين الذين يعزّزون مبيعاتهم عبر الإعلانات الرقمية",
               "Join hundreds of Libyan merchants boosting their sales through digital ads")}
          </p>
          <button onClick={handleStart}
            style={{ background: `linear-gradient(135deg, ${BLUE}, #6b46c1)`, border: "none", borderRadius: 12, padding: "14px 36px", color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer", boxShadow: "0 8px 24px rgba(24,119,242,0.3)" }}>
            {t("ابدأ الآن مجاناً", "Get started free")}
          </button>
        </div>
      </section>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "24px", borderTop: "1px solid rgba(255,255,255,0.06)", color: "#475569", fontSize: 12 }}>
        {t("© 2025 ترند ستور — خدمات الإعلانات الرقمية", "© 2025 Trend Store — Digital advertising services")}
      </div>
    </div>
  );
}
