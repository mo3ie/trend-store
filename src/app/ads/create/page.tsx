"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Link2, DollarSign, Calendar, Globe,
  Loader2, CheckCircle, AlertCircle, ChevronDown, Search, X, MapPin, Users2, Target, Crown, Eye,
  Sparkles, Save, Trash2, Plus, Bookmark, Map as MapIcon,
  MessageCircle, Phone, Megaphone, PlayCircle, ThumbsUp, Layers, Wand2, ShieldAlert,
  Copy, SplitSquareHorizontal, PenLine,
} from "lucide-react";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import { priceFor, mergeAdsPricing, DEFAULT_ADS_PRICING, AD_TIER_PACKAGES, findTierOption, type AdsPricing, type Tier } from "@/services/campaigns";
import { useLang } from "@/hooks/useLang";
import { useTheme } from "@/hooks/useTheme";
import LangToggle from "@/components/LangToggle";
import AdsBottomNav from "@/components/AdsBottomNav";
import type { MapPin as MapPinType } from "@/components/AdRadiusMap";

// Leaflet touches window — load the map only on the client.
const AdRadiusMap = dynamic(() => import("@/components/AdRadiusMap"), { ssr: false });

const G_HERO = "linear-gradient(140deg,#6d28d9 0%,#d6409f 55%,#ff7a59 100%)";
const PINK    = "#d6409f";
const PINK_BG = "rgba(214,64,159,0.12)";

interface ConnectedPage { id: string; page_id: string; page_name: string; page_picture?: string; }
interface PagePost { id: string; postId: string; message: string; createdTime: string; picture?: string; permalinkUrl?: string; }
interface GeoCity { key: string; name: string; region?: string; }
interface AdInterest { id: string; name: string; audienceLower?: number; audienceUpper?: number; }
interface SavedAudience { id: string; name: string; targeting: Record<string, unknown>; }

function CreateCampaignInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const pkgId        = searchParams.get("pkg");
  const { t, rtl } = useLang();
  const { light } = useTheme();
  const Back = rtl ? ArrowLeft : ArrowRight;
  const LYD  = t("د.ل", "LYD");

  const c = light ? {
    bg: "#fbf7ff", text: "#1e1330", muted: "#6b5b78", dim: "#8b7d97",
    surface: "#ffffff", border: "rgba(120,60,160,0.14)", inputBg: "#f4eefb", menuBg: "#ffffff",
  } : {
    bg: "#100a18", text: "#f6eefb", muted: "#a394b0", dim: "#7a6d88",
    surface: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.10)", inputBg: "rgba(255,255,255,0.06)", menuBg: "#1a1226",
  };

  const input: React.CSSProperties = {
    width: "100%", background: c.inputBg, border: `1px solid ${c.border}`,
    borderRadius: 11, padding: "12px 14px", color: c.text, fontSize: 14, outline: "none",
    boxSizing: "border-box", fontFamily: "inherit",
  };

  const [pages, setPages]   = useState<ConnectedPage[]>([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [postUrl, setPostUrl]   = useState("");
  const [posts, setPosts]       = useState<PagePost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [usdInput, setUsdInput] = useState("");
  const [days, setDays]         = useState("7");
  // Regular = fixed LYD tier packages; VIP can switch to a free USD budget.
  const [tierPkgId, setTierPkgId] = useState<"first" | "second" | "third">(
    (["first", "second", "third"].includes(pkgId || "") ? pkgId : "first") as "first" | "second" | "third"
  );
  const [pkgDays, setPkgDays]   = useState(3);
  const [isVip, setIsVip]       = useState(false);
  const [vipMode, setVipMode]   = useState<"package" | "custom">("package");
  const [tier, setTier]         = useState<Tier>("regular");
  const [pricing, setPricing]   = useState<AdsPricing>(DEFAULT_ADS_PRICING);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [loadingPages, setLoadingPages] = useState(true);

  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const [pageSearch, setPageSearch]     = useState("");

  const [cities, setCities]         = useState<GeoCity[]>([]);
  const [citySearch, setCitySearch] = useState("");
  const [cityResults, setCityResults] = useState<GeoCity[]>([]);
  const [citySearching, setCitySearching] = useState(false);
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(65);
  const [gender, setGender] = useState<"all" | "male" | "female">("all");

  // Ad goal / placements / Advantage+ audience / special category
  const [objective, setObjective] = useState<"engagement" | "messages" | "traffic" | "calls" | "video_views" | "awareness" | "page_likes">("engagement");
  const [adText, setAdText] = useState(""); // page_likes promo caption
  const [placementMode, setPlacementMode] = useState<"auto" | "manual">("auto");
  const [placements, setPlacements] = useState<string[]>(["facebook", "instagram", "messenger", "audience_network"]);
  const [advantageAudience, setAdvantageAudience] = useState(true);
  const [specialCategory, setSpecialCategory] = useState<string>("");
  const [endDate, setEndDate] = useState(""); // VIP calendar → computes days

  // Advanced targeting
  const [cityRadius, setCityRadius] = useState<Record<string, number>>({});
  const [mapPin, setMapPin]         = useState<MapPinType | null>(null);
  const [showMap, setShowMap]       = useState(false);
  const [regions, setRegions]       = useState<GeoCity[]>([]);
  const [regionSearch, setRegionSearch]   = useState("");
  const [regionResults, setRegionResults] = useState<GeoCity[]>([]);
  const [interests, setInterests]   = useState<AdInterest[]>([]);
  const [intSearch, setIntSearch]   = useState("");
  const [intResults, setIntResults] = useState<AdInterest[]>([]);
  const [intSearching, setIntSearching] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Saved audiences
  const [audiences, setAudiences] = useState<SavedAudience[]>([]);
  const [audName, setAudName]     = useState("");
  const [savingAud, setSavingAud] = useState(false);
  // AI assistant (VIP)
  const [aiOpen, setAiOpen]       = useState(false);
  const [aiDesc, setAiDesc]       = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [aiErr, setAiErr]         = useState("");
  // A/B test
  const [abOn, setAbOn]           = useState(false);
  const [audienceBId, setAudienceBId] = useState("");
  // AI ad-copy variations
  const [copyOpen, setCopyOpen]     = useState(false);
  const [copyDesc, setCopyDesc]     = useState("");
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyErr, setCopyErr]       = useState("");
  const [copyVars, setCopyVars]     = useState<string[]>([]);
  const [copiedIdx, setCopiedIdx]   = useState(-1);

  const usingCustom = isVip && vipMode === "custom";
  const tierPkg     = AD_TIER_PACKAGES.find((p) => p.id === tierPkgId)!;
  const opt         = usingCustom ? null : (findTierOption(tierPkgId, pkgDays)?.option ?? null);
  const budgetUsd   = usingCustom ? (Number(usdInput) || 0) : (opt?.budgetUsd ?? 0);
  const daysVal     = usingCustom ? (Number(days) || 0)     : (opt?.days ?? 0);
  const vipPrice    = budgetUsd > 0 ? priceFor(budgetUsd, "vip", pricing) : null;
  const totalLyd    = usingCustom ? (vipPrice?.totalLyd ?? 0) : (opt?.priceLyd ?? 0);

  useEffect(() => {
    fetch("/api/promo/me")
      .then((r) => r.json())
      .then((d) => {
        const vip = d.tier === "vip" || !!d.vip?.vip;
        setTier(vip ? "vip" : "regular");
        setIsVip(vip);
        setPricing(mergeAdsPricing(d.pricing));
      })
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

  // VIP calendar → number of days from today to the chosen end date.
  useEffect(() => {
    if (!endDate) return;
    const end = new Date(endDate + "T23:59:59");
    const diff = Math.ceil((end.getTime() - Date.now()) / 86400000);
    if (diff >= 1 && diff <= 365) setDays(String(diff));
  }, [endDate]);

  function togglePlacement(p: string) {
    setPlacements((cur) => cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]);
  }

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

  function addCity(city: GeoCity) {
    if (!cities.some((x) => x.key === city.key)) setCities([...cities, city]);
    setCitySearch("");
    setCityResults([]);
  }
  function removeCity(key: string) {
    setCities(cities.filter((city) => city.key !== key));
    setCityRadius((r) => { const n = { ...r }; delete n[key]; return n; });
  }

  // Region search (debounced)
  useEffect(() => {
    const q = regionSearch.trim();
    if (q.length < 2) { setRegionResults([]); return; }
    const id = setTimeout(() => {
      fetch(`/api/promo/geo?type=region&q=${encodeURIComponent(q)}`)
        .then((r) => r.json()).then((d) => setRegionResults(d.cities || [])).catch(() => setRegionResults([]));
    }, 350);
    return () => clearTimeout(id);
  }, [regionSearch]);
  function addRegion(r: GeoCity) { if (!regions.some((x) => x.key === r.key)) setRegions([...regions, r]); setRegionSearch(""); setRegionResults([]); }
  function removeRegion(key: string) { setRegions(regions.filter((r) => r.key !== key)); }

  // Interest search (debounced)
  useEffect(() => {
    const q = intSearch.trim();
    if (q.length < 2) { setIntResults([]); return; }
    setIntSearching(true);
    const id = setTimeout(() => {
      fetch(`/api/promo/interests?q=${encodeURIComponent(q)}`)
        .then((r) => r.json()).then((d) => setIntResults(d.interests || [])).catch(() => setIntResults([]))
        .finally(() => setIntSearching(false));
    }, 350);
    return () => clearTimeout(id);
  }, [intSearch]);
  function addInterest(i: AdInterest) { if (!interests.some((x) => x.id === i.id)) setInterests([...interests, i]); setIntSearch(""); setIntResults([]); }
  function removeInterest(id: string) { setInterests(interests.filter((i) => i.id !== id)); }

  // Saved audiences
  useEffect(() => { fetch("/api/promo/audiences").then((r) => r.json()).then((d) => setAudiences(d.audiences || [])).catch(() => {}); }, []);

  async function saveAudience() {
    if (!audName.trim()) return;
    setSavingAud(true);
    const r = await fetch("/api/promo/audiences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: audName.trim(), targeting: snapshotTargeting() }) });
    const d = await r.json();
    setSavingAud(false);
    if (r.ok && d.audience) { setAudiences([d.audience, ...audiences]); setAudName(""); }
  }
  async function deleteAudience(id: string) {
    await fetch(`/api/promo/audiences?id=${id}`, { method: "DELETE" });
    setAudiences(audiences.filter((a) => a.id !== id));
  }
  function loadAudience(a: SavedAudience) {
    const tg = a.targeting || {};
    if (typeof tg.age_min === "number") setAgeMin(tg.age_min as number);
    if (typeof tg.age_max === "number") setAgeMax(tg.age_max as number);
    const g = tg.genders as number[] | undefined;
    setGender(g?.[0] === 1 ? "male" : g?.[0] === 2 ? "female" : "all");
    setCities((tg._cities as GeoCity[]) || []);
    setCityRadius((tg._cityRadius as Record<string, number>) || {});
    setRegions((tg._regions as GeoCity[]) || []);
    setInterests((tg._interests as AdInterest[]) || []);
    const savedPin = (tg._mapPin as MapPinType | null) || null;
    setMapPin(savedPin);
    if (savedPin) setShowMap(true);
    setShowAdvanced(true);
  }

  async function runAdCopy() {
    setCopyErr(""); setCopyVars([]); setCopyLoading(true); setCopiedIdx(-1);
    const r = await fetch("/api/promo/ad-copy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: copyDesc }) });
    const d = await r.json();
    setCopyLoading(false);
    if (!r.ok) { setCopyErr(d.error || t("تعذّر توليد النصوص", "Failed to generate")); return; }
    setCopyVars(d.variations || []);
  }
  async function copyText(text: string, idx: number) {
    try { await navigator.clipboard.writeText(text); setCopiedIdx(idx); setTimeout(() => setCopiedIdx(-1), 1800); } catch { /* ignore */ }
  }

  // Strip display-only (_-prefixed) keys → a clean Meta targeting object.
  function cleanTargeting(obj: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(obj || {}).filter(([k]) => !k.startsWith("_")));
  }

  async function runAi() {
    setAiErr(""); setAiSummary(""); setAiLoading(true);
    const r = await fetch("/api/promo/ai-targeting", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: aiDesc }) });
    const d = await r.json();
    setAiLoading(false);
    if (!r.ok) { setAiErr(d.message || d.error || t("تعذّر المساعد", "Assistant failed")); return; }
    if (typeof d.ageMin === "number") setAgeMin(d.ageMin);
    if (typeof d.ageMax === "number") setAgeMax(d.ageMax);
    setGender(d.gender === "male" ? "male" : d.gender === "female" ? "female" : "all");
    if (Array.isArray(d.cities))    setCities(d.cities);
    if (Array.isArray(d.interests)) setInterests(d.interests);
    setAiSummary(d.summary || "");
    setShowAdvanced(true);
  }

  // Snapshot the current targeting for saving (keeps display metadata under _ keys).
  function snapshotTargeting(): Record<string, unknown> {
    return { ...buildTargeting(), _cities: cities, _cityRadius: cityRadius, _regions: regions, _interests: interests, _mapPin: mapPin };
  }

  function buildTargeting() {
    const targeting: Record<string, unknown> = { age_min: ageMin, age_max: ageMax };
    if (gender === "male")   targeting.genders = [1];
    if (gender === "female") targeting.genders = [2];
    const geo: Record<string, unknown> = {};
    if (cities.length > 0)  geo.cities  = cities.map((city) => ({ key: city.key, radius: cityRadius[city.key] || 25, distance_unit: "kilometer" }));
    if (regions.length > 0) geo.regions = regions.map((r) => ({ key: r.key }));
    if (mapPin)             geo.custom_locations = [{ latitude: mapPin.lat, longitude: mapPin.lng, radius: mapPin.radius, distance_unit: "kilometer" }];
    if (cities.length === 0 && regions.length === 0 && !mapPin) geo.countries = ["LY"];
    targeting.geo_locations = geo;
    if (interests.length > 0) targeting.flexible_spec = [{ interests: interests.map((i) => ({ id: i.id, name: i.name })) }];
    return targeting;
  }

  const selectedPageObj = pages.find((p) => p.page_id === selectedPage);
  const filteredPages = pages.filter((p) =>
    p.page_name.toLowerCase().includes(pageSearch.trim().toLowerCase())
  );

  async function submit() {
    setError("");
    const isPageLikes = objective === "page_likes";
    if (!selectedPage) { setError(t("اختر صفحتك أولاً", "Select your Page first")); return; }
    if (!isPageLikes && !postUrl) { setError(t("اختر منشورًا أو الصق رابطًا", "Select a post or paste a link")); return; }
    if (usingCustom) {
      if (!budgetUsd || budgetUsd < 1) { setError(t("الحد الأدنى للميزانية 1$", "Minimum budget is $1")); return; }
      if (!daysVal   || daysVal < 1)   { setError(t("المدة يجب أن تكون يوم واحد على الأقل", "Duration must be at least one day")); return; }
    } else if (!opt) {
      setError(t("اختر باقة ومدة", "Choose a package and duration")); return;
    }
    if (abOn && !audienceBId) { setError(t("اختر الجمهور (ب) للمقارنة أو أوقف اختبار A/B", "Pick audience B for the test, or turn A/B off")); return; }

    setSaving(true);
    const page = pages.find((p) => p.page_id === selectedPage);
    const audienceB = abOn ? audiences.find((a) => a.id === audienceBId) : undefined;
    const adOptions = {
      objective,
      placements: placementMode === "manual" ? placements : [],
      advantageAudience,
      specialAdCategory: specialCategory || null,
      targetingB: audienceB ? cleanTargeting(audienceB.targeting) : null,
      adText: isPageLikes ? adText : undefined,
    };
    const postUrlOut = isPageLikes ? undefined : postUrl;
    const body = usingCustom
      ? { pageId: selectedPage, pageName: page?.page_name, postUrl: postUrlOut, budgetUsd, durationDays: daysVal, targeting: buildTargeting(), ...adOptions }
      : { pageId: selectedPage, pageName: page?.page_name, postUrl: postUrlOut, packageId: tierPkgId, durationDays: pkgDays, targeting: buildTargeting(), ...adOptions };
    const res  = await fetch("/api/promo/campaigns", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || t("حدث خطأ", "Something went wrong")); setSaving(false); return; }
    router.push(`/ads/checkout?campaignId=${data.campaign.id}`);
  }

  if (loadingPages) {
    return (
      <div style={{ minHeight: "100vh", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={32} color={PINK} className="spin" />
        <style>{`@keyframes spin-anim{to{transform:rotate(360deg)}} .spin{animation:spin-anim 1s linear infinite}`}</style>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: c.bg, color: c.text, fontFamily: "Cairo,sans-serif", direction: rtl ? "rtl" : "ltr", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, padding: 24 }}>
        <AlertCircle size={48} color="#f59e0b" />
        <p style={{ fontSize: 16, color: c.muted, textAlign: "center" }}>{t("يجب ربط صفحة فيسبوك أولاً قبل إنشاء حملة", "You must connect a Facebook Page before creating a campaign")}</p>
        <button onClick={() => router.push("/ads/connect")}
          style={{ background: G_HERO, border: "none", borderRadius: 14, padding: "13px 28px", color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 15, fontFamily: "inherit" }}>
          {t("ربط صفحة الآن", "Connect a Page now")}
        </button>
      </div>
    );
  }

  const card: React.CSSProperties = { background: c.surface, border: `2px solid ${c.border}`, borderRadius: 18, padding: 22 };

  return (
    <div style={{ minHeight: "100vh", background: c.bg, color: c.text, fontFamily: "Cairo,sans-serif", direction: rtl ? "rtl" : "ltr", paddingBottom: 80, transition: "background .2s,color .2s" }}>

      <div style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 12, maxWidth: 720, margin: "0 auto" }}>
        <button onClick={() => router.push("/ads/connect")} style={{ background: "none", border: "none", color: c.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
          <Back size={18} /> {t("رجوع", "Back")}
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>{t("إنشاء حملة إعلانية", "Create a campaign")}</h1>
        <div style={{ marginInlineStart: "auto" }}><LangToggle /></div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "22px 20px", display: "grid", gap: 18 }}>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid #ef444455", borderRadius: 14, padding: "12px 16px", color: "#ef4444", display: "flex", gap: 10, alignItems: "center" }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Page selector */}
        <div style={card}>
          <label style={{ fontWeight: 800, fontSize: 14, marginBottom: 12, display: "block" }}>
            <Globe size={16} style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
            {t("الصفحة المراد تمويل منشورها", "The Page whose post you want to boost")}
          </label>
          <div style={{ position: "relative" }}>
            <button type="button" onClick={() => setPageMenuOpen((o) => !o)}
              style={{ ...input, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, cursor: "pointer", textAlign: rtl ? "right" : "left" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                {selectedPageObj?.page_picture && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedPageObj.page_picture} alt="" style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0 }} />
                )}
                {selectedPageObj ? selectedPageObj.page_name : t("اختر صفحة", "Choose a Page")}
              </span>
              <ChevronDown size={16} color={c.dim} style={{ flexShrink: 0, transform: pageMenuOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
            </button>

            {pageMenuOpen && (
              <div style={{ position: "absolute", insetInlineStart: 0, insetInlineEnd: 0, top: "calc(100% + 6px)", zIndex: 30,
                background: c.menuBg, border: `1px solid ${c.border}`, borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.28)", overflow: "hidden" }}>
                <div style={{ position: "relative", padding: 8, borderBottom: `1px solid ${c.border}` }}>
                  <Search size={15} color={c.dim} style={{ position: "absolute", insetInlineStart: 18, top: "50%", transform: "translateY(-50%)" }} />
                  <input autoFocus value={pageSearch} onChange={(e) => setPageSearch(e.target.value)}
                    placeholder={t("ابحث عن صفحة...", "Search a Page...")}
                    style={{ ...input, paddingInlineStart: 36, padding: "9px 14px 9px 36px" }} />
                </div>
                <div style={{ maxHeight: 260, overflowY: "auto" }}>
                  {filteredPages.length === 0 ? (
                    <div style={{ padding: 16, color: c.dim, fontSize: 13, textAlign: "center" }}>{t("لا توجد نتائج", "No matches")}</div>
                  ) : filteredPages.map((p) => {
                    const active = p.page_id === selectedPage;
                    return (
                      <button key={p.id} type="button"
                        onClick={() => { setSelectedPage(p.page_id); setPageMenuOpen(false); setPageSearch(""); }}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                          background: active ? PINK_BG : "transparent", border: "none", cursor: "pointer",
                          color: active ? PINK : c.text, textAlign: rtl ? "right" : "left", fontSize: 14, fontFamily: "inherit" }}>
                        {p.page_picture ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.page_picture} alt="" style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 26, height: 26, borderRadius: "50%", background: c.inputBg, flexShrink: 0 }} />
                        )}
                        <span style={{ flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{p.page_name}</span>
                        {active && <CheckCircle size={15} color={PINK} style={{ flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Ad text — Page-likes ads promote the Page, so there is no post to pick */}
        {objective === "page_likes" && (
          <div style={card}>
            <label style={{ fontWeight: 800, fontSize: 14, marginBottom: 4, display: "block" }}>
              <PenLine size={16} style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
              {t("نص إعلان الصفحة", "Page ad text")}
            </label>
            <p style={{ color: c.dim, fontSize: 12, margin: "0 0 12px", lineHeight: 1.6 }}>
              {t("جملة قصيرة تشجّع الناس على متابعة صفحتك (ستظهر مع زر «أعجبني»). صورة صفحتك تُستخدم تلقائياً.", "A short line encouraging people to follow your Page (shown with a “Like” button). Your Page picture is used automatically.")}
            </p>
            <textarea value={adText} onChange={(e) => setAdText(e.target.value)} rows={3}
              placeholder={t("مثال: تابعنا لأحدث العروض والمنتجات الحصرية 🌟", "e.g. Follow us for the latest deals & exclusive products 🌟")}
              style={{ ...input, resize: "vertical" }} />
          </div>
        )}

        {/* Post selector */}
        <div style={{ ...card, display: objective === "page_likes" ? "none" : undefined }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12 }}>
            <label style={{ fontWeight: 800, fontSize: 14 }}>
              <Link2 size={16} style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
              {t("المنشور المراد تمويله", "The post to boost")}
            </label>
            <button type="button" onClick={() => setManualMode((m) => !m)}
              style={{ background: "none", border: "none", color: PINK, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>
              {manualMode ? t("اختيار من المنشورات", "Pick from posts") : t("أو الصق رابطًا", "Or paste a link")}
            </button>
          </div>

          {manualMode ? (
            <>
              <input type="url" value={postUrl}
                onChange={(e) => { setPostUrl(e.target.value); setSelectedPostId(""); }}
                placeholder="https://www.facebook.com/PageName/posts/123456..." style={input} />
              <p style={{ color: c.dim, fontSize: 12, marginTop: 8, lineHeight: 1.6 }}>
                {t("افتح المنشور من صفحتك، انقر على “نسخ الرابط”، والصقه هنا", "Open the post on your Page, tap “Copy link”, and paste it here")}
              </p>
            </>
          ) : loadingPosts ? (
            <div style={{ textAlign: "center", padding: 24, color: c.dim }}><Loader2 size={22} className="spin" /></div>
          ) : posts.length === 0 ? (
            <p style={{ color: c.muted, fontSize: 13, lineHeight: 1.7 }}>
              {t("لا توجد منشورات على هذه الصفحة، أو تعذّر تحميلها. استخدم “الصق رابطًا”.", "No posts found on this Page, or they couldn't be loaded. Use “Or paste a link”.")}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 340, overflowY: "auto" }}>
              {posts.map((p) => {
                const active = selectedPostId === p.id;
                return (
                  <button key={p.id} type="button" onClick={() => pickPost(p)}
                    style={{ display: "flex", gap: 12, alignItems: "center", textAlign: rtl ? "right" : "left",
                      padding: 10, borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                      border: active ? `2px solid ${PINK}` : `1px solid ${c.border}`,
                      background: active ? PINK_BG : c.inputBg }}>
                    {p.picture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.picture} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 52, height: 52, borderRadius: 8, background: c.inputBg, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Globe size={20} color={c.dim} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: c.text, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {p.message ? (p.message.length > 90 ? p.message.slice(0, 90) + "…" : p.message) : t("(منشور بدون نص)", "(post with no text)")}
                      </div>
                      <div style={{ fontSize: 11, color: c.dim, marginTop: 3 }}>{new Date(p.createdTime).toLocaleDateString(rtl ? "ar-LY" : "en-GB")}</div>
                    </div>
                    {active && <CheckCircle size={18} color={PINK} style={{ flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* AI ad-copy variations */}
        <div style={card}>
          <button type="button" onClick={() => setCopyOpen((o) => !o)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: rtl ? "right" : "left", padding: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: "linear-gradient(135deg,#6d28d9,#d6409f)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <PenLine size={18} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{t("نصوص إعلانية بالذكاء الاصطناعي", "AI ad-copy variations")}</div>
              <div style={{ fontSize: 11.5, color: c.dim, marginTop: 2 }}>{t("احصل على 3 صيغ جاهزة لمنشورك", "Get 3 ready captions for your post")}</div>
            </div>
            <ChevronDown size={16} color={c.dim} style={{ flexShrink: 0, transform: copyOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
          </button>
          {copyOpen && (
            <div style={{ marginTop: 14 }}>
              <textarea value={copyDesc} onChange={(e) => setCopyDesc(e.target.value)} rows={2}
                placeholder={t("صف منتجك أو عرضك (مثال: خصم 20% على العطور هذا الأسبوع)", "Describe your product/offer (e.g. 20% off perfumes this week)")}
                style={{ ...input, resize: "vertical" }} />
              <button type="button" onClick={runAdCopy} disabled={copyLoading || !copyDesc.trim()}
                style={{ marginTop: 10, background: G_HERO, border: "none", borderRadius: 11, padding: "10px 18px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8, opacity: copyLoading ? 0.7 : 1 }}>
                {copyLoading ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />} {t("توليد النصوص", "Generate")}
              </button>
              {copyErr && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 8 }}>{copyErr}</div>}
              {copyVars.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
                  {copyVars.map((v, i) => (
                    <div key={i} style={{ background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: 12, padding: 14 }}>
                      <div style={{ fontSize: 13.5, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{v}</div>
                      <button type="button" onClick={() => copyText(v, i)}
                        style={{ marginTop: 10, background: copiedIdx === i ? "rgba(34,197,94,0.15)" : PINK_BG, border: `1px solid ${copiedIdx === i ? "#22c55e55" : PINK + "55"}`, borderRadius: 9, padding: "6px 14px", color: copiedIdx === i ? "#22c55e" : PINK, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {copiedIdx === i ? <CheckCircle size={13} /> : <Copy size={13} />} {copiedIdx === i ? t("تم النسخ", "Copied") : t("نسخ", "Copy")}
                      </button>
                    </div>
                  ))}
                  <p style={{ fontSize: 11.5, color: c.dim, lineHeight: 1.6, margin: 0 }}>
                    💡 {t("انسخ النص الذي يعجبك، وحدّث منشورك على فيسبوك قبل التمويل — فالتمويل لا يغيّر نص المنشور الأصلي.", "Copy the one you like and update your Facebook post before boosting — boosting can't change the original post's text.")}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ad goal / objective */}
        <div style={card}>
          <label style={{ fontWeight: 800, fontSize: 14, marginBottom: 4, display: "block" }}>
            <Target size={16} style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
            {t("هدف الإعلان", "Ad goal")}
          </label>
          <p style={{ color: c.dim, fontSize: 12, margin: "0 0 14px", lineHeight: 1.6 }}>
            {t("ماذا تريد أن يفعل الناس عندما يشاهدون إعلانك؟", "What do you want people to do when they see your ad?")}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
            {([
              { id: "engagement",  icon: ThumbsUp,      title: t("تفاعل مع المنشور", "Post engagement"), desc: t("لايكات وتعليقات ومشاركات", "Likes, comments, shares") },
              { id: "messages",    icon: MessageCircle, title: t("رسائل", "Messages"),                  desc: t("محادثات على ماسنجر", "Messenger conversations") },
              { id: "traffic",     icon: Globe,         title: t("زيارات", "Traffic"),                  desc: t("نقرات إلى موقعك", "Clicks to your link") },
              { id: "calls",       icon: Phone,         title: t("مكالمات", "Calls"),                   desc: t("اتصالات هاتفية", "Phone calls") },
              { id: "video_views", icon: PlayCircle,    title: t("مشاهدات فيديو", "Video views"),        desc: t("لمنشورات الفيديو", "For video posts") },
              { id: "awareness",   icon: Megaphone,     title: t("وصول وانتشار", "Awareness & reach"),   desc: t("أكبر عدد من الناس", "Reach the most people") },
              { id: "page_likes",  icon: ThumbsUp,      title: t("إعجابات الصفحة", "Page likes"),        desc: t("زيادة متابعي صفحتك", "Grow your Page followers") },
            ] as const).map((o) => {
              const active = objective === o.id;
              return (
                <button key={o.id} type="button" onClick={() => setObjective(o.id)}
                  style={{ textAlign: rtl ? "right" : "left", padding: "13px 14px", borderRadius: 13, cursor: "pointer", fontFamily: "inherit",
                    border: active ? `2px solid ${PINK}` : `1px solid ${c.border}`, background: active ? PINK_BG : c.inputBg, display: "flex", gap: 11, alignItems: "flex-start" }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: active ? PINK : c.surface, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <o.icon size={17} color={active ? "#fff" : c.muted} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: active ? PINK : c.text }}>{o.title}</div>
                    <div style={{ fontSize: 11, color: c.dim, marginTop: 2, lineHeight: 1.4 }}>{o.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Targeting */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <label style={{ fontWeight: 800, fontSize: 14 }}>
              <Target size={16} style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
              {t("الاستهداف", "Targeting")}
            </label>
            {isVip && (
              <button type="button" onClick={() => setAiOpen((o) => !o)}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "linear-gradient(135deg,#f0b429,#ff9d2f)", border: "none", borderRadius: 10, padding: "8px 14px", color: "#1a1330", fontWeight: 800, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
                <Sparkles size={14} /> {t("مساعد ذكي", "AI assistant")}
              </button>
            )}
          </div>

          {/* AI assistant (VIP) */}
          {isVip && aiOpen && (
            <div style={{ background: "rgba(240,180,41,0.08)", border: "1px solid rgba(240,180,41,0.4)", borderRadius: 14, padding: 16, marginBottom: 18 }}>
              <label style={{ fontSize: 12.5, color: "#f0b429", fontWeight: 700, display: "block", marginBottom: 8 }}>{t("صف منتجك وجمهورك، ويقترح المساعد أفضل استهداف:", "Describe your product & audience; the assistant suggests the best targeting:")}</label>
              <textarea value={aiDesc} onChange={(e) => setAiDesc(e.target.value)} rows={2}
                placeholder={t("مثال: متجر عطور نسائية فاخرة، أستهدف النساء في طرابلس وبنغازي", "e.g. Luxury women's perfume shop targeting women in Tripoli & Benghazi")}
                style={{ ...input, resize: "vertical" }} />
              {aiErr && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 8 }}>{aiErr}</div>}
              {aiSummary && <div style={{ color: "#f0b429", fontSize: 12.5, marginTop: 8, lineHeight: 1.6 }}>✨ {aiSummary}</div>}
              <button type="button" onClick={runAi} disabled={aiLoading || !aiDesc.trim()}
                style={{ marginTop: 10, background: "linear-gradient(135deg,#f0b429,#ff9d2f)", border: "none", borderRadius: 11, padding: "10px 18px", color: "#1a1330", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8, opacity: aiLoading ? 0.7 : 1 }}>
                {aiLoading ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />} {t("اقترح استهدافاً", "Suggest targeting")}
              </button>
            </div>
          )}

          {/* Basic: cities */}
          <label style={{ fontSize: 12, color: c.muted, display: "block", marginBottom: 6 }}>
            <MapPin size={12} style={{ verticalAlign: "middle", marginInlineEnd: 4 }} />
            {t("المدن (اتركها فارغة لكل ليبيا)", "Cities (leave empty for all of Libya)")}
          </label>
          {cities.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              {cities.map((city) => (
                <span key={city.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: PINK_BG, border: `1px solid ${PINK}55`, color: PINK, borderRadius: 100, padding: "4px 10px", fontSize: 12 }}>
                  {city.name}{city.region ? ` — ${city.region}` : ""}
                  <X size={13} style={{ cursor: "pointer" }} onClick={() => removeCity(city.key)} />
                </span>
              ))}
            </div>
          )}
          <div style={{ position: "relative", marginBottom: 18 }}>
            <Search size={15} color={c.dim} style={{ position: "absolute", insetInlineStart: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input value={citySearch} onChange={(e) => setCitySearch(e.target.value)}
              placeholder={t("ابحث عن مدينة (مثال: طرابلس، بنغازي)", "Search a city (e.g. Tripoli, Benghazi)")}
              style={{ ...input, paddingInlineStart: 36 }} />
            {(citySearching || cityResults.length > 0) && citySearch.trim().length >= 2 && (
              <div style={{ position: "absolute", insetInlineStart: 0, insetInlineEnd: 0, top: "calc(100% + 6px)", zIndex: 20, background: c.menuBg, border: `1px solid ${c.border}`, borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.28)", maxHeight: 220, overflowY: "auto" }}>
                {citySearching ? <div style={{ padding: 14, textAlign: "center", color: c.dim }}><Loader2 size={16} className="spin" /></div>
                  : cityResults.map((city) => (
                    <button key={city.key} type="button" onClick={() => addCity(city)}
                      style={{ width: "100%", textAlign: rtl ? "right" : "left", padding: "10px 14px", background: "transparent", border: "none", cursor: "pointer", color: c.text, fontSize: 13, fontFamily: "inherit" }}>
                      {city.name}{city.region ? <span style={{ color: c.dim }}> — {city.region}</span> : ""}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Basic: age + gender */}
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6, fontSize: 12, color: c.muted }}>
            <Users2 size={13} /> {t("العمر والجنس", "Age & gender")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.4fr", gap: 12, alignItems: "end" }}>
            <div>
              <label style={{ fontSize: 11.5, color: c.dim, display: "block", marginBottom: 6, whiteSpace: "nowrap" }}>{t("العمر من", "Age from")}</label>
              <input type="number" min={13} max={65} value={ageMin} onChange={(e) => setAgeMin(Math.max(13, Math.min(65, Number(e.target.value) || 13)))} style={input} />
            </div>
            <div>
              <label style={{ fontSize: 11.5, color: c.dim, display: "block", marginBottom: 6, whiteSpace: "nowrap" }}>{t("العمر إلى", "Age to")}</label>
              <input type="number" min={13} max={65} value={ageMax} onChange={(e) => setAgeMax(Math.max(13, Math.min(65, Number(e.target.value) || 65)))} style={input} />
            </div>
            <div>
              <label style={{ fontSize: 11.5, color: c.dim, display: "block", marginBottom: 6, whiteSpace: "nowrap" }}>{t("الجنس", "Gender")}</label>
              <div style={{ display: "flex", gap: 6 }}>
                {([["all", t("الكل", "All")], ["male", t("ذكر", "Male")], ["female", t("أنثى", "Female")]] as const).map(([g, lbl]) => (
                  <button key={g} type="button" onClick={() => setGender(g)}
                    style={{ flex: 1, padding: "10px 4px", borderRadius: 10, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                      border: gender === g ? `2px solid ${PINK}` : `1px solid ${c.border}`,
                      background: gender === g ? PINK_BG : "transparent", color: gender === g ? PINK : c.muted }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Advantage+ audience */}
          <button type="button" onClick={() => setAdvantageAudience((v) => !v)}
            style={{ marginTop: 16, width: "100%", display: "flex", alignItems: "center", gap: 12, background: advantageAudience ? "rgba(109,40,217,0.10)" : c.inputBg, border: `1px solid ${advantageAudience ? "rgba(109,40,217,0.4)" : c.border}`, borderRadius: 13, padding: "13px 14px", cursor: "pointer", fontFamily: "inherit", textAlign: rtl ? "right" : "left" }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: advantageAudience ? "linear-gradient(135deg,#6d28d9,#d6409f)" : c.surface, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Wand2 size={17} color={advantageAudience ? "#fff" : c.muted} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: advantageAudience ? (light ? "#6d28d9" : "#c4b5fd") : c.text }}>{t("جمهور Advantage+ التلقائي", "Advantage+ audience")}</div>
              <div style={{ fontSize: 11.5, color: c.dim, marginTop: 2, lineHeight: 1.5 }}>{t("يسمح لفيسبوك بالوصول لأشخاص إضافيين مشابهين لجمهورك لتحسين النتائج.", "Lets Facebook reach extra similar people to improve results.")}</div>
            </div>
            <div style={{ width: 42, height: 24, borderRadius: 100, background: advantageAudience ? "#6d28d9" : c.border, position: "relative", flexShrink: 0, transition: "background .15s" }}>
              <div style={{ position: "absolute", top: 3, insetInlineStart: advantageAudience ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "inset-inline-start .15s" }} />
            </div>
          </button>

          {/* Advanced toggle */}
          <button type="button" onClick={() => setShowAdvanced((s) => !s)}
            style={{ marginTop: 18, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: 12, padding: "11px 0", color: c.muted, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            {t("خيارات متقدمة", "Advanced options")}
            <ChevronDown size={16} style={{ transform: showAdvanced ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
          </button>

          {showAdvanced && (
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 18 }}>

              {/* Map targeting — pin + radius */}
              <div>
                <button type="button" onClick={() => setShowMap((s) => !s)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: mapPin ? PINK_BG : c.inputBg, border: `1px solid ${mapPin ? PINK + "55" : c.border}`, borderRadius: 13, padding: "13px 14px", cursor: "pointer", fontFamily: "inherit", textAlign: rtl ? "right" : "left" }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: mapPin ? PINK : c.surface, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <MapPin size={17} color={mapPin ? "#fff" : c.muted} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: mapPin ? PINK : c.text }}>{t("استهداف بالخريطة (دبوس + قطر)", "Map targeting (pin + radius)")}</div>
                    <div style={{ fontSize: 11.5, color: c.dim, marginTop: 2, lineHeight: 1.5 }}>
                      {mapPin ? t(`نقطة محددة · نطاق ${mapPin.radius} كم`, `Pinned · ${mapPin.radius} km radius`) : t("حدّد نقطة على الخريطة ووسّع دائرة التغطية.", "Drop a pin and widen the coverage circle.")}
                    </div>
                  </div>
                  <ChevronDown size={16} color={c.dim} style={{ flexShrink: 0, transform: showMap ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                </button>
                {showMap && (
                  <div style={{ marginTop: 12 }}>
                    <AdRadiusMap value={mapPin} onChange={setMapPin} light={light} rtl={rtl} t={t} />
                    {(cities.length > 0 || regions.length > 0) && mapPin && (
                      <p style={{ fontSize: 11.5, color: "#f59e0b", marginTop: 8, lineHeight: 1.5 }}>⚠️ {t("عند استخدام الدبوس، سيُضاف إلى المدن/المناطق المحددة كمنطقة تغطية إضافية.", "The pin is added alongside your selected cities/regions as an extra coverage area.")}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Regions */}
              <div>
                <label style={{ fontSize: 12, color: c.muted, display: "block", marginBottom: 6 }}><MapIcon size={12} style={{ verticalAlign: "middle", marginInlineEnd: 4 }} /> {t("المناطق / المحافظات", "Regions")}</label>
                {regions.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                    {regions.map((r) => (
                      <span key={r.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: PINK_BG, border: `1px solid ${PINK}55`, color: PINK, borderRadius: 100, padding: "4px 10px", fontSize: 12 }}>
                        {r.name}<X size={13} style={{ cursor: "pointer" }} onClick={() => removeRegion(r.key)} />
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ position: "relative" }}>
                  <Search size={15} color={c.dim} style={{ position: "absolute", insetInlineStart: 12, top: "50%", transform: "translateY(-50%)" }} />
                  <input value={regionSearch} onChange={(e) => setRegionSearch(e.target.value)} placeholder={t("ابحث عن منطقة", "Search a region")} style={{ ...input, paddingInlineStart: 36 }} />
                  {regionResults.length > 0 && regionSearch.trim().length >= 2 && (
                    <div style={{ position: "absolute", insetInlineStart: 0, insetInlineEnd: 0, top: "calc(100% + 6px)", zIndex: 20, background: c.menuBg, border: `1px solid ${c.border}`, borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.28)", maxHeight: 200, overflowY: "auto" }}>
                      {regionResults.map((r) => (
                        <button key={r.key} type="button" onClick={() => addRegion(r)} style={{ width: "100%", textAlign: rtl ? "right" : "left", padding: "10px 14px", background: "transparent", border: "none", cursor: "pointer", color: c.text, fontSize: 13, fontFamily: "inherit" }}>{r.name}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Per-city radius */}
              {cities.length > 0 && (
                <div>
                  <label style={{ fontSize: 12, color: c.muted, display: "block", marginBottom: 8 }}>{t("نطاق حول كل مدينة (كم)", "Radius around each city (km)")}</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {cities.map((city) => (
                      <div key={city.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 12.5, color: c.text, minWidth: 90, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{city.name}</span>
                        <input type="range" min={1} max={80} value={cityRadius[city.key] || 25}
                          onChange={(e) => setCityRadius((r) => ({ ...r, [city.key]: Number(e.target.value) }))}
                          style={{ flex: 1, accentColor: PINK }} />
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: PINK, minWidth: 42, textAlign: "center" }}>{cityRadius[city.key] || 25} {t("كم", "km")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Interests / detailed targeting */}
              <div>
                <label style={{ fontSize: 12, color: c.muted, display: "block", marginBottom: 6 }}><Sparkles size={12} style={{ verticalAlign: "middle", marginInlineEnd: 4 }} /> {t("الاهتمامات والاستهداف التفصيلي", "Interests & detailed targeting")}</label>
                {interests.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                    {interests.map((i) => (
                      <span key={i.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(109,40,217,0.14)", border: "1px solid rgba(109,40,217,0.4)", color: light ? "#6d28d9" : "#c4b5fd", borderRadius: 100, padding: "4px 10px", fontSize: 12 }}>
                        {i.name}<X size={13} style={{ cursor: "pointer" }} onClick={() => removeInterest(i.id)} />
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ position: "relative" }}>
                  <Search size={15} color={c.dim} style={{ position: "absolute", insetInlineStart: 12, top: "50%", transform: "translateY(-50%)" }} />
                  <input value={intSearch} onChange={(e) => setIntSearch(e.target.value)} placeholder={t("ابحث عن اهتمام (مثال: تسوق، عطور، سيارات)", "Search an interest (e.g. shopping, perfume)")} style={{ ...input, paddingInlineStart: 36 }} />
                  {(intSearching || intResults.length > 0) && intSearch.trim().length >= 2 && (
                    <div style={{ position: "absolute", insetInlineStart: 0, insetInlineEnd: 0, top: "calc(100% + 6px)", zIndex: 20, background: c.menuBg, border: `1px solid ${c.border}`, borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.28)", maxHeight: 240, overflowY: "auto" }}>
                      {intSearching ? <div style={{ padding: 14, textAlign: "center", color: c.dim }}><Loader2 size={16} className="spin" /></div>
                        : intResults.map((i) => (
                          <button key={i.id} type="button" onClick={() => addInterest(i)} style={{ width: "100%", textAlign: rtl ? "right" : "left", padding: "10px 14px", background: "transparent", border: "none", cursor: "pointer", color: c.text, fontSize: 13, fontFamily: "inherit", display: "flex", justifyContent: "space-between", gap: 8 }}>
                            <span>{i.name}</span>
                            {i.audienceUpper ? <span style={{ color: c.dim, fontSize: 11 }}>~{i.audienceUpper.toLocaleString("en")}</span> : null}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Saved audiences */}
              <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: 16 }}>
                <label style={{ fontSize: 12, color: c.muted, display: "block", marginBottom: 8 }}><Bookmark size={12} style={{ verticalAlign: "middle", marginInlineEnd: 4 }} /> {t("الجمهور المحفوظ", "Saved audiences")}</label>
                {audiences.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                    {audiences.map((a) => (
                      <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: 10, padding: "8px 12px" }}>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{a.name}</span>
                        <button type="button" onClick={() => loadAudience(a)} style={{ background: PINK_BG, border: `1px solid ${PINK}55`, borderRadius: 8, padding: "5px 12px", color: PINK, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{t("تحميل", "Load")}</button>
                        <button type="button" onClick={() => deleteAudience(a.id)} style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "5px 8px", color: "#ef4444", cursor: "pointer" }}><Trash2 size={13} /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={audName} onChange={(e) => setAudName(e.target.value)} placeholder={t("اسم الجمهور لحفظه", "Name this audience to save")} style={{ ...input, flex: 1 }} />
                  <button type="button" onClick={saveAudience} disabled={savingAud || !audName.trim()}
                    style={{ background: `${PINK}22`, border: `1px solid ${PINK}55`, borderRadius: 11, padding: "0 16px", color: PINK, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7 }}>
                    {savingAud ? <Loader2 size={15} className="spin" /> : <Save size={15} />} {t("حفظ", "Save")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Placements */}
        <div style={card}>
          <label style={{ fontWeight: 800, fontSize: 14, marginBottom: 4, display: "block" }}>
            <Layers size={16} style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
            {t("مواضع الإعلان", "Placements")}
          </label>
          <p style={{ color: c.dim, fontSize: 12, margin: "0 0 14px", lineHeight: 1.6 }}>
            {t("أين يظهر إعلانك؟", "Where your ad appears?")}
          </p>
          <div style={{ display: "flex", gap: 6, background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: 12, padding: 5, marginBottom: placementMode === "manual" ? 14 : 0 }}>
            {([["auto", t("تلقائي (Advantage+)", "Automatic (Advantage+)")], ["manual", t("يدوي", "Manual")]] as const).map(([m, lbl]) => (
              <button key={m} type="button" onClick={() => setPlacementMode(m)}
                style={{ flex: 1, border: "none", cursor: "pointer", borderRadius: 9, padding: "10px 0", fontFamily: "inherit", fontWeight: 800, fontSize: 12.5,
                  background: placementMode === m ? G_HERO : "transparent", color: placementMode === m ? "#fff" : c.muted }}>
                {lbl}
              </button>
            ))}
          </div>
          {placementMode === "auto" ? (
            <p style={{ color: c.dim, fontSize: 12, margin: "12px 0 0", lineHeight: 1.6 }}>
              ✨ {t("يوزّع فيسبوك إعلانك تلقائياً على أفضل المواضع (فيسبوك، إنستغرام، ماسنجر) لأفضل نتيجة بأقل تكلفة.", "Facebook automatically places your ad across the best spots (Facebook, Instagram, Messenger) for the best result at the lowest cost.")}
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {([
                ["facebook", t("فيسبوك", "Facebook")],
                ["instagram", t("إنستغرام", "Instagram")],
                ["messenger", t("ماسنجر", "Messenger")],
                ["audience_network", t("شبكة الجمهور", "Audience Network")],
              ] as const).map(([p, lbl]) => {
                const on = placements.includes(p);
                return (
                  <button key={p} type="button" onClick={() => togglePlacement(p)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", textAlign: rtl ? "right" : "left",
                      border: on ? `2px solid ${PINK}` : `1px solid ${c.border}`, background: on ? PINK_BG : c.inputBg }}>
                    <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${on ? PINK : c.border}`, background: on ? PINK : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {on && <CheckCircle size={13} color="#fff" />}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: on ? PINK : c.text }}>{lbl}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Special ad category */}
          <div style={{ marginTop: 18, borderTop: `1px solid ${c.border}`, paddingTop: 16 }}>
            <label style={{ fontSize: 12.5, color: c.muted, display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <ShieldAlert size={13} /> {t("فئة إعلان خاصة (اختياري)", "Special ad category (optional)")}
            </label>
            <p style={{ color: c.dim, fontSize: 11.5, margin: "0 0 10px", lineHeight: 1.6 }}>
              {t("مطلوبة فقط إذا كان الإعلان عن: إسكان، وظائف، قروض، أو سياسة. اتركها فارغة لبقية الإعلانات.", "Only required if your ad is about: housing, jobs, credit, or politics. Leave empty for everything else.")}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {([
                ["", t("لا شيء", "None")],
                ["HOUSING", t("إسكان", "Housing")],
                ["EMPLOYMENT", t("وظائف", "Employment")],
                ["CREDIT", t("قروض", "Credit")],
                ["ISSUES_ELECTIONS_POLITICS", t("سياسة", "Politics")],
              ] as const).map(([v, lbl]) => {
                const on = specialCategory === v;
                return (
                  <button key={v || "none"} type="button" onClick={() => setSpecialCategory(v)}
                    style={{ padding: "8px 14px", borderRadius: 100, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                      border: on ? `2px solid ${PINK}` : `1px solid ${c.border}`, background: on ? PINK_BG : c.inputBg, color: on ? PINK : c.muted }}>
                    {lbl}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* A/B split test */}
        <div style={card}>
          <button type="button" onClick={() => setAbOn((v) => !v)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: rtl ? "right" : "left", padding: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: abOn ? "linear-gradient(135deg,#6d28d9,#d6409f)" : c.inputBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <SplitSquareHorizontal size={18} color={abOn ? "#fff" : c.muted} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{t("اختبار A/B (مقارنة جمهورين)", "A/B test (compare two audiences)")}</div>
              <div style={{ fontSize: 11.5, color: c.dim, marginTop: 2, lineHeight: 1.5 }}>{t("يُقسّم الميزانية بين جمهورين، ويعرض النتائج لكل منهما.", "Splits the budget between two audiences and reports each one's results.")}</div>
            </div>
            <div style={{ width: 42, height: 24, borderRadius: 100, background: abOn ? "#6d28d9" : c.border, position: "relative", flexShrink: 0, transition: "background .15s" }}>
              <div style={{ position: "absolute", top: 3, insetInlineStart: abOn ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "inset-inline-start .15s" }} />
            </div>
          </button>
          {abOn && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 12.5, color: c.muted, lineHeight: 1.6 }}>
                <span style={{ background: PINK_BG, color: PINK, borderRadius: 6, padding: "2px 8px", fontWeight: 800, fontSize: 11 }}>A</span>
                {t("الجمهور الحالي الذي حددته بالأعلى", "The audience you set above")}
              </div>
              <label style={{ fontSize: 12.5, color: c.muted, display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ background: "rgba(109,40,217,0.14)", color: light ? "#6d28d9" : "#c4b5fd", borderRadius: 6, padding: "2px 8px", fontWeight: 800, fontSize: 11 }}>B</span>
                {t("الجمهور المقابل — اختر من الجمهور المحفوظ", "The rival audience — pick a saved audience")}
              </label>
              {audiences.length === 0 ? (
                <p style={{ fontSize: 12.5, color: c.dim, lineHeight: 1.7 }}>
                  {t("لا يوجد جمهور محفوظ بعد. ارجع إلى الاستهداف ← خيارات متقدمة، جهّز جمهوراً ثانياً واحفظه، ثم عُد إلى هنا.", "No saved audiences yet. Go to Targeting → Advanced options, set up a second audience and save it, then come back here.")}
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {audiences.map((a) => {
                    const on = audienceBId === a.id;
                    return (
                      <button key={a.id} type="button" onClick={() => setAudienceBId(on ? "" : a.id)}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 11, cursor: "pointer", fontFamily: "inherit", textAlign: rtl ? "right" : "left",
                          border: on ? `2px solid ${PINK}` : `1px solid ${c.border}`, background: on ? PINK_BG : c.inputBg }}>
                        <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${on ? PINK : c.border}`, background: on ? PINK : "transparent", flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: on ? PINK : c.text }}>{a.name}</span>
                        {on && <CheckCircle size={15} color={PINK} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pricing */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <label style={{ fontWeight: 800, fontSize: 14 }}>
              <DollarSign size={16} style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
              {usingCustom ? t("ميزانية حرة بالدولار", "Free USD budget") : t("اختر الباقة والمدة", "Choose package & duration")}
            </label>
            {isVip
              ? <span style={{ fontSize: 11, fontWeight: 800, borderRadius: 100, padding: "4px 12px", background: "rgba(240,180,41,0.15)", border: "1px solid rgba(240,180,41,0.5)", color: "#f0b429", display: "inline-flex", alignItems: "center", gap: 5 }}><Crown size={12} /> VIP</span>
              : <span style={{ fontSize: 11, fontWeight: 800, borderRadius: 100, padding: "4px 12px", background: PINK_BG, border: `1px solid ${PINK}55`, color: PINK }}>{t("عميل", "Customer")}</span>}
          </div>

          {/* VIP mode toggle */}
          {isVip && (
            <div style={{ display: "flex", gap: 6, background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: 12, padding: 5, marginBottom: 16 }}>
              {(["package", "custom"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setVipMode(m)}
                  style={{ flex: 1, border: "none", cursor: "pointer", borderRadius: 9, padding: "9px 0", fontFamily: "inherit", fontWeight: 800, fontSize: 13,
                    background: vipMode === m ? G_HERO : "transparent", color: vipMode === m ? "#fff" : c.muted }}>
                  {m === "package" ? t("باقة جاهزة", "A package") : t("ميزانية حرة (دولار)", "Free budget (USD)")}
                </button>
              ))}
            </div>
          )}

          {usingCustom ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, color: c.muted, display: "block", marginBottom: 6 }}>{t("الميزانية (دولار)", "Budget (USD)")}</label>
                  <input type="number" min={1} value={usdInput} onChange={(e) => setUsdInput(e.target.value)} placeholder={t("مثال: 25", "e.g. 25")} style={input} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: c.muted, display: "block", marginBottom: 6 }}>{t("المدة (أيام)", "Duration (days)")}</label>
                  <input type="number" min={1} max={90} value={days} onChange={(e) => { setDays(e.target.value); setEndDate(""); }} placeholder="7" style={input} />
                </div>
              </div>
              {/* Calendar — pick an end date, days auto-computed */}
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, color: c.muted, display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <Calendar size={13} /> {t("أو اختر تاريخ انتهاء الإعلان من التقويم", "Or pick an end date from the calendar")}
                </label>
                <input type="date" value={endDate}
                  min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                  max={new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{ ...input, colorScheme: light ? "light" : "dark" }} />
                {endDate && <p style={{ fontSize: 11.5, color: PINK, marginTop: 6 }}>{t(`= ${daysVal} يوم`, `= ${daysVal} days`)}</p>}
              </div>
              <p style={{ fontSize: 11.5, color: "#f0b429", marginTop: 10 }}>⭐ {t("حرية كاملة — أي ميزانية وأي مدة تريدها.", "Full freedom — any budget, any duration.")}</p>
            </>
          ) : (
            <>
              {/* Tier selector */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
                {AD_TIER_PACKAGES.map((p) => {
                  const medal = p.level === 1 ? "#f0b429" : p.level === 2 ? "#9aa4b2" : "#c07b45";
                  const active = tierPkgId === p.id;
                  return (
                    <button key={p.id} type="button" onClick={() => setTierPkgId(p.id)}
                      style={{ textAlign: "center", padding: "12px 6px", borderRadius: 13, cursor: "pointer", fontFamily: "inherit",
                        border: active ? `2px solid ${medal}` : `1px solid ${c.border}`, background: active ? `${medal}18` : c.inputBg }}>
                      <div style={{ width: 30, height: 30, margin: "0 auto 6px", borderRadius: "50%", background: `${medal}22`, border: `1.5px solid ${medal}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, color: medal }}>{p.level}</div>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: active ? medal : c.text }}>{t(p.name, p.nameEn)}</div>
                    </button>
                  );
                })}
              </div>

              {/* Duration selector */}
              <label style={{ fontSize: 12, color: c.muted, display: "block", marginBottom: 8 }}>{t("المدة", "Duration")}</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                {tierPkg.options.map((o) => {
                  const active = pkgDays === o.days;
                  return (
                    <button key={o.days} type="button" onClick={() => setPkgDays(o.days)}
                      style={{ padding: "12px 6px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "center",
                        border: active ? `2px solid ${PINK}` : `1px solid ${c.border}`, background: active ? PINK_BG : c.inputBg }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: active ? PINK : c.text }}>{t(`${o.days} أيام`, `${o.days}d`)}</div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: active ? PINK : c.text, marginTop: 2 }}>{o.priceLyd} <span style={{ fontSize: 9, color: c.dim }}>{LYD}</span></div>
                    </button>
                  );
                })}
              </div>

              {!isVip && (
                <button type="button" onClick={() => router.push("/ads/vip")}
                  style={{ marginTop: 14, width: "100%", background: "transparent", border: "1px solid rgba(240,180,41,0.5)", borderRadius: 11, padding: "10px 0", color: "#f0b429", fontWeight: 800, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                  <Crown size={14} /> {t("ترقية إلى VIP للتحكم الحر بالميزانية", "Go VIP for a free custom budget")}
                </button>
              )}
            </>
          )}
        </div>

        {/* Live price summary */}
        <div style={{ background: PINK_BG, border: `1px solid ${PINK}44`, borderRadius: 18, padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {usingCustom ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", color: c.muted, fontSize: 14 }}><span>{t("ميزانية الإعلان", "Ad budget")}</span><span>${vipPrice?.budgetUsd ?? 0}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", color: c.muted, fontSize: 14 }}><span>{t("المدة", "Duration")}</span><span>{t(`${daysVal} أيام`, `${daysVal} days`)}</span></div>
              </>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", color: c.muted, fontSize: 14 }}><span>{t("الباقة", "Package")}</span><span>{t(tierPkg.name, tierPkg.nameEn)} · {t(`${daysVal} أيام`, `${daysVal} days`)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: c.muted, fontSize: 14 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Eye size={14} /> {t("المشاهدات المتوقعة", "Expected views")}</span>
                  <span>{opt ? `${opt.viewsMin.toLocaleString("en")}–${opt.viewsMax.toLocaleString("en")}` : "—"}</span>
                </div>
              </>
            )}
            <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "baseline", fontWeight: 900, fontSize: 18 }}>
              <span>{t("الإجمالي", "Total")}</span>
              <span style={{ fontSize: 26, background: G_HERO, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{totalLyd} <span style={{ fontSize: 14, WebkitTextFillColor: c.muted }}>{LYD}</span></span>
            </div>
          </div>
        </div>

        {/* Duration note */}
        <div style={{ background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "#f59e0b", display: "flex", alignItems: "flex-start", gap: 10 }}>
          <Calendar size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{t("سيبدأ إعلانك خلال دقائق من تأكيد الدفع، ويعمل على ", "Your ad starts within minutes of payment, running for ")}<strong>{t(`${daysVal} أيام`, `${daysVal} days`)}</strong>{mapPin ? t(` حول نقطة محددة بنطاق ${mapPin.radius} كم${cities.length > 0 ? ` و${cities.length} مدينة` : ""}.`, ` around a pinned point (${mapPin.radius} km)${cities.length > 0 ? ` and ${cities.length} cit${cities.length === 1 ? "y" : "ies"}` : ""}.`) : cities.length > 0 ? t(` في ${cities.length} مدينة محددة.`, ` in ${cities.length} selected cit${cities.length === 1 ? "y" : "ies"}.`) : t(" في كل ليبيا.", " across all of Libya.")}</span>
        </div>

        {/* Submit */}
        <button onClick={submit} disabled={saving}
          style={{ width: "100%", background: G_HERO, border: "none", borderRadius: 15, padding: "16px 0", color: "#fff", fontWeight: 900, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: saving ? 0.7 : 1, fontFamily: "inherit" }}>
          {saving ? <Loader2 size={20} className="spin" /> : <CheckCircle size={20} />}
          {saving ? t("جارٍ الحفظ...", "Saving...") : t("التالي — الدفع", "Next — payment")}
        </button>
      </div>

      <AdsBottomNav />
      <style>{`@keyframes spin-anim{to{transform:rotate(360deg)}} .spin{animation:spin-anim 1s linear infinite}`}</style>
    </div>
  );
}

export default function CreatePage() {
  return <Suspense><CreateCampaignInner /></Suspense>;
}
