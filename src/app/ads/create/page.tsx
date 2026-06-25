"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Link2, DollarSign, Calendar, Globe,
  Loader2, CheckCircle, AlertCircle, ChevronDown,
} from "lucide-react";
import { Suspense } from "react";
import { PACKAGES, calculateFees } from "@/services/campaigns";
import { useLang } from "@/hooks/useLang";
import LangToggle from "@/components/LangToggle";

const GRADIENT = "linear-gradient(135deg, #0f0f1a 0%, #0d1b2a 100%)";
const BLUE     = "#1877f2";
const CARD_BG  = "rgba(255,255,255,0.04)";

interface ConnectedPage { id: string; page_id: string; page_name: string; page_picture?: string; }
interface PagePost { id: string; postId: string; message: string; createdTime: string; picture?: string; permalinkUrl?: string; }

const INPUT_STYLE: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 14, outline: "none",
  boxSizing: "border-box",
};

function CreateCampaignInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const pkgId        = searchParams.get("pkg");
  const { t, rtl } = useLang();
  const Back = rtl ? ArrowLeft : ArrowRight;
  const LYD  = t("د.ل", "LYD");

  const [pages, setPages]   = useState<ConnectedPage[]>([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [postUrl, setPostUrl]   = useState("");
  const [posts, setPosts]       = useState<PagePost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState("");
  const [manualMode, setManualMode] = useState(false);
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
    fetch("/api/promo/pages")
      .then((r) => r.json())
      .then((d) => {
        const p = d.pages || [];
        setPages(p);
        if (p.length > 0) setSelectedPage(p[0].page_id);
        setLoadingPages(false);
      });
  }, []);

  // Load the selected Page's posts (reads via pages_read_engagement)
  useEffect(() => {
    if (!selectedPage) return;
    setLoadingPosts(true);
    setSelectedPostId("");
    setPostUrl("");
    fetch(`/api/promo/posts?pageId=${encodeURIComponent(selectedPage)}`)
      .then((r) => r.json())
      .then((d) => { setPosts(d.posts || []); setLoadingPosts(false); })
      .catch(() => { setPosts([]); setLoadingPosts(false); });
  }, [selectedPage]);

  function pickPost(p: PagePost) {
    setSelectedPostId(p.id);
    setPostUrl(`https://www.facebook.com/${selectedPage}/posts/${p.postId}`);
  }

  async function submit() {
    setError("");
    if (!selectedPage) { setError(t("اختر صفحتك أولاً", "Select your Page first")); return; }
    if (!postUrl)       { setError(t("اختر منشورًا أو الصق رابطًا", "Select a post or paste a link")); return; }

    const budgetVal = pkg ? pkg.budget : Number(budget);
    const daysVal   = pkg ? pkg.durationDays : Number(days);

    if (!pkg && (!budgetVal || budgetVal < 20)) { setError(t("الحد الأدنى للميزانية 20 د.ل", "Minimum budget is 20 LYD")); return; }
    if (!pkg && (!daysVal   || daysVal < 1))    { setError(t("المدة يجب أن تكون يوم واحد على الأقل", "Duration must be at least one day")); return; }

    setSaving(true);
    const page = pages.find((p) => p.page_id === selectedPage);
    const res  = await fetch("/api/promo/campaigns", {
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
      setError(data.error || t("حدث خطأ", "Something went wrong"));
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
      <div style={{ minHeight: "100vh", background: GRADIENT, color: "#fff", fontFamily: "Cairo,sans-serif", direction: rtl ? "rtl" : "ltr", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, padding: 24 }}>
        <AlertCircle size={48} color="#f59e0b" />
        <p style={{ fontSize: 16, color: "#94a3b8", textAlign: "center" }}>{t("يجب ربط صفحة فيسبوك أولاً قبل إنشاء حملة", "You must connect a Facebook Page before creating a campaign")}</p>
        <button onClick={() => router.push("/ads/connect")}
          style={{ background: `linear-gradient(135deg,${BLUE},#6b46c1)`, border: "none", borderRadius: 12, padding: "12px 28px", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 15 }}>
          {t("ربط صفحة الآن", "Connect a Page now")}
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: GRADIENT, color: "#fff", fontFamily: "Cairo,sans-serif", direction: rtl ? "rtl" : "ltr", paddingBottom: 80 }}>

      <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.push("/ads/connect")} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Back size={18} /> {t("رجوع", "Back")}
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{t("إنشاء حملة إعلانية", "Create a campaign")}</h1>
        <div style={{ marginInlineStart: "auto" }}><LangToggle /></div>
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
            <Globe size={16} style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
            {t("الصفحة المراد تمويل منشورها", "The Page whose post you want to boost")}
          </label>
          <div style={{ position: "relative" }}>
            <select value={selectedPage} onChange={(e) => setSelectedPage(e.target.value)}
              style={{ ...INPUT_STYLE, appearance: "none", paddingInlineStart: 36 }}>
              {pages.map((p) => (
                <option key={p.id} value={p.page_id}>{p.page_name}</option>
              ))}
            </select>
            <ChevronDown size={16} style={{ position: "absolute", insetInlineStart: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
          </div>
        </div>

        {/* Post selector */}
        <div style={{ background: CARD_BG, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12 }}>
            <label style={{ fontWeight: 700, fontSize: 14 }}>
              <Link2 size={16} style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
              {t("المنشور المراد تمويله", "The post to boost")}
            </label>
            <button type="button" onClick={() => setManualMode((m) => !m)}
              style={{ background: "none", border: "none", color: "#93c5fd", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              {manualMode ? t("اختيار من المنشورات", "Pick from posts") : t("أو الصق رابطًا", "Or paste a link")}
            </button>
          </div>

          {manualMode ? (
            <>
              <input
                type="url"
                value={postUrl}
                onChange={(e) => { setPostUrl(e.target.value); setSelectedPostId(""); }}
                placeholder="https://www.facebook.com/PageName/posts/123456..."
                style={INPUT_STYLE}
              />
              <p style={{ color: "#64748b", fontSize: 12, marginTop: 8, lineHeight: 1.6 }}>
                {t("افتح المنشور من صفحتك، انقر على “نسخ الرابط”، والصقه هنا",
                   "Open the post on your Page, tap “Copy link”, and paste it here")}
              </p>
            </>
          ) : loadingPosts ? (
            <div style={{ textAlign: "center", padding: 24, color: "#64748b" }}>
              <Loader2 size={22} className="spin" />
            </div>
          ) : posts.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.7 }}>
              {t("لا توجد منشورات على هذه الصفحة، أو تعذّر تحميلها. استخدم “الصق رابطًا”.",
                 "No posts found on this Page, or they couldn't be loaded. Use “Or paste a link”.")}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 340, overflowY: "auto" }}>
              {posts.map((p) => {
                const active = selectedPostId === p.id;
                return (
                  <button key={p.id} type="button" onClick={() => pickPost(p)}
                    style={{ display: "flex", gap: 12, alignItems: "center", textAlign: rtl ? "right" : "left",
                      padding: 10, borderRadius: 12, cursor: "pointer",
                      border: active ? `1px solid ${BLUE}` : "1px solid rgba(255,255,255,0.10)",
                      background: active ? `${BLUE}18` : "rgba(255,255,255,0.02)", transition: "all 0.15s" }}>
                    {p.picture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.picture} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 52, height: 52, borderRadius: 8, background: "rgba(255,255,255,0.06)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Globe size={20} color="#475569" />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {p.message ? (p.message.length > 90 ? p.message.slice(0, 90) + "…" : p.message) : t("(منشور بدون نص)", "(post with no text)")}
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>
                        {new Date(p.createdTime).toLocaleDateString(rtl ? "ar-LY" : "en-GB")}
                      </div>
                    </div>
                    {active && <CheckCircle size={18} color={BLUE} style={{ flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Packages */}
        <div style={{ background: CARD_BG, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
          <label style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, display: "block" }}>
            <DollarSign size={16} style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
            {t("اختر الباقة أو ادخل ميزانية مخصصة", "Choose a package or enter a custom budget")}
          </label>

          {/* Package chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
            {PACKAGES.map((p) => (
              <button key={p.id} onClick={() => { setUsePackage(p.id); setBudget(""); setDays(String(p.durationDays)); }}
                style={{ padding: "8px 16px", borderRadius: 100, border: usePackage === p.id ? `1px solid ${BLUE}` : "1px solid rgba(255,255,255,0.12)", background: usePackage === p.id ? `${BLUE}22` : "transparent", color: usePackage === p.id ? "#93c5fd" : "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: usePackage === p.id ? 700 : 400, transition: "all 0.2s" }}>
                {t(p.name, p.nameEn)} — {p.total} {LYD}
              </button>
            ))}
            <button onClick={() => setUsePackage(null)}
              style={{ padding: "8px 16px", borderRadius: 100, border: usePackage === null ? `1px solid ${BLUE}` : "1px solid rgba(255,255,255,0.12)", background: usePackage === null ? `${BLUE}22` : "transparent", color: usePackage === null ? "#93c5fd" : "#94a3b8", cursor: "pointer", fontSize: 13 }}>
              {t("مخصص", "Custom")}
            </button>
          </div>

          {usePackage && pkg ? (
            <div style={{ background: "rgba(24,119,242,0.08)", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { label: t("ميزانية الإعلان", "Ad budget"), val: `${pkg.budget} ${LYD}` },
                { label: t("المدة", "Duration"), val: t(`${pkg.durationDays} أيام`, `${pkg.durationDays} days`) },
                { label: t("رسوم الخدمة", "Service fee"), val: `${pkg.serviceFee} ${LYD}` },
              ].map((r) => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#94a3b8" }}>
                  <span>{r.label}</span><span>{r.val}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 6 }}>{t("الميزانية (د.ل)", "Budget (LYD)")}</label>
                <input type="number" min={20} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder={t("مثال: 150", "e.g. 150")} style={INPUT_STYLE} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 6 }}>{t("المدة (أيام)", "Duration (days)")}</label>
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
                { label: t("ميزانية الإعلان", "Ad budget"), val: `${fees.budget} ${LYD}` },
                { label: t("رسوم الخدمة", "Service fee"),    val: `${fees.serviceFee} ${LYD}` },
              ].map((r) => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8", fontSize: 14 }}>
                  <span>{r.label}</span><span>{r.val}</span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10, display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 18 }}>
                <span>{t("الإجمالي", "Total")}</span>
                <span style={{ color: "#93c5fd" }}>{fees.total} {LYD}</span>
              </div>
            </div>
          </div>
        )}

        {/* Duration note */}
        <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "#fbbf24", display: "flex", alignItems: "flex-start", gap: 10 }}>
          <Calendar size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{t("الاستهداف الافتراضي: ", "Default targeting: ")}<strong>{t("ليبيا كاملة، كل المدن، عمر 18–65", "all of Libya, all cities, ages 18–65")}</strong>{t(". يمكنك طلب استهداف مخصص عبر الدعم.", ". You can request custom targeting via support.")}</span>
        </div>

        {/* Submit */}
        <button onClick={submit} disabled={saving}
          style={{ width: "100%", background: `linear-gradient(135deg,${BLUE},#6b46c1)`, border: "none", borderRadius: 14, padding: "16px 0", color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: saving ? 0.7 : 1 }}>
          {saving ? <Loader2 size={20} className="spin" /> : <CheckCircle size={20} />}
          {saving ? t("جارٍ الحفظ...", "Saving...") : t("التالي — الدفع", "Next — payment")}
        </button>
      </div>

      <style>{`@keyframes spin-anim{to{transform:rotate(360deg)}} .spin{animation:spin-anim 1s linear infinite}`}</style>
    </div>
  );
}

export default function CreatePage() {
  return <Suspense><CreateCampaignInner /></Suspense>;
}
