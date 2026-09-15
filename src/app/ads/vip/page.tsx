"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Crown, Headphones, Sparkles, Infinity as InfinityIcon, Check, ArrowLeft, ArrowRight,
  Loader2, Wallet, CheckCircle, AlertCircle,
} from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useTheme } from "@/hooks/useTheme";
import LangToggle from "@/components/LangToggle";
import AdsBottomNav from "@/components/AdsBottomNav";

const GOLD = "#f0b429";
const G_GOLD = "linear-gradient(135deg,#f0b429,#ff9d2f)";

interface VipState { vip: boolean; until: string | null; permanent: boolean; price: number; balance: number; }

export default function VipPage() {
  const router = useRouter();
  const { t, rtl } = useLang();
  const { light } = useTheme();
  const Back = rtl ? ArrowLeft : ArrowRight;

  const c = light ? {
    bg: "#fbf7ff", text: "#1e1330", muted: "#6b5b78", dim: "#8b7d97", surface: "#ffffff", border: "rgba(120,60,160,0.14)",
  } : {
    bg: "#100a18", text: "#f6eefb", muted: "#a394b0", dim: "#7a6d88", surface: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.10)",
  };

  const [st, setSt] = useState<VipState | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/promo/vip");
    if (r.status === 401) { router.push("/login?next=/ads/vip"); return; }
    setSt(await r.json());
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function subscribe() {
    setError(""); setSubscribing(true);
    const r = await fetch("/api/promo/vip", { method: "POST" });
    const d = await r.json();
    setSubscribing(false);
    if (!r.ok) {
      if (d.error === "insufficient_balance") setError(t("رصيد المحفظة غير كافٍ — اشحن محفظتك أولاً", "Wallet balance too low — top up your wallet first"));
      else setError(d.message || d.error || t("حدث خطأ", "Something went wrong"));
      return;
    }
    setDone(true);
    load();
  }

  const benefits = [
    { icon: InfinityIcon, title: t("ميزانية وأيام بلا حدود", "Unlimited budget & days"), desc: t("موّل منشوراتك بالدولار بأي قيمة ومدة تريدها.", "Fund your posts in USD — any amount, any duration.") },
    { icon: Headphones,   title: t("دعم متواصل 24/7", "24/7 dedicated support"), desc: t("فريق مخصّص يساعدك في أي وقت.", "A dedicated team to help you anytime.") },
    { icon: Sparkles,     title: t("مساعد ذكاء اصطناعي", "AI campaign assistant"), desc: t("أخبره بهدفك ويقترح لك أفضل استهداف وميزانية.", "Tell it your goal; it suggests the best targeting & budget.") },
    { icon: Check,        title: t("بدون عمولة + أولوية تشغيل", "Zero commission + priority"), desc: t("تدفع سعر الإعلان فقط، وحملاتك تُطلق أولاً.", "Pay only the ad cost, and your campaigns launch first.") },
  ];

  if (loading || !st) {
    return <div style={{ minHeight: "100vh", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 size={32} color={GOLD} className="spin" /><style>{`@keyframes spin-anim{to{transform:rotate(360deg)}}.spin{animation:spin-anim 1s linear infinite}`}</style></div>;
  }

  const expiry = st.until ? new Date(st.until).toLocaleDateString(rtl ? "ar-LY" : "en-GB") : null;

  return (
    <div style={{ minHeight: "100vh", background: c.bg, color: c.text, fontFamily: "Cairo,sans-serif", direction: rtl ? "rtl" : "ltr", paddingBottom: 96, transition: "background .2s,color .2s" }}>

      <div style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 12, maxWidth: 640, margin: "0 auto" }}>
        <button onClick={() => router.push("/ads")} style={{ background: "none", border: "none", color: c.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
          <Back size={18} /> {t("رجوع", "Back")}
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>{t("عضوية VIP", "VIP membership")}</h1>
        <div style={{ marginInlineStart: "auto" }}><LangToggle /></div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "12px 18px" }}>

        {/* Hero card */}
        <div style={{ borderRadius: 24, padding: "30px 24px", background: "linear-gradient(135deg,#171226,#241a3a)", border: `1px solid ${GOLD}55`, position: "relative", overflow: "hidden", textAlign: "center" }}>
          <div style={{ position: "absolute", top: -40, insetInlineStart: "50%", transform: "translateX(-50%)", width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle,${GOLD}33,transparent 70%)` }} />
          <div style={{ position: "relative" }}>
            <div style={{ width: 60, height: 60, margin: "0 auto 14px", borderRadius: 18, background: G_GOLD, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 12px 30px ${GOLD}55` }}>
              <Crown size={30} color="#1a1330" />
            </div>
            {st.vip ? (
              <>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{t("أنت عضو VIP ⭐", "You're a VIP ⭐")}</div>
                <div style={{ fontSize: 13, color: "#c9b98a", marginTop: 6 }}>
                  {st.permanent ? t("عضوية دائمة", "Permanent membership") : (expiry ? t(`تنتهي في ${expiry}`, `Expires ${expiry}`) : "")}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{t("ارتقِ إلى VIP", "Go VIP")}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, justifyContent: "center", marginTop: 8 }}>
                  <span style={{ fontSize: 40, fontWeight: 900, color: GOLD }}>{st.price}</span>
                  <span style={{ fontSize: 14, color: "#c9b98a" }}>{t("د.ل / شهرياً", "LYD / month")}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Benefits */}
        <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 18 }}>
          {benefits.map((b) => (
            <div key={b.title} style={{ display: "flex", gap: 14, background: c.surface, border: `1px solid ${c.border}`, borderRadius: 16, padding: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: `${GOLD}22`, border: `1px solid ${GOLD}55`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <b.icon size={20} color={GOLD} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{b.title}</div>
                <div style={{ color: c.muted, fontSize: 13, lineHeight: 1.6, marginTop: 2 }}>{b.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Wallet + status messages */}
        {!st.vip && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, color: c.muted, fontSize: 13, justifyContent: "center" }}>
            <Wallet size={15} color={GOLD} /> {t("رصيد محفظتك:", "Wallet balance:")} <strong style={{ color: c.text }}>{st.balance} {t("د.ل", "LYD")}</strong>
          </div>
        )}

        {done && (
          <div style={{ marginTop: 14, background: "rgba(34,197,94,0.12)", border: "1px solid #22c55e55", borderRadius: 14, padding: "12px 16px", color: "#22c55e", display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
            <CheckCircle size={17} /> {t("تم تفعيل عضوية VIP بنجاح! 🎉", "VIP membership activated! 🎉")}
          </div>
        )}
        {error && (
          <div style={{ marginTop: 14, background: "rgba(239,68,68,0.12)", border: "1px solid #ef444455", borderRadius: 14, padding: "12px 16px", color: "#ef4444", display: "flex", alignItems: "center", gap: 10 }}>
            <AlertCircle size={17} />
            <span style={{ flex: 1 }}>{error}</span>
            {error.includes(t("اشحن", "top up")) && (
              <button onClick={() => router.push("/ads")} style={{ background: "none", border: "none", color: "#fca5a5", fontWeight: 800, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}>{t("المحفظة", "Wallet")}</button>
            )}
          </div>
        )}

        {/* CTA */}
        <button
          onClick={st.vip ? () => router.push("/ads/create") : subscribe}
          disabled={subscribing}
          style={{ width: "100%", marginTop: 18, background: G_GOLD, border: "none", borderRadius: 15, padding: "16px 0", color: "#1a1330", fontWeight: 900, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: subscribing ? 0.7 : 1, fontFamily: "inherit" }}>
          {subscribing ? <Loader2 size={20} className="spin" /> : <Crown size={20} />}
          {st.vip ? t("أنشئ حملة حرة الآن", "Create a free campaign now") : t(`اشترك الآن — ${st.price} د.ل`, `Subscribe now — ${st.price} LYD`)}
        </button>

        {st.vip && !st.permanent && (
          <button onClick={subscribe} disabled={subscribing}
            style={{ width: "100%", marginTop: 10, background: "transparent", border: `1px solid ${GOLD}55`, borderRadius: 13, padding: "12px 0", color: GOLD, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
            {t(`تجديد شهر إضافي — ${st.price} د.ل`, `Renew one more month — ${st.price} LYD`)}
          </button>
        )}
      </div>

      <AdsBottomNav />
      <style>{`@keyframes spin-anim{to{transform:rotate(360deg)}}.spin{animation:spin-anim 1s linear infinite}`}</style>
    </div>
  );
}
