"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Wallet, Loader2, AlertCircle, CheckCircle, Phone, CreditCard } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useTheme } from "@/hooks/useTheme";
import LangToggle from "@/components/LangToggle";
import WalletModal from "@/components/WalletModal";

const G_HERO = "linear-gradient(140deg,#6d28d9 0%,#d6409f 55%,#ff7a59 100%)";
const METHOD_GRADS: Record<string, string> = {
  edfali:   "linear-gradient(135deg,#10b981,#22d3ee)",
  moamalat: "linear-gradient(135deg,#f59e0b,#ef4444)",
  mobicash: "linear-gradient(135deg,#3b82f6,#22d3ee)",
  wallet:   "linear-gradient(135deg,#a855f7,#ec4899)",
};

interface Campaign {
  id:          string;
  budget:      number;
  service_fee: number;
  total_price: number;
  duration_days: number;
  page_name?:  string;
  post_url:    string;
}

const PAY_METHODS = [
  { id: "edfali",   label: "ادفع لي",    labelEn: "Edfali",   tag: "ادفع", needsPhone: true  },
  { id: "moamalat", label: "معاملات",    labelEn: "Moamalat", tag: "معاملات", needsPhone: true  },
  { id: "mobicash", label: "موبي كاش",   labelEn: "MobiCash", tag: "موبي", needsPhone: false, needsCard: true },
  { id: "wallet",   label: "المحفظة",    labelEn: "Wallet",   tag: "محفظة", needsPhone: false },
];

function CheckoutInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const campaignId   = searchParams.get("campaignId");
  const { t, rtl } = useLang();
  const { light } = useTheme();
  const Back = rtl ? ArrowLeft : ArrowRight;
  const LYD  = t("د.ل", "LYD");

  const c = light ? {
    bg: "#fbf7ff", text: "#1e1330", muted: "#6b5b78", dim: "#8b7d97",
    surface: "#ffffff", border: "rgba(120,60,160,0.14)", inputBg: "#f4eefb",
  } : {
    bg: "#100a18", text: "#f6eefb", muted: "#a394b0", dim: "#7a6d88",
    surface: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.10)", inputBg: "rgba(255,255,255,0.06)",
  };

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [method, setMethod]     = useState("edfali");
  const [phone, setPhone]       = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [otpStep, setOtpStep]   = useState(false);
  const [otp, setOtp]           = useState("");
  const [loading, setLoading]   = useState(true);
  const [paying, setPaying]     = useState(false);
  const [error, setError]       = useState("");
  const [payNeed, setPayNeed]   = useState<{ amount: number; label: string } | null>(null);

  useEffect(() => {
    if (!campaignId) { router.push("/ads/create"); return; }
    fetch(`/api/promo/campaigns/${campaignId}`)
      .then((r) => r.json())
      .then((d) => { setCampaign(d.campaign); setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  async function pay() {
    if (!campaign) return;
    setError("");
    const chosen = PAY_METHODS.find((m) => m.id === method);
    if (chosen?.needsPhone && !phone) { setError(t("رقم الهاتف مطلوب لهذه الطريقة", "A phone number is required for this method")); return; }
    if (chosen?.needsCard && cardNumber.replace(/\D/g, "").length < 5) {
      setError(t("رقم البطاقة مطلوب لهذه الطريقة", "A card number is required for this method")); return;
    }

    setPaying(true);
    const res  = await fetch("/api/promo/checkout", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: campaign.id, method, phone, cardNumber: cardNumber.replace(/\D/g, "") }),
    });
    const data = await res.json();

    if (!res.ok) {
      if (data.error === "insufficient_balance") {
        // Pay the shortfall right here, then the checkout runs itself again.
        const need = Math.max(0, Number(data.price ?? 0) - Number(data.balance ?? 0));
        setPayNeed({ amount: Math.ceil(need), label: t("دفع قيمة الحملة", "Campaign payment") });
        setPaying(false);
        return;
      }
      setError(data.message || data.error || t("حدث خطأ في الدفع", "A payment error occurred"));
      setPaying(false);
      return;
    }
    if (data.mobicash) { setOtpStep(true); setPaying(false); return; }
    if (data.redirect) { router.push(data.redirect); }
    else if (data.paymentLink) { window.location.href = data.paymentLink; }
    else { setError(t("لم نتلق رابط الدفع", "We didn't receive a payment link")); setPaying(false); }
  }

  async function confirmOtp() {
    if (!campaign || otp.length < 4) return;
    setError("");
    setPaying(true);
    const res  = await fetch("/api/promo/mobicash-verify", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: campaign.id, otp }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) { setError(data.error || t("رمز التحقق غير صحيح", "Invalid verification code")); setPaying(false); return; }
    router.push(data.redirect || "/ads/campaigns?paid=1");
  }

  if (loading || !campaign) {
    return (
      <div style={{ minHeight: "100vh", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={32} color="#d6409f" className="spin" />
        <style>{`@keyframes spin-anim{to{transform:rotate(360deg)}} .spin{animation:spin-anim 1s linear infinite}`}</style>
      </div>
    );
  }

  const selectedMethod = PAY_METHODS.find((m) => m.id === method)!;
  const inputStyle: React.CSSProperties = {
    width: "100%", background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: 12,
    padding: "13px 14px", color: c.text, fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  };

  return (
    <div style={{ minHeight: "100vh", background: c.bg, color: c.text, fontFamily: "Cairo,sans-serif", direction: rtl ? "rtl" : "ltr", paddingBottom: 80, transition: "background .2s,color .2s" }}>

      <div style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 12, maxWidth: 560, margin: "0 auto" }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: c.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
          <Back size={18} /> {t("رجوع", "Back")}
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>{t("تأكيد الدفع", "Confirm payment")}</h1>
        <div style={{ marginInlineStart: "auto" }}><LangToggle /></div>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "14px 18px", display: "grid", gap: 16 }}>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid #ef444455", borderRadius: 14, padding: "12px 16px", color: "#f87171", display: "flex", gap: 10, alignItems: "center" }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Order summary */}
        <div style={{ background: c.surface, border: `2px solid ${c.border}`, borderRadius: 20, padding: 22 }}>
          {campaign.page_name && <div style={{ fontSize: 13, color: c.muted, marginBottom: 3 }}>{t("حملة صفحة · ", "Page campaign · ")}{campaign.page_name}</div>}
          {[
            { label: t("ميزانية الإعلان", "Ad budget"), val: `${campaign.budget} ${LYD}` },
            { label: t("المدة", "Duration"),            val: t(`${campaign.duration_days} أيام`, `${campaign.duration_days} days`) },
            { label: t("رسوم الخدمة", "Service fee"),   val: `${campaign.service_fee} ${LYD}` },
          ].map((r) => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${c.border}`, fontSize: 14, color: c.muted }}>
              <span>{r.label}</span><span style={{ color: c.text, fontWeight: 600 }}>{r.val}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", paddingTop: 15 }}>
            <span style={{ fontWeight: 800, fontSize: 15 }}>{t("الإجمالي", "Total")}</span>
            <span style={{ fontWeight: 900, fontSize: 30, background: G_HERO, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{campaign.total_price} <span style={{ fontSize: 15, WebkitTextFillColor: c.muted }}>{LYD}</span></span>
          </div>
        </div>

        {/* Payment methods */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 900, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
            <Wallet size={17} color="#d6409f" /> {t("اختر طريقة الدفع", "Payment method")}
          </h2>
          {!otpStep && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              {PAY_METHODS.map((m) => {
                const on = method === m.id;
                return (
                  <button key={m.id} onClick={() => setMethod(m.id)}
                    style={{ display: "flex", alignItems: "center", gap: 13, padding: "14px 16px", borderRadius: 15, border: on ? "2px solid #d6409f" : `2px solid ${c.border}`, background: on ? "rgba(214,64,159,0.08)" : c.surface, cursor: "pointer", fontFamily: "inherit", textAlign: "start" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: METHOD_GRADS[m.id], display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 800, fontSize: 12, color: "#fff" }}>{m.tag}</div>
                    <div style={{ flex: 1, fontWeight: 800, fontSize: 15, color: c.text }}>{t(m.label, m.labelEn)}</div>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", border: on ? "none" : `2px solid ${c.border}`, background: on ? G_HERO : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {on && <CheckCircle size={16} color="#fff" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selectedMethod.needsCard && !otpStep && (
            <div>
              <label style={{ fontSize: 12, color: c.muted, display: "block", marginBottom: 6 }}>
                <CreditCard size={12} style={{ verticalAlign: "middle", marginInlineEnd: 4 }} />
                {t("رقم بطاقة موبي كاش", "MobiCash card number")}
              </label>
              <input type="tel" inputMode="numeric" value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, "").slice(0, 19))}
                placeholder={t("رقم البطاقة", "Card number")} style={{ ...inputStyle, direction: "ltr" }} />
              <p style={{ fontSize: 11, color: c.dim, marginTop: 6 }}>
                {t("سيصلك رمز تحقق على هاتفك المرتبط بالبطاقة", "A verification code will be sent to the phone linked to the card")}
              </p>
            </div>
          )}

          {otpStep && (
            <div>
              <label style={{ fontSize: 12, color: c.muted, display: "block", marginBottom: 6 }}>
                {t("رمز التحقق — صالح لمدة 5 دقائق", "Verification code — valid for 5 minutes")}
              </label>
              <input type="tel" inputMode="numeric" value={otp} autoFocus
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="000000"
                style={{ ...inputStyle, direction: "ltr", textAlign: "center", fontSize: 24, fontWeight: 800, letterSpacing: 6 }} />
              <button onClick={() => { setOtpStep(false); setOtp(""); setError(""); }}
                style={{ background: "none", border: "none", color: c.dim, fontSize: 12, marginTop: 10, cursor: "pointer", fontFamily: "inherit" }}>
                {t("← رجوع لتغيير البطاقة", "← Back to change the card")}
              </button>
            </div>
          )}

          {selectedMethod.needsPhone && (
            <div>
              <label style={{ fontSize: 12, color: c.muted, display: "block", marginBottom: 6 }}>
                <Phone size={12} style={{ verticalAlign: "middle", marginInlineEnd: 4 }} />
                {t("رقم الهاتف المرتبط بـ ", "Phone number linked to ")}{t(selectedMethod.label, selectedMethod.labelEn)}
              </label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09XXXXXXXX" style={inputStyle} />
            </div>
          )}
        </div>

        {/* Pay button */}
        <button onClick={otpStep ? confirmOtp : pay} disabled={paying || (otpStep && otp.length < 4)}
          style={{ width: "100%", background: G_HERO, border: "none", borderRadius: 15, padding: "17px 0", color: "#fff", fontWeight: 900, fontSize: 17, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: paying ? 0.7 : 1, fontFamily: "inherit" }}>
          {paying ? <Loader2 size={20} className="spin" /> : <CheckCircle size={20} />}
          {paying ? t("جارٍ المعالجة...", "Processing...") : otpStep ? t("تأكيد الدفع ✓", "Confirm payment ✓") : t(`ادفع ${campaign.total_price} د.ل`, `Pay ${campaign.total_price} LYD`)}
        </button>

        <p style={{ textAlign: "center", fontSize: 12, color: c.dim, lineHeight: 1.7 }}>
          {t("دفع محلي آمن · تبدأ حملتك خلال دقائق من تأكيد الدفع.", "Local secure payment · Your campaign starts within minutes of confirmation.")}
        </p>
      </div>

      <style>{`@keyframes spin-anim{to{transform:rotate(360deg)}} .spin{animation:spin-anim 1s linear infinite}`}</style>

      {payNeed && (
        <WalletModal
          payAmount={payNeed.amount}
          payLabel={payNeed.label}
          onPaid={() => { setPayNeed(null); pay(); }}
          onClose={() => setPayNeed(null)}
        />
      )}

    </div>
  );
}

export default function CheckoutPage() {
  return <Suspense><CheckoutInner /></Suspense>;
}
