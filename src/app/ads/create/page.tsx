"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Link2, DollarSign, Calendar, Globe,
  Loader2, CheckCircle, AlertCircle, ChevronDown,
} from "lucide-react";
import { Suspense } from "react";
import { PACKAGES, calculateFees } from "@/services/campaigns";

const GRADIENT = "linear-gradient(135deg, #0f0f1a 0%, #0d1b2a 100%)";
const BLUE     = "#1877f2";
const CARD_BG  = "rgba(255,255,255,0.04)";

interface ConnectedPage { id: string; page_id: string; page_name: string; page_picture?: string; }

const INPUT_STYLE: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 14, outline: "none",
  boxSizing: "border-box",
};

function CreateCampaignInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const pkgId        = searchParams.get("pkg");

  const [pages, setPages]   = useState<ConnectedPage[]>([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [postUrl, setPostUrl]   = useState("");
  const [budget, setBudget]     = useState("");
  const [days, setDays]         = useState("7");
  const [usePackage, setUsePackage] = useState<string | null>(pkgId);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [loadingPages, setLoadingPages] = useState(true);

  const pkg  = PACKAGES.find((p) => p.id === usePackage);
  const fees = pkg
    ? { budget: pkg.budget, serviceFee: pkg.serviceFee, total: pkg.total }
    : budget ? calculateFees(Number(budget)) : null;

  useEffect(() => {
    fetch("/api/ads/pages")
      .then((r) => r.json())
      .then((d) => {
        const p = d.pages || [];
        setPages(p);
        if (p.length > 0) setSelectedPage(p[0].page_id);
        setLoadingPages(false);
      });
  }, []);

  async function submit() {
    setError("");
    if (!selectedPage) { setError("اختر صفحتك أولاً"); return; }
    if (!postUrl)       { setError("أدخل رابط المنشور"); return; }

    const budgetVal = pkg ? pkg.budget : Number(budget);
    const daysVal   = pkg ? pkg.durationDays : Number(days);

    if (!pkg && (!budgetVal || budgetVal < 20)) { setError("الحد الأدنى للميزانية 20 د.ل"); return; }
    if (!pkg && (!daysVal   || daysVal < 1))    { setError("المدة يجب أن تكون يوم واحد على الأقل"); return; }

    setSaving(true);
    const page = pages.find((p) => p.page_id === selectedPage);
    const res  = await fetch("/api/ads/campaigns", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pageId:      selectedPage,
        pageName:    page?.page_name,
        postUrl,
        budget:      budgetVal,
        durationDays: daysVal,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "حدث خطأ");
      setSaving(false);
      return;
    }
    router.push(`/ads/checkout?campaignId=${data.campaign.id}`);
  }

  if (loadingPages) {
    return (
      <div style={{ minHeight: "100vh", background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={32} color={BLUE} className="spin" />
        <style>{`@keyframes spin-anim{to{transform:rotate(360deg)}} .spin{animation:spin-anim 1s linear infinite}`}</style>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: GRADIENT, color: "#fff", fontFamily: "Cairo,sans-serif", direction: "rtl", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, padding: 24 }}>
        <AlertCircle size={48} color="#f59e0b" />
        <p style={{ fontSize: 16, color: "#94a3b8", textAlign: "center" }}>يجب ربط صفحة فيسبوك أولاً قبل إنشاء حملة</p>
        <button onClick={() => router.push("/ads/connect")}
          style={{ background: `linear-gradient(135deg,${BLUE},#6b46c1)`, border: "none", borderRadius: 12, padding: "12px 28px", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 15 }}>
          ربط صفحة الآن
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: GRADIENT, color: "#fff", fontFamily: "Cairo,sans-serif", direction: "rtl", paddingBottom: 80 }}>

      <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.push("/ads/connect")} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <ArrowLeft size={18} /> رجوع
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>إنشاء حملة إعلانية</h1>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "36px 24px", display: "grid", gap: 24 }}>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid #ef444440", borderRadius: 12, padding: "12px 16px", color: "#fca5a5", display: "flex", gap: 10, alignItems: "center" }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Page selector */}
        <div style={{ background: CARD_BG, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
          <label style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, display: "block" }}>
            <Globe size={16} style={{ verticalAlign: "middle", marginLeft: 6 }} />
            الصفحة المراد تمويل منشورها
          </label>
          <div style={{ position: "relative" }}>
            <select value={selectedPage} onChange={(e) => setSelectedPage(e.target.value)}
              style={{ ...INPUT_STYLE, appearance: "none", paddingLeft: 36 }}>
              {pages.map((p) => (
                <option key={p.id} value={p.page_id}>{p.page_name}</option>
              ))}
            </select>
            <ChevronDown size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
          </div>
        </div>

        {/* Post URL */}
        <div style={{ background: CARD_BG, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
          <label style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, display: "block" }}>
            <Link2 size={16} style={{ verticalAlign: "middle", marginLeft: 6 }} />
            رابط المنشور
          </label>
          <input
            type="url"
            value={postUrl}
            onChange={(e) => setPostUrl(e.target.value)}
            placeholder="https://www.facebook.com/PageName/posts/123456..."
            style={INPUT_STYLE}
          />
          <p style={{ color: "#64748b", fontSize: 12, marginTop: 8, lineHeight: 1.6 }}>
            افتح المنشور من صفحتك، انقر على &#34;نسخ الرابط&#34;، والصقه هنا
          </p>
        </div>

        {/* Packages */}
        <div style={{ background: CARD_BG, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
          <label style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, display: "block" }}>
            <DollarSign size={16} style={{ verticalAlign: "middle", marginLeft: 6 }} />
            اختر الباقة أو ادخل ميزانية مخصصة
          </label>

          {/* Package chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
            {PACKAGES.map((p) => (
              <button key={p.id} onClick={() => { setUsePackage(p.id); setBudget(""); setDays(String(p.durationDays)); }}
                style={{ padding: "8px 16px", borderRadius: 100, border: usePackage === p.id ? `1px solid ${BLUE}` : "1px solid rgba(255,255,255,0.12)", background: usePackage === p.id ? `${BLUE}22` : "transparent", color: usePackage === p.id ? "#93c5fd" : "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: usePackage === p.id ? 700 : 400, transition: "all 0.2s" }}>
                {p.name} — {p.total} د.ل
              </button>
            ))}
            <button onClick={() => setUsePackage(null)}
              style={{ padding: "8px 16px", borderRadius: 100, border: usePackage === null ? `1px solid ${BLUE}` : "1px solid rgba(255,255,255,0.12)", background: usePackage === null ? `${BLUE}22` : "transparent", color: usePackage === null ? "#93c5fd" : "#94a3b8", cursor: "pointer", fontSize: 13 }}>
              مخصص
            </button>
          </div>

          {usePackage && pkg ? (
            <div style={{ background: "rgba(24,119,242,0.08)", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { label: "ميزانية الإعلان", val: `${pkg.budget} د.ل` },
                { label: "المدة", val: `${pkg.durationDays} أيام` },
                { label: "رسوم الخدمة", val: `${pkg.serviceFee} د.ل` },
              ].map((r) => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#94a3b8" }}>
                  <span>{r.label}</span><span>{r.val}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 6 }}>الميزانية (د.ل)</label>
                <input type="number" min={20} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="مثال: 150" style={INPUT_STYLE} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 6 }}>المدة (أيام)</label>
                <input type="number" min={1} max={30} value={days} onChange={(e) => setDays(e.target.value)} placeholder="7" style={INPUT_STYLE} />
              </div>
            </div>
          )}
        </div>

        {/* Price summary */}
        {fees && (
          <div style={{ background: "rgba(24,119,242,0.08)", border: `1px solid ${BLUE}30`, borderRadius: 16, padding: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "ميزانية الإعلان", val: `${fees.budget} د.ل`, sub: true },
                { label: "رسوم الخدمة",    val: `${fees.serviceFee} د.ل`, sub: true },
              ].map((r) => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8", fontSize: 14 }}>
                  <span>{r.label}</span><span>{r.val}</span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10, display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 18 }}>
                <span>الإجمالي</span>
                <span style={{ color: "#93c5fd" }}>{fees.total} د.ل</span>
              </div>
            </div>
          </div>
        )}

        {/* Duration note */}
        <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "#fbbf24", display: "flex", alignItems: "flex-start", gap: 10 }}>
          <Calendar size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>الاستهداف الافتراضي: <strong>ليبيا كاملة، كل المدن، عمر 18–65</strong>. يمكنك طلب استهداف مخصص عبر الدعم.</span>
        </div>

        {/* Submit */}
        <button onClick={submit} disabled={saving}
          style={{ width: "100%", background: `linear-gradient(135deg,${BLUE},#6b46c1)`, border: "none", borderRadius: 14, padding: "16px 0", color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: saving ? 0.7 : 1 }}>
          {saving ? <Loader2 size={20} className="spin" /> : <CheckCircle size={20} />}
          {saving ? "جارٍ الحفظ..." : "التالي — الدفع"}
        </button>
      </div>

      <style>{`@keyframes spin-anim{to{transform:rotate(360deg)}} .spin{animation:spin-anim 1s linear infinite}`}</style>
    </div>
  );
}

export default function CreatePage() {
  return <Suspense><CreateCampaignInner /></Suspense>;
}
