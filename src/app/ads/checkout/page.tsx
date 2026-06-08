"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Wallet, Loader2, AlertCircle, CheckCircle, Phone } from "lucide-react";

const GRADIENT = "linear-gradient(135deg, #0f0f1a 0%, #0d1b2a 100%)";
const BLUE     = "#1877f2";
const CARD_BG  = "rgba(255,255,255,0.04)";

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
  { id: "edfali",   label: "ادفع لي",    needsPhone: true  },
  { id: "moamalat", label: "معاملات",    needsPhone: true  },
  { id: "mobicash", label: "موبي كاش",   needsPhone: false },
  { id: "wallet",   label: "المحفظة",    needsPhone: false },
];

const INPUT_STYLE: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 10, padding: "11px 14px", color: "#fff", fontSize: 14, outline: "none",
  boxSizing: "border-box",
};

function CheckoutInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const campaignId   = searchParams.get("campaignId");

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [method, setMethod]     = useState("edfali");
  const [phone, setPhone]       = useState("");
  const [loading, setLoading]   = useState(true);
  const [paying, setPaying]     = useState(false);
  const [error, setError]       = useState("");

  useEffect(() => {
    if (!campaignId) { router.push("/ads/create"); return; }
    fetch(`/api/ads/campaigns/${campaignId}`)
      .then((r) => r.json())
      .then((d) => { setCampaign(d.campaign); setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  async function pay() {
    if (!campaign) return;
    setError("");
    const needsPhone = PAY_METHODS.find((m) => m.id === method)?.needsPhone;
    if (needsPhone && !phone) { setError("رقم الهاتف مطلوب لهذه الطريقة"); return; }

    setPaying(true);
    const res  = await fetch("/api/ads/checkout", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: campaign.id, method, phone }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "حدث خطأ في الدفع");
      setPaying(false);
      return;
    }

    if (data.redirect) {
      router.push(data.redirect);
    } else if (data.paymentLink) {
      window.location.href = data.paymentLink;
    } else {
      setError("لم نتلق رابط الدفع");
      setPaying(false);
    }
  }

  if (loading || !campaign) {
    return (
      <div style={{ minHeight: "100vh", background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={32} color={BLUE} className="spin" />
        <style>{`@keyframes spin-anim{to{transform:rotate(360deg)}} .spin{animation:spin-anim 1s linear infinite}`}</style>
      </div>
    );
  }

  const selectedMethod = PAY_METHODS.find((m) => m.id === method)!;

  return (
    <div style={{ minHeight: "100vh", background: GRADIENT, color: "#fff", fontFamily: "Cairo,sans-serif", direction: "rtl", paddingBottom: 80 }}>

      <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <ArrowLeft size={18} /> رجوع
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>تأكيد الدفع</h1>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "36px 24px", display: "grid", gap: 20 }}>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid #ef444440", borderRadius: 12, padding: "12px 16px", color: "#fca5a5", display: "flex", gap: 10, alignItems: "center" }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Order summary */}
        <div style={{ background: CARD_BG, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>ملخص الحملة</h2>
          {campaign.page_name && (
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 4 }}>الصفحة: {campaign.page_name}</div>
          )}
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16, wordBreak: "break-all" }}>
            {campaign.post_url.length > 60 ? campaign.post_url.slice(0, 60) + "..." : campaign.post_url}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "ميزانية الإعلان", val: `${campaign.budget} د.ل` },
              { label: "المدة",            val: `${campaign.duration_days} أيام` },
              { label: "رسوم الخدمة",     val: `${campaign.service_fee} د.ل` },
            ].map((r) => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#94a3b8" }}>
                <span>{r.label}</span><span>{r.val}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12, display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 22 }}>
              <span>الإجمالي</span>
              <span style={{ color: "#93c5fd" }}>{campaign.total_price} د.ل</span>
            </div>
          </div>
        </div>

        {/* Payment method */}
        <div style={{ background: CARD_BG, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
            <Wallet size={16} style={{ verticalAlign: "middle", marginLeft: 6 }} />
            طريقة الدفع
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {PAY_METHODS.map((m) => (
              <button key={m.id} onClick={() => setMethod(m.id)}
                style={{ padding: "12px 14px", borderRadius: 10, border: method === m.id ? `1px solid ${BLUE}` : "1px solid rgba(255,255,255,0.10)", background: method === m.id ? `${BLUE}18` : "transparent", color: method === m.id ? "#93c5fd" : "#94a3b8", fontWeight: method === m.id ? 700 : 400, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.15s" }}>
                {m.id === "wallet" && <Wallet size={15} />}
                {m.label}
                {method === m.id && <CheckCircle size={14} />}
              </button>
            ))}
          </div>

          {selectedMethod.needsPhone && (
            <div>
              <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>
                <Phone size={12} style={{ verticalAlign: "middle", marginLeft: 4 }} />
                رقم الهاتف المرتبط بـ {selectedMethod.label}
              </label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="09XXXXXXXX" style={INPUT_STYLE} />
            </div>
          )}
        </div>

        {/* Pay button */}
        <button onClick={pay} disabled={paying}
          style={{ width: "100%", background: `linear-gradient(135deg,${BLUE},#6b46c1)`, border: "none", borderRadius: 14, padding: "17px 0", color: "#fff", fontWeight: 700, fontSize: 17, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: paying ? 0.7 : 1, boxShadow: "0 8px 24px rgba(24,119,242,0.3)" }}>
          {paying ? <Loader2 size={20} className="spin" /> : <CheckCircle size={20} />}
          {paying ? "جارٍ المعالجة..." : `ادفع ${campaign.total_price} د.ل`}
        </button>

        <p style={{ textAlign: "center", fontSize: 12, color: "#475569", lineHeight: 1.7 }}>
          بالضغط على الدفع توافق على الشروط والأحكام. ستبدأ حملتك خلال دقائق من تأكيد الدفع.
        </p>
      </div>

      <style>{`@keyframes spin-anim{to{transform:rotate(360deg)}} .spin{animation:spin-anim 1s linear infinite}`}</style>
    </div>
  );
}

export default function CheckoutPage() {
  return <Suspense><CheckoutInner /></Suspense>;
}
