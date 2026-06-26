"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Link2, DollarSign, Calendar, Globe,
  Loader2, CheckCircle, AlertCircle, ChevronDown, Search, X, MapPin, Users2, Target,
} from "lucide-react";
import { Suspense } from "react";
import { priceFor, mergeAdsPricing, DEFAULT_ADS_PRICING, type AdsPricing, type AdPackage, type Tier } from "@/services/campaigns";
import { useLang } from "@/hooks/useLang";
import LangToggle from "@/components/LangToggle";

const GRADIENT = "linear-gradient(135deg, #0f0f1a 0%, #0d1b2a 100%)";
const BLUE     = "#1877f2";
const CARD_BG  = "rgba(255,255,255,0.04)";

interface ConnectedPage { id: string; page_id: string; page_name: string; page_picture?: string; }
interface PagePost { id: string; postId: string; message: string; createdTime: string; picture?: string; permalinkUrl?: string; }
interface GeoCity { key: string; name: string; region?: string; }

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
  const [usdInput, setUsdInput] = useState("");
  const [days, setDays]         = useState("7");
  const [selectedPkgId, setSelectedPkgId] = useState<string | null>(pkgId);
  const [tier, setTier]         = useState<Tier>("regular");
  const [pricing, setPricing]   = useState<AdsPricing>(DEFAULT_ADS_PRICING);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [loadingPages, setLoadingPages] = useState(true);

  // Page selector (custom searchable dropdown — replaces the unreadable native <select>)
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const [pageSearch, setPageSearch]     = useState("");

  // Targeting
  const [cities, setCities]         = useState<GeoCity[]>([]);
  const [citySearch, setCitySearch] = useState("");
  const [cityResults, setCityResults] = useState<GeoCity[]>([]);
  const [citySearching, setCitySearching] = useState(false);
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(65);
  const [gender, setGender] = useState<"all" | "male" | "female">("all");

  const packages   = pricing.packages;
  const pkg        = packages.find((p) => p.id === selectedPkgId);
  const budgetUsd  = pkg ? pkg.usd : Number(usdInput) || 0;
  const daysVal    = pkg ? pkg.days : Number(days) || 0;
  const price      = budgetUsd > 0 ? priceFor(budgetUsd, tier, pricing) : null;

  useEffect(() => {
    fetch("/api/promo/me")
      .then((r) => r.json())
      .then((d) => { setTier(d.tier === "vip" ? "vip" : "regular"); setPricing(mergeAdsPricing(d.pricing)); })
      .catch(() => {});
  }, []);

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

  // Debounced city search (Meta geo keys)
  useEffect(() => {
    const q = citySearch.trim();
    if (q.length < 2) { setCityResults([]); return; }
    setCitySearching(true);
    const id = setTimeout(() => {
      fetch(`/api/promo/geo?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setCityResults(d.cities || []))
        .catch(() => setCityResults([]))
        .finally(() => setCitySearching(false));
    }, 350);
    return () => clearTimeout(id);
  }, [citySearch]);

  function addCity(c: GeoCity) {
    if (!cities.some((x) => x.key === c.key)) setCities([...cities, c]);
    setCitySearch("");
    setCityResults([]);
  }
  function removeCity(key: string) {
    setCities(cities.filter((c) => c.key !== key));
  }

  function buildTargeting() {
    const targeting: Record<string, unknown> = { age_min: ageMin, age_max: ageMax };
    if (gender === "male")   targeting.genders = [1];
    if (gender === "female") targeting.genders = [2];
    if (cities.length > 0) {
      targeting.geo_locations = {
        countries: ["LY"],
        cities: cities.map((c) => ({ key: c.key, radius: 25, distance_unit: "kilometer" })),
      };
    }
    return targeting;
  }

  const selectedPageObj = pages.find((p) => p.page_id === selectedPage);
  const filteredPages = pages.filter((p) =>
    p.page_name.toLowerCase().includes(pageSearch.trim().toLowerCase())
  );

  async function submit() {
    setError("");
    if (!selectedPage) { setError(t("اختر صفحتك أولاً", "Select your Page first")); return; }
    if (!postUrl)       { setError(t("اختر منشورًا أو الصق رابطًا", "Select a post or paste a link")); return; }

    if (!pkg && (!budgetUsd || budgetUsd < 1)) { setError(t("الحد الأدنى للميزانية 1$", "Minimum budget is $1")); return; }
    if (!pkg && (!daysVal   || daysVal < 1))   { setError(t("المدة يجب أن تكون يوم واحد على الأقل", "Duration must be at least one day")); return; }

    setSaving(true);
    const page = pages.find((p) => p.page_id === selectedPage);
    const res  = await fetch("/api/promo/campaigns", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pageId:      selectedPage,
        pageName:    page?.page_name,
        postUrl,
        budgetUsd,
        durationDays: daysVal,
        targeting:   buildTargeting(),
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
            <button type="button" onClick={() => setPageMenuOpen((o) => !o)}
              style={{ ...INPUT_STYLE, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, cursor: "pointer", textAlign: rtl ? "right" : "left" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                {selectedPageObj?.page_picture && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedPageObj.page_picture} alt="" style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0 }} />
                )}
                {selectedPageObj ? selectedPageObj.page_name : t("اختر صفحة", "Choose a Page")}
              </span>
              <ChevronDown size={16} color="#64748b" style={{ flexShrink: 0, transform: pageMenuOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
            </button>

            {pageMenuOpen && (
              <div style={{ position: "absolute", insetInlineStart: 0, insetInlineEnd: 0, top: "calc(100% + 6px)", zIndex: 30,
                background: "#0d1b2a", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.5)", overflow: "hidden" }}>
                <div style={{ position: "relative", padding: 8, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <Search size={15} color="#64748b" style={{ position: "absolute", insetInlineStart: 18, top: "50%", transform: "translateY(-50%)" }} />
                  <input autoFocus value={pageSearch} onChange={(e) => setPageSearch(e.target.value)}
                    placeholder={t("ابحث عن صفحة...", "Search a Page...")}
                    style={{ ...INPUT_STYLE, paddingInlineStart: 36, padding: "9px 14px 9px 36px" }} />
                </div>
                <div style={{ maxHeight: 260, overflowY: "auto" }}>
                  {filteredPages.length === 0 ? (
                    <div style={{ padding: 16, color: "#64748b", fontSize: 13, textAlign: "center" }}>
                      {t("لا توجد نتائج", "No matches")}
                    </div>
                  ) : filteredPages.map((p) => {
                    const active = p.page_id === selectedPage;
                    return (
                      <button key={p.id} type="button"
                        onClick={() => { setSelectedPage(p.page_id); setPageMenuOpen(false); setPageSearch(""); }}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                          background: active ? `${BLUE}22` : "transparent", border: "none", cursor: "pointer",
                          color: active ? "#93c5fd" : "#e2e8f0", textAlign: rtl ? "right" : "left", fontSize: 14 }}>
                        {p.page_picture ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.page_picture} alt="" style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />
                        )}
                        <span style={{ flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{p.page_name}</span>
                        {active && <CheckCircle size={15} color={BLUE} style={{ flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
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

        {/* Targeting */}
        <div style={{ background: CARD_BG, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
          <label style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, display: "block" }}>
            <Target size={16} style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
            {t("الاستهداف", "Targeting")}
          </label>

          {/* Cities */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>
              <MapPin size={12} style={{ verticalAlign: "middle", marginInlineEnd: 4 }} />
              {t("المدن (اتركها فارغة لكل ليبيا)", "Cities (leave empty for all of Libya)")}
            </label>
            {cities.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                {cities.map((c) => (
                  <span key={c.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${BLUE}22`, border: `1px solid ${BLUE}40`, color: "#93c5fd", borderRadius: 100, padding: "4px 10px", fontSize: 12 }}>
                    {c.name}{c.region ? ` — ${c.region}` : ""}
                    <X size={13} style={{ cursor: "pointer" }} onClick={() => removeCity(c.key)} />
                  </span>
                ))}
              </div>
            )}
            <div style={{ position: "relative" }}>
              <Search size={15} color="#64748b" style={{ position: "absolute", insetInlineStart: 12, top: "50%", transform: "translateY(-50%)" }} />
              <input value={citySearch} onChange={(e) => setCitySearch(e.target.value)}
                placeholder={t("ابحث عن مدينة (مثال: طرابلس، بنغازي)", "Search a city (e.g. Tripoli, Benghazi)")}
                style={{ ...INPUT_STYLE, paddingInlineStart: 36 }} />
              {(citySearching || cityResults.length > 0) && citySearch.trim().length >= 2 && (
                <div style={{ position: "absolute", insetInlineStart: 0, insetInlineEnd: 0, top: "calc(100% + 6px)", zIndex: 20,
                  background: "#0d1b2a", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.5)", maxHeight: 220, overflowY: "auto" }}>
                  {citySearching ? (
                    <div style={{ padding: 14, textAlign: "center", color: "#64748b" }}><Loader2 size={16} className="spin" /></div>
                  ) : cityResults.map((c) => (
                    <button key={c.key} type="button" onClick={() => addCity(c)}
                      style={{ width: "100%", textAlign: rtl ? "right" : "left", padding: "10px 14px", background: "transparent", border: "none", cursor: "pointer", color: "#e2e8f0", fontSize: 13 }}>
                      {c.name}{c.region ? <span style={{ color: "#64748b" }}> — {c.region}</span> : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Age + Gender */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>
                <Users2 size={12} style={{ verticalAlign: "middle", marginInlineEnd: 4 }} />
                {t("العمر من", "Age from")}
              </label>
              <input type="number" min={13} max={65} value={ageMin}
                onChange={(e) => setAgeMin(Math.max(13, Math.min(65, Number(e.target.value) || 13)))} style={INPUT_STYLE} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>{t("العمر إلى", "Age to")}</label>
              <input type="number" min={13} max={65} value={ageMax}
                onChange={(e) => setAgeMax(Math.max(13, Math.min(65, Number(e.target.value) || 65)))} style={INPUT_STYLE} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>{t("الجنس", "Gender")}</label>
              <div style={{ display: "flex", gap: 6 }}>
                {([["all", t("الكل", "All")], ["male", t("ذكر", "Male")], ["female", t("أنثى", "Female")]] as const).map(([g, lbl]) => (
                  <button key={g} type="button" onClick={() => setGender(g)}
                    style={{ flex: 1, padding: "10px 4px", borderRadius: 10, fontSize: 12, cursor: "pointer",
                      border: gender === g ? `1px solid ${BLUE}` : "1px solid rgba(255,255,255,0.12)",
                      background: gender === g ? `${BLUE}22` : "transparent", color: gender === g ? "#93c5fd" : "#94a3b8" }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div style={{ background: CARD_BG, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
            <label style={{ fontWeight: 700, fontSize: 14 }}>
              <DollarSign size={16} style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
              {tier === "vip"
                ? t("ميزانية الإعلان بالدولار", "Ad budget in USD")
                : t("اختر باقة أو ميزانية مخصصة", "Choose a package or a custom budget")}
            </label>
            <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 100, padding: "4px 12px",
              background: tier === "vip" ? "rgba(245,158,11,0.15)" : `${BLUE}18`,
              border: tier === "vip" ? "1px solid rgba(245,158,11,0.4)" : `1px solid ${BLUE}40`,
              color: tier === "vip" ? "#fbbf24" : "#93c5fd" }}>
              {tier === "vip" ? t("⭐ عميل مميّز (VIP)", "⭐ VIP") : t("عميل", "Customer")}
            </span>
          </div>

          {/* Package cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 16 }}>
            {packages.map((p) => {
              const active = selectedPkgId === p.id;
              const tot = priceFor(p.usd, tier, pricing).totalLyd;
              return (
                <button key={p.id} type="button" onClick={() => { setSelectedPkgId(p.id); setUsdInput(""); }}
                  style={{ position: "relative", textAlign: "center", padding: "16px 10px", borderRadius: 14, cursor: "pointer",
                    border: active ? `1.5px solid ${BLUE}` : "1px solid rgba(255,255,255,0.12)",
                    background: active ? `${BLUE}18` : "rgba(255,255,255,0.02)", transition: "all 0.15s" }}>
                  {p.highlight && (
                    <span style={{ position: "absolute", top: -9, insetInlineEnd: 10, background: BLUE, color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: 100, padding: "2px 8px" }}>
                      {t("الأكثر طلبًا", "Popular")}
                    </span>
                  )}
                  <div style={{ fontWeight: 700, fontSize: 14, color: active ? "#93c5fd" : "#e2e8f0" }}>{t(p.name, p.nameEn)}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginTop: 4 }}>${p.usd}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{t(`${p.days} أيام`, `${p.days} days`)}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>~{t(p.reach, p.reachEn)} {t("وصول", "reach")}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#93c5fd", marginTop: 8 }}>{tot} {LYD}</div>
                </button>
              );
            })}
          </div>

          {/* Custom budget toggle */}
          <button type="button" onClick={() => setSelectedPkgId(null)}
            style={{ padding: "8px 16px", borderRadius: 100, border: selectedPkgId === null ? `1px solid ${BLUE}` : "1px solid rgba(255,255,255,0.12)", background: selectedPkgId === null ? `${BLUE}22` : "transparent", color: selectedPkgId === null ? "#93c5fd" : "#94a3b8", cursor: "pointer", fontSize: 13 }}>
            {t("ميزانية مخصصة (بالدولار)", "Custom budget (USD)")}
          </button>

          {selectedPkgId === null && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 6 }}>{t("الميزانية (دولار)", "Budget (USD)")}</label>
                <input type="number" min={1} value={usdInput} onChange={(e) => setUsdInput(e.target.value)} placeholder={t("مثال: 10", "e.g. 10")} style={INPUT_STYLE} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 6 }}>{t("المدة (أيام)", "Duration (days)")}</label>
                <input type="number" min={1} max={30} value={days} onChange={(e) => setDays(e.target.value)} placeholder="7" style={INPUT_STYLE} />
              </div>
            </div>
          )}
        </div>

        {/* Live price summary */}
        {price && (
          <div style={{ background: "rgba(24,119,242,0.08)", border: `1px solid ${BLUE}30`, borderRadius: 16, padding: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8", fontSize: 14 }}>
                <span>{t("ميزانية الإعلان", "Ad budget")}</span><span>${price.budgetUsd}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8", fontSize: 14 }}>
                <span>{t("سعر الصرف اليوم", "Today's rate")}</span><span>{price.rate} {LYD} / $</span>
              </div>
              {price.commissionPct > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8", fontSize: 14 }}>
                  <span>{t(`عمولة (${price.commissionPct}%)`, `Commission (${price.commissionPct}%)`)}</span><span>{price.commissionLyd} {LYD}</span>
                </div>
              )}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10, display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 18 }}>
                <span>{t("الإجمالي بالدينار", "Total in LYD")}</span>
                <span style={{ color: "#93c5fd" }}>{price.totalLyd} {LYD}</span>
              </div>
              <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>
                {t("يُحتسب الإجمالي حسب سعر الدولار اليوم وقد يختلف لاحقًا.", "Total is computed at today's USD rate and may change later.")}
              </p>
            </div>
          </div>
        )}

        {/* Duration note */}
        <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "#fbbf24", display: "flex", alignItems: "flex-start", gap: 10 }}>
          <Calendar size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{t("سيبدأ إعلانك خلال دقائق من تأكيد الدفع، ويعمل على ", "Your ad starts within minutes of payment, running for ")}<strong>{t(`${daysVal} أيام`, `${daysVal} days`)}</strong>{cities.length > 0 ? t(` في ${cities.length} مدينة محددة.`, ` in ${cities.length} selected cit${cities.length === 1 ? "y" : "ies"}.`) : t(" في كل ليبيا.", " across all of Libya.")}</span>
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
