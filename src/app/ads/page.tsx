"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Megaphone, Zap, BarChart3, Users, Check, ArrowLeft, ArrowRight, Globe,
  Crown, Headphones, Sparkles, Infinity as InfinityIcon, Eye,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { AD_TIER_PACKAGES, VIP_MONTHLY_LYD, type Tier } from "@/services/campaigns";
import { useLang } from "@/hooks/useLang";
import { useTheme } from "@/hooks/useTheme";
import LangToggle from "@/components/LangToggle";
import AdsBottomNav from "@/components/AdsBottomNav";

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
      .then((d) => { setTier(d.tier === "vip" ? "vip" : "regular"); })
      .catch(() => {});
  }, []);

  function handleStart() {
    router.push(user ? "/ads/connect" : "/login?next=/ads/connect");
  }

  const card: React.CSSProperties = { background: c.surface, border: `2px solid ${c.border}`, borderRadius: 18 };

  return (
    <div style={{ minHeight: "100vh", background: c.bg, color: c.text, fontFamily: "Cairo, sans-serif", direction: rtl ? "rtl" : "ltr", paddingBottom: 96, overflowX: "hidden", transition: "background .2s,color .2s" }}>

      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: G_BRAND, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Megaphone size={19} color="#fff" />
          </div>
          <div style={{ fontWeight: 900, fontSize: 15 }}>{t("ترند ستور", "Trend Store")}</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {user ? (
            <button onClick={() => router.push("/ads/campaigns")}
              style={{ background: c.surface, border: `2px solid ${c.border}`, borderRadius: 11, padding: "8px 14px", color: c.text, cursor: "pointer", fontSize: 12.5, fontWeight: 800, fontFamily: "inherit" }}>
              {t("حملاتي", "My campaigns")}
            </button>
          ) : (
            <button onClick={() => router.push("/login?next=/ads")}
              style={{ background: G_HERO, border: "none", borderRadius: 11, padding: "8px 16px", color: "#fff", cursor: "pointer", fontSize: 12.5, fontWeight: 800, fontFamily: "inherit" }}>
              {t("تسجيل الدخول", "Sign in")}
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

      {/* Packages — fixed LYD tiers */}
      <section style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 18px 8px" }}>
        <h2 style={{ fontWeight: 900, fontSize: 24, margin: "0 0 4px" }}>{t("باقات الإعلانات الممولة", "Sponsored ad packages")}</h2>
        <p style={{ color: c.muted, fontSize: 13.5, margin: "0 0 18px" }}>{t("إعلانات فيسبوك — نتائج حقيقية لإعلاناتك.", "Facebook ads — real results for your posts.")}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
          {AD_TIER_PACKAGES.map((pkg) => {
            const medal = pkg.level === 1 ? "#f0b429" : pkg.level === 2 ? "#9aa4b2" : "#c07b45";
            return (
              <div key={pkg.id} style={{ ...card, padding: 0, overflow: "hidden", borderColor: `${medal}55` }}>
                <div style={{ textAlign: "center", padding: "18px 16px 14px", borderBottom: `1px solid ${c.border}` }}>
                  <div style={{ width: 44, height: 44, margin: "0 auto 8px", borderRadius: "50%", background: `${medal}22`, border: `2px solid ${medal}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18, color: medal }}>{pkg.level}</div>
                  <div style={{ fontSize: 11, color: c.dim, letterSpacing: 3, fontWeight: 700 }}>{t("باقة", "PACKAGE")}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: medal }}>{t(pkg.name, pkg.nameEn)}</div>
                </div>
                <div style={{ padding: "6px 14px 14px" }}>
                  <div style={{ display: "flex", padding: "8px 6px", color: c.dim, fontSize: 11, fontWeight: 700, borderBottom: `1px solid ${c.border}` }}>
                    <span style={{ flex: 1 }}>{t("المدة", "Duration")}</span>
                    <span style={{ flex: 1, textAlign: "center" }}>{t("السعر", "Price")}</span>
                    <span style={{ flex: 1.3, textAlign: "center" }}>{t("المشاهدات", "Views")}</span>
                  </div>
                  {pkg.options.map((o) => (
                    <div key={o.days} style={{ display: "flex", alignItems: "center", padding: "9px 6px", fontSize: 12.5, borderBottom: `1px solid ${c.border}` }}>
                      <span style={{ flex: 1, color: c.muted }}>{t(`${o.days} أيام`, `${o.days} days`)}</span>
                      <span style={{ flex: 1, textAlign: "center", fontWeight: 900, color: medal }}>{o.priceLyd} <span style={{ fontSize: 10, color: c.dim }}>{t("د.ل", "LYD")}</span></span>
                      <span style={{ flex: 1.3, textAlign: "center", color: c.muted, fontSize: 11 }}>{o.viewsMin.toLocaleString("en")}–{o.viewsMax.toLocaleString("en")}</span>
                    </div>
                  ))}
                  <button onClick={handleStart}
                    style={{ marginTop: 14, width: "100%", background: `linear-gradient(135deg,${medal},${medal}cc)`, border: "none", borderRadius: 12, padding: "12px 0", color: "#1a1330", fontWeight: 900, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                    {t("اختر هذه الباقة", "Choose this package")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* trust strip */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
          {[
            { icon: Eye,       label: t("ضمان وصول المشاهدات", "Guaranteed views delivery") },
            { icon: BarChart3, label: t("تقارير دورية للأداء", "Regular performance reports") },
            { icon: Check,     label: t("إدارة احترافية", "Professional management") },
          ].map((x) => (
            <div key={x.label} style={{ flex: "1 1 200px", display: "flex", alignItems: "center", gap: 9, background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, padding: "12px 14px" }}>
              <x.icon size={17} color="#ec4899" />
              <span style={{ fontSize: 12.5, color: c.muted, fontWeight: 600 }}>{x.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* VIP card */}
      <section style={{ maxWidth: 1000, margin: "0 auto", padding: "20px 18px 8px" }}>
        <div style={{ borderRadius: 22, padding: "clamp(24px,5vw,34px)", background: "linear-gradient(135deg,#171226,#241a3a)", border: "1px solid #f0b42955", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -30, insetInlineEnd: -20, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle,#f0b42933,transparent 70%)" }} />
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg,#f0b429,#ff9d2f)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Crown size={22} color="#1a1330" />
              </div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 20, color: "#fff" }}>{t("عضوية VIP", "VIP membership")}</div>
                <div style={{ fontSize: 12.5, color: "#c9b98a" }}>{t("حرية كاملة في الميزانية والمدة", "Full freedom over budget & duration")}</div>
              </div>
              <div style={{ marginInlineStart: "auto", textAlign: "center" }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: "#f0b429" }}>{VIP_MONTHLY_LYD}</div>
                <div style={{ fontSize: 11, color: "#c9b98a" }}>{t("د.ل / شهرياً", "LYD / month")}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10, margin: "16px 0 18px" }}>
              {[
                { icon: InfinityIcon, label: t("ميزانية وأيام بلا حدود (بالدولار)", "Unlimited budget & days (USD)") },
                { icon: Headphones,   label: t("دعم متواصل 24/7", "24/7 dedicated support") },
                { icon: Sparkles,     label: t("مساعد ذكاء اصطناعي لبناء الحملة", "AI assistant to build campaigns") },
                { icon: Check,        label: t("بدون عمولة + أولوية تشغيل", "Zero commission + priority") },
              ].map((b) => (
                <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 9, color: "#e9e2d0", fontSize: 13 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 8, background: "#f0b42922", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><b.icon size={15} color="#f0b429" /></div>
                  {b.label}
                </div>
              ))}
            </div>
            <button onClick={() => router.push(user ? "/ads/vip" : "/login?next=/ads/vip")}
              style={{ width: "100%", background: "linear-gradient(135deg,#f0b429,#ff9d2f)", border: "none", borderRadius: 13, padding: "14px 0", color: "#1a1330", fontWeight: 900, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>
              {tier === "vip" ? t("أنت عضو VIP ⭐ — أنشئ حملة حرة", "You're VIP ⭐ — create a free campaign") : t(`اشترك في VIP — ${VIP_MONTHLY_LYD} د.ل/شهر`, `Join VIP — ${VIP_MONTHLY_LYD} LYD/mo`)}
            </button>
          </div>
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

      <AdsBottomNav />
    </div>
  );
}
