"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Megaphone, ArrowLeft, ArrowRight, Loader2, Check, Link2, Eye,
  BarChart3, Users, Wallet, Sparkles, Info, ListOrdered,
} from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useTheme } from "@/hooks/useTheme";
import { botColors } from "@/lib/botTheme";
import LangToggle from "@/components/LangToggle";

const PINK = "#ff0050", CYAN = "#00f2ea";
const G_TT = "linear-gradient(135deg,#ff0050,#ff4d80 55%,#00f2ea)";

interface AdOption { days: number; priceLyd: number; budgetUsd: number; viewsMin: number; viewsMax: number }
interface AdPackage { id: string; name: string; nameEn: string; level: number; options: AdOption[] }
interface Me {
  configured: boolean; connected: boolean; vip: boolean; minDailyUsd: number;
  advertisers: Array<{ advertiserId: string; name: string }>;
  pricing: { packages: AdPackage[] };
}

export default function TikTokAdsLandingPage() {
  const router = useRouter();
  const { t, rtl } = useLang();
  const { light } = useTheme();
  const c = botColors(light);
  const Fwd = rtl ? ArrowLeft : ArrowRight;

  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [pkg, setPkg] = useState<string>("first");

  useEffect(() => {
    fetch("/api/tiktok/ads/me")
      .then((r) => (r.status === 401 ? null : r.json()))
      .then((d) => { if (d) setMe(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function connect() {
    setConnecting(true); setError("");
    try {
      const r = await fetch("/api/tiktok/ads/connect");
      const d = await r.json();
      if (d.url) { window.location.href = d.url; return; }
      setError(d.message || t("تعذّر بدء الربط", "Could not start linking"));
    } catch {
      setError(t("تعذّر الاتصال", "Connection failed"));
    }
    setConnecting(false);
  }

  const packages = me?.pricing?.packages || [];
  const active = packages.find((p) => p.id === pkg) || packages[0];

  const features = [
    { icon: Eye,       title: t("مشاهدات حقيقية", "Real views"),       desc: t("حملة حقيقية على تيك توك تصل لجمهور ليبي مستهدف", "A real TikTok campaign reaching a targeted Libyan audience") },
    { icon: Users,     title: t("استهداف دقيق", "Precise targeting"),   desc: t("بالمدينة والعمر والجنس والاهتمامات", "By city, age, gender and interests") },
    { icon: Wallet,    title: t("دفع بالدينار", "Pay in LYD"),          desc: t("ادفع لي، معاملات، موبي كاش، أو المحفظة", "Edfali, Moamalat, MobiCash or your wallet") },
    { icon: BarChart3, title: t("متابعة النتائج", "Track results"),     desc: t("المشاهدات والنقرات والإنفاق في لوحة واحدة", "Views, clicks and spend on one dashboard") },
  ];

  const card: React.CSSProperties = {
    background: c.card, border: `1px solid ${c.border}`, borderRadius: 18, padding: 20,
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: c.gradient, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={26} className="spin" color={PINK} />
      </div>
    );
  }

  return (
    <div dir={rtl ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: c.gradient, color: c.text, fontFamily: "inherit" }}>
      <div style={{ maxWidth: 940, margin: "0 auto", padding: "18px 16px 60px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <button onClick={() => router.push("/tiktok")}
            style={{ background: "none", border: "none", color: c.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", fontSize: 14 }}>
            <Fwd size={18} /> {t("أدوات تيك توك", "TikTok tools")}
          </button>
          <LangToggle />
        </div>

        {/* Hero */}
        <div style={{ ...card, marginTop: 16, background: G_TT, border: "none", color: "#fff", padding: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Megaphone size={26} />
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{t("إعلانات تيك توك", "TikTok Ads")}</h1>
          </div>
          <p style={{ margin: "12px 0 0", fontSize: 14.5, lineHeight: 1.85, opacity: 0.95 }}>
            {t("اختر فيديو من حسابك، حدّد الجمهور والميزانية، وادفع بالدينار — ونُنشئ لك حملة إعلانية حقيقية على تيك توك ونتابع نتائجها معك.",
               "Pick a video from your account, set the audience and budget, pay in LYD — we create a real TikTok ad campaign and track its results with you.")}
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            {me?.connected ? (
              <>
                <button onClick={() => router.push("/tiktok-ads/create")}
                  style={{ background: "#fff", color: "#111", border: "none", borderRadius: 12, padding: "12px 20px", fontWeight: 800, fontSize: 14.5, cursor: "pointer", fontFamily: "inherit" }}>
                  {t("حملة جديدة", "New campaign")}
                </button>
                <button onClick={() => router.push("/tiktok-ads/campaigns")}
                  style={{ background: "rgba(255,255,255,0.18)", color: "#fff", border: "1px solid rgba(255,255,255,0.4)", borderRadius: 12, padding: "12px 20px", fontWeight: 700, fontSize: 14.5, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7 }}>
                  <ListOrdered size={16} /> {t("حملاتي", "My campaigns")}
                </button>
              </>
            ) : (
              <button onClick={connect} disabled={connecting || me?.configured === false}
                style={{ background: "#fff", color: "#111", border: "none", borderRadius: 12, padding: "12px 20px", fontWeight: 800, fontSize: 14.5, cursor: me?.configured === false ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, opacity: me?.configured === false ? 0.6 : 1 }}>
                {connecting ? <Loader2 size={16} className="spin" /> : <Link2 size={16} />}
                {t("اربط حساب الإعلانات", "Connect your ad account")}
              </button>
            )}
          </div>
          {me?.configured === false && (
            <div style={{ marginTop: 12, fontSize: 12.5, background: "rgba(0,0,0,0.25)", borderRadius: 10, padding: "10px 12px", lineHeight: 1.7 }}>
              {t("ربط حساب الإعلانات قيد التفعيل حالياً — سيُفتح قريباً.",
                 "Ad-account linking is being activated — it will open shortly.")}
            </div>
          )}
          {error && (
            <div style={{ marginTop: 12, fontSize: 12.5, background: "rgba(0,0,0,0.3)", borderRadius: 10, padding: "10px 12px" }}>{error}</div>
          )}
        </div>

        {/* Features */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginTop: 16 }}>
          {features.map((f, i) => (
            <div key={i} style={card}>
              <f.icon size={20} color={i % 2 ? CYAN : PINK} />
              <div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 10 }}>{f.title}</div>
              <div style={{ fontSize: 12.5, color: c.muted, marginTop: 6, lineHeight: 1.75 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Price list */}
        {packages.length > 0 && (
          <div style={{ ...card, marginTop: 16 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>{t("باقات الإعلانات", "Ad packages")}</h2>

            {/*
              TikTok's own minimum spend is stated up front rather than discovered at
              checkout. It is the single most surprising thing about advertising here
              for anyone used to the Facebook prices, and an advertiser who learns it
              only after picking a package feels misled.
            */}
            {me?.minDailyUsd ? (
              <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: c.surface, border: `1px solid ${c.borderSoft}`, borderRadius: 12, padding: "11px 13px", marginTop: 12 }}>
                <Info size={16} color={CYAN} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.8 }}>
                  {t(`تيك توك يفرض حدّاً أدنى للإنفاق الإعلاني (${me.minDailyUsd}$ لكل يوم) — لذلك تبدأ باقات تيك توك أعلى من باقات فيسبوك. هذا شرط من المنصّة نفسها، وليس عمولة إضافية منّا.`,
                     `TikTok enforces a minimum ad spend ($${me.minDailyUsd} per day), which is why TikTok packages start higher than the Facebook ones. That floor is the platform's, not an extra fee from us.`)}
                </div>
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              {packages.map((p) => (
                <button key={p.id} onClick={() => setPkg(p.id)}
                  style={{ flex: "1 1 120px", background: pkg === p.id ? `${PINK}26` : c.surface, border: `1px solid ${pkg === p.id ? PINK : c.border}`, borderRadius: 12, padding: "11px 0", color: c.text, fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>
                  {t(`الباقة ${p.name}`, `${p.nameEn} tier`)}
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
              {(active?.options || []).map((o) => (
                <div key={o.days}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: c.surface, border: `1px solid ${c.borderSoft}`, borderRadius: 12, padding: "12px 14px", flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{o.days} {t("أيام", "days")}</div>
                  <div style={{ fontSize: 12.5, color: c.muted }}>
                    <Eye size={13} style={{ verticalAlign: "-2px" }} />{" "}
                    {o.viewsMin.toLocaleString()}–{o.viewsMax.toLocaleString()} {t("مشاهدة تقديرية", "est. views")}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: PINK }}>
                    {o.priceLyd.toLocaleString()} {t("د.ل", "LYD")}
                  </div>
                </div>
              ))}
            </div>

            {me?.vip && (
              <div style={{ display: "flex", gap: 9, alignItems: "center", marginTop: 14, fontSize: 12.5, color: c.muted }}>
                <Sparkles size={15} color={CYAN} />
                {t("باشتراكك مفتوحة لك الميزانية الحرة، الحملات المفتوحة، والمساعد الذكي للاستهداف.",
                   "Your subscription unlocks free budgets, open-ended campaigns and the AI targeting assistant.")}
              </div>
            )}
          </div>
        )}

        {/* How it works */}
        <div style={{ ...card, marginTop: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 14px" }}>{t("كيف تعمل؟", "How it works")}</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {[
              t("اربط حساب الإعلانات الخاص بك على تيك توك.", "Connect your TikTok ad account."),
              t("اختر الفيديو الذي تريد ترويجه من حسابك.", "Pick the video you want to promote from your account."),
              t("حدّد الهدف والجمهور والباقة أو الميزانية.", "Set the goal, audience and package or budget."),
              t("ادفع بالدينار، وتنطلق الحملة بعد مراجعة تيك توك.", "Pay in LYD; the campaign starts after TikTok's review."),
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                <div style={{ width: 24, height: 24, borderRadius: 999, background: G_TT, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                <div style={{ fontSize: 13.5, color: c.muted, lineHeight: 1.8 }}>{s}</div>
              </div>
            ))}
          </div>
        </div>

        {me?.connected && (
          <div style={{ ...card, marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}>
                <Check size={16} color="#22c55e" /> {t("حساب الإعلانات مرتبط", "Ad account connected")}
              </div>
              <div style={{ fontSize: 12, color: c.dim, marginTop: 5 }}>
                {(me.advertisers || []).map((a) => a.name).join(" · ") || t("جاهز", "Ready")}
              </div>
            </div>
            <button onClick={() => router.push("/tiktok-ads/create")}
              style={{ background: G_TT, color: "#fff", border: "none", borderRadius: 11, padding: "11px 18px", fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>
              {t("ابدأ حملة", "Start a campaign")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
