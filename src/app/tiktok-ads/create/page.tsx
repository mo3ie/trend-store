"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Loader2, Check, Eye, Users, Sparkles, Wand2,
  AlertCircle, Search, X, Info, Infinity as InfinityIcon, Link2,
} from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useTheme } from "@/hooks/useTheme";
import { botColors } from "@/lib/botTheme";
import LangToggle from "@/components/LangToggle";

const PINK = "#ff0050", CYAN = "#00f2ea", GREEN = "#22c55e", AMBER = "#f59e0b";
const G_TT = "linear-gradient(135deg,#ff0050,#ff4d80 55%,#00f2ea)";

interface AdOption { days: number; priceLyd: number; budgetUsd: number; viewsMin: number; viewsMax: number }
interface AdPackage { id: string; name: string; nameEn: string; level: number; options: AdOption[] }
interface Me {
  configured: boolean; connected: boolean; vip: boolean; minDailyUsd: number;
  advertisers: Array<{ advertiserId: string; name: string; currency: string }>;
  pricing: { packages: AdPackage[]; rate: number; commission: number };
}
interface Identity { identityId: string; identityType: string; displayName: string; avatarUrl: string | null }
interface SparkVideo { itemId: string; caption: string; thumbnail: string | null }
interface Picked { id: string; name: string }

/**
 * The customer-facing goal list. The labels match the Facebook create screen so the
 * two read alike, while each one maps to a different TikTok objective server-side.
 */
const OBJECTIVES = [
  { id: "video_views", ar: "مشاهدات الفيديو", en: "Video views" },
  { id: "reach",       ar: "أكبر وصول",        en: "Reach" },
  { id: "traffic",     ar: "زيارات المتجر",    en: "Store traffic" },
  { id: "engagement",  ar: "تفاعل",            en: "Engagement" },
  { id: "followers",   ar: "زيادة المتابعين",  en: "More followers" },
];

export default function TikTokAdsCreatePage() {
  const router = useRouter();
  const { t, rtl } = useLang();
  const { light } = useTheme();
  const c = botColors(light);
  const Fwd = rtl ? ArrowLeft : ArrowRight;
  const LYD = t("د.ل", "LYD");

  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [advertiserId, setAdvertiserId] = useState("");
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [identityNeedsLink, setIdentityNeedsLink] = useState<string | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [videos, setVideos] = useState<SparkVideo[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [itemId, setItemId] = useState("");

  const [objective, setObjective] = useState("video_views");
  const [adText, setAdText] = useState("");

  // Budget: a fixed package, or a free budget for subscribers.
  const [mode, setMode] = useState<"package" | "custom" | "continuous">("package");
  const [pkgId, setPkgId] = useState("first");
  const [days, setDays] = useState(5);
  const [budgetUsd, setBudgetUsd] = useState(0);

  // Targeting
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(34);
  const [gender, setGender] = useState<"all" | "male" | "female">("all");
  const [locations, setLocations] = useState<Picked[]>([]);
  const [interests, setInterests] = useState<Picked[]>([]);
  const [locQuery, setLocQuery] = useState("");
  const [locResults, setLocResults] = useState<Picked[]>([]);
  const [intQuery, setIntQuery] = useState("");
  const [intResults, setIntResults] = useState<Picked[]>([]);

  // AI helpers
  const [aiDesc, setAiDesc] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState("");
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyVariants, setCopyVariants] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/tiktok/ads/me")
      .then((r) => (r.status === 401 ? null : r.json()))
      .then((d) => {
        if (!d) { router.push("/login?next=/tiktok-ads/create"); return; }
        setMe(d);
        if (!d.connected) { router.push("/tiktok-ads"); return; }
        setAdvertiserId(d.advertisers?.[0]?.advertiserId || "");
      })
      .catch(() => setError(t("تعذّر تحميل البيانات", "Could not load")))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Identities for the chosen ad account.
  useEffect(() => {
    if (!advertiserId) return;
    setIdentity(null); setVideos([]); setItemId("");
    fetch(`/api/tiktok/ads/identities?advertiserId=${encodeURIComponent(advertiserId)}`)
      .then((r) => r.json())
      .then((d) => {
        setIdentities(d.identities || []);
        setIdentityNeedsLink(d.needsLink ? (d.message || "") : null);
        if ((d.identities || []).length === 1) setIdentity(d.identities[0]);
      })
      .catch(() => {});
  }, [advertiserId]);

  // Promotable videos for the chosen identity.
  useEffect(() => {
    if (!identity || !advertiserId) return;
    setVideosLoading(true); setItemId("");
    const q = new URLSearchParams({
      advertiserId, identityId: identity.identityId, identityType: identity.identityType,
    });
    fetch(`/api/tiktok/ads/spark-videos?${q}`)
      .then((r) => r.json())
      .then((d) => setVideos(d.videos || []))
      .catch(() => setVideos([]))
      .finally(() => setVideosLoading(false));
  }, [identity, advertiserId]);

  // Debounced lookups. Both lists come from TikTok, so they are queried on a pause in
  // typing rather than on every keystroke.
  useEffect(() => {
    if (!advertiserId || locQuery.trim().length < 2) { setLocResults([]); return; }
    const id = setTimeout(() => {
      fetch(`/api/tiktok/ads/geo?q=${encodeURIComponent(locQuery)}&advertiserId=${encodeURIComponent(advertiserId)}`)
        .then((r) => r.json())
        .then((d) => setLocResults((d.locations || []).map((l: Picked) => ({ id: l.id, name: l.name }))))
        .catch(() => {});
    }, 400);
    return () => clearTimeout(id);
  }, [locQuery, advertiserId]);

  useEffect(() => {
    if (!advertiserId || intQuery.trim().length < 2) { setIntResults([]); return; }
    const id = setTimeout(() => {
      fetch(`/api/tiktok/ads/interests?q=${encodeURIComponent(intQuery)}&advertiserId=${encodeURIComponent(advertiserId)}`)
        .then((r) => r.json())
        .then((d) => setIntResults((d.interests || []).map((i: Picked) => ({ id: i.id, name: i.name }))))
        .catch(() => {});
    }, 400);
    return () => clearTimeout(id);
  }, [intQuery, advertiserId]);

  const minDaily = me?.minDailyUsd ?? 20;
  const packages = me?.pricing?.packages || [];
  const activePkg = packages.find((p) => p.id === pkgId) || packages[0];
  const activeOption = activePkg?.options.find((o) => o.days === days) || activePkg?.options[0];

  // The floor, restated for whatever the advertiser is currently choosing.
  const floorUsd = mode === "continuous" ? minDaily : minDaily * Math.max(1, days);

  // Price preview. Package prices come from the server's list; a free budget is
  // previewed with the same arithmetic the server will apply, and the server's number
  // is still the one charged.
  const rate = me?.pricing?.rate ?? 12;
  const commission = me?.pricing?.commission ?? 0;
  const previewLyd = mode === "package"
    ? (activeOption?.priceLyd ?? 0)
    : Math.ceil(Math.ceil(budgetUsd * rate) * (1 + commission / 100));

  const applyAi = useCallback(async () => {
    if (!aiDesc.trim()) return;
    setAiBusy(true); setAiMsg(""); setError("");
    try {
      const r = await fetch("/api/tiktok/ads/ai-targeting", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiDesc, advertiserId }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.message || d.error || t("تعذّر الاقتراح", "Suggestion failed")); setAiBusy(false); return; }
      setAgeMin(d.ageMin); setAgeMax(d.ageMax); setGender(d.gender);
      setLocations(d.locations || []); setInterests(d.interests || []);
      if (d.objective) setObjective(d.objective);
      // The assistant's budget is only a legal one in free-budget mode, so switching
      // there is part of applying its advice rather than a surprise the user undoes.
      if (me?.vip) { setMode("custom"); setDays(d.days); setBudgetUsd(d.budgetUsd); }
      setAiMsg([d.message, d.expected].filter(Boolean).join(" "));
    } catch {
      setError(t("تعذّر الاتصال بالمساعد", "Could not reach the assistant"));
    }
    setAiBusy(false);
  }, [aiDesc, advertiserId, me?.vip, t]);

  async function generateCopy() {
    if (!aiDesc.trim()) { setError(t("اكتب وصفاً لمنتجك أولاً", "Describe your product first")); return; }
    setCopyBusy(true); setError("");
    try {
      const r = await fetch("/api/tiktok/ads/ad-copy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiDesc }),
      });
      const d = await r.json();
      if (!r.ok) setError(d.error || t("تعذّر توليد النصوص", "Could not generate texts"));
      else setCopyVariants(d.variations || []);
    } catch {
      setError(t("تعذّر الاتصال", "Connection failed"));
    }
    setCopyBusy(false);
  }

  async function submit() {
    setError("");
    if (!identity) { setError(t("اختر هوية تيك توك", "Pick a TikTok identity")); return; }
    if (objective !== "followers" && !itemId) { setError(t("اختر الفيديو المراد ترويجه", "Pick the video to promote")); return; }
    if (mode !== "package" && budgetUsd < floorUsd) {
      setError(t(`الحد الأدنى ${floorUsd}$ لهذه المدة`, `Minimum $${floorUsd} for this duration`));
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch("/api/tiktok/ads/campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advertiserId,
          identityId: identity.identityId,
          identityType: identity.identityType,
          identityName: identity.displayName,
          itemId: objective === "followers" ? null : itemId,
          objective,
          adText,
          landingPageUrl: "https://www.trendstore-ly.com",
          packageId: mode === "package" ? pkgId : undefined,
          budgetUsd: mode === "package" ? undefined : budgetUsd,
          durationDays: mode === "continuous" ? undefined : days,
          continuous: mode === "continuous",
          targeting: {
            ageMin, ageMax, gender,
            locationIds: locations.map((l) => l.id),
            interestIds: interests.map((i) => i.id),
            locations, interests,
          },
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.message || d.error || t("تعذّر إنشاء الحملة", "Could not create the campaign")); setSubmitting(false); return; }
      router.push(`/ads/checkout?campaignId=${d.campaign.id}`);
    } catch {
      setError(t("تعذّر الاتصال", "Connection failed"));
      setSubmitting(false);
    }
  }

  const card: React.CSSProperties = {
    background: c.card, border: `1px solid ${c.border}`, borderRadius: 18, padding: 20, marginTop: 14,
  };
  const inp: React.CSSProperties = {
    width: "100%", background: c.input, border: `1px solid ${c.border}`,
    borderRadius: 10, padding: "10px 12px", color: c.text, boxSizing: "border-box", fontFamily: "inherit", fontSize: 14,
  };
  const h2: React.CSSProperties = { fontSize: 16, fontWeight: 800, margin: "0 0 14px" };
  const chip = (selected: boolean): React.CSSProperties => ({
    background: selected ? `${PINK}26` : c.surface,
    border: `1px solid ${selected ? PINK : c.border}`,
    borderRadius: 10, padding: "9px 14px", color: c.text, fontWeight: 700,
    fontSize: 13, cursor: "pointer", fontFamily: "inherit",
  });

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: c.gradient, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={26} className="spin" color={PINK} />
      </div>
    );
  }

  return (
    <div dir={rtl ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: c.gradient, color: c.text }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "18px 16px 70px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => router.push("/tiktok-ads")}
            style={{ background: "none", border: "none", color: c.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", fontSize: 14 }}>
            <Fwd size={18} /> {t("إعلانات تيك توك", "TikTok Ads")}
          </button>
          <LangToggle />
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "16px 0 0" }}>{t("حملة جديدة", "New campaign")}</h1>

        {/* ── Ad account ─────────────────────────────────────────────────── */}
        {(me?.advertisers?.length || 0) > 1 && (
          <div style={card}>
            <h2 style={h2}>{t("الحساب الإعلاني", "Ad account")}</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {me!.advertisers.map((a) => (
                <button key={a.advertiserId} onClick={() => setAdvertiserId(a.advertiserId)} style={chip(advertiserId === a.advertiserId)}>
                  {a.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Identity + video ───────────────────────────────────────────── */}
        <div style={card}>
          <h2 style={h2}>{t("الحساب والفيديو", "Account & video")}</h2>

          {identityNeedsLink !== null ? (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: `${AMBER}14`, border: `1px solid ${AMBER}44`, borderRadius: 12, padding: "12px 14px" }}>
              <Link2 size={17} color={AMBER} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 13, color: c.text, lineHeight: 1.8 }}>{identityNeedsLink}</div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {identities.map((i) => (
                  <button key={i.identityId} onClick={() => setIdentity(i)} style={{ ...chip(identity?.identityId === i.identityId), display: "flex", alignItems: "center", gap: 8 }}>
                    {i.avatarUrl && <img src={i.avatarUrl} alt="" width={22} height={22} style={{ borderRadius: 999 }} />}
                    {i.displayName}
                  </button>
                ))}
              </div>

              {identity && objective !== "followers" && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 13, color: c.muted, marginBottom: 10 }}>
                    {t("اختر الفيديو الذي تريد ترويجه", "Pick the video to promote")}
                  </div>
                  {videosLoading ? (
                    <Loader2 size={20} className="spin" color={PINK} />
                  ) : videos.length === 0 ? (
                    <div style={{ fontSize: 12.5, color: c.dim, lineHeight: 1.8 }}>
                      {t("لا توجد فيديوهات قابلة للترويج في هذا الحساب. انشر فيديو أولاً ثم عُد.",
                         "No promotable videos on this account. Post a video first, then come back.")}
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: 10 }}>
                      {videos.map((v) => (
                        <button key={v.itemId} onClick={() => setItemId(v.itemId)}
                          style={{ position: "relative", background: c.surface, border: `2px solid ${itemId === v.itemId ? PINK : c.border}`, borderRadius: 12, padding: 0, cursor: "pointer", overflow: "hidden", aspectRatio: "9/16", fontFamily: "inherit" }}>
                          {v.thumbnail
                            ? <img src={v.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <div style={{ padding: 10, fontSize: 11, color: c.muted, textAlign: "start" }}>{v.caption.slice(0, 60)}</div>}
                          {itemId === v.itemId && (
                            <div style={{ position: "absolute", top: 6, inset: rtl ? "6px 6px auto auto" : "6px auto auto 6px", background: PINK, borderRadius: 999, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Check size={14} color="#fff" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Goal ───────────────────────────────────────────────────────── */}
        <div style={card}>
          <h2 style={h2}>{t("هدف الحملة", "Campaign goal")}</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {OBJECTIVES.map((o) => (
              <button key={o.id} onClick={() => setObjective(o.id)} style={chip(objective === o.id)}>
                {t(o.ar, o.en)}
              </button>
            ))}
          </div>
          {objective === "followers" && (
            <div style={{ fontSize: 12.5, color: c.muted, marginTop: 12, lineHeight: 1.8 }}>
              {t("هذا الهدف يروّج حسابك نفسه لزيادة المتابعين — لا يحتاج اختيار فيديو.",
                 "This goal promotes your profile to gain followers — no video needed.")}
            </div>
          )}
        </div>

        {/* ── AI assistant ───────────────────────────────────────────────── */}
        <div style={card}>
          <h2 style={{ ...h2, display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={17} color={CYAN} /> {t("المساعد الذكي", "AI assistant")}
          </h2>
          <textarea value={aiDesc} onChange={(e) => setAiDesc(e.target.value)} rows={3}
            placeholder={t("صف منتجك وجمهورك… مثال: عطور نسائية في طرابلس، أسعار متوسطة",
                           "Describe your product and audience… e.g. women's perfume in Tripoli, mid-range prices")}
            style={{ ...inp, resize: "vertical" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button onClick={applyAi} disabled={aiBusy || !me?.vip}
              style={{ flex: "1 1 180px", background: me?.vip ? G_TT : c.surface, color: me?.vip ? "#fff" : c.dim, border: me?.vip ? "none" : `1px solid ${c.border}`, borderRadius: 11, padding: "11px 0", fontWeight: 700, fontSize: 13.5, cursor: me?.vip ? "pointer" : "not-allowed", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              {aiBusy ? <Loader2 size={15} className="spin" /> : <Wand2 size={15} />}
              {t("اقترح الاستهداف والميزانية", "Suggest targeting & budget")}
            </button>
            <button onClick={generateCopy} disabled={copyBusy}
              style={{ flex: "1 1 160px", background: c.surface, color: c.text, border: `1px solid ${c.border}`, borderRadius: 11, padding: "11px 0", fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              {copyBusy ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
              {t("اكتب نص الإعلان", "Write the ad text")}
            </button>
          </div>
          {!me?.vip && (
            <div style={{ fontSize: 12, color: c.dim, marginTop: 9, lineHeight: 1.75 }}>
              {t("اقتراح الاستهداف متاح لمشتركي إعلانات تيك توك.", "Targeting suggestions are for TikTok Ads subscribers.")}
            </div>
          )}
          {aiMsg && (
            <div style={{ fontSize: 12.5, color: c.muted, marginTop: 12, lineHeight: 1.85, background: c.surface, borderRadius: 11, padding: "11px 13px" }}>{aiMsg}</div>
          )}
          {copyVariants.length > 0 && (
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {copyVariants.map((v, i) => (
                <button key={i} onClick={() => setAdText(v)}
                  style={{ textAlign: "start", background: adText === v ? `${CYAN}1f` : c.surface, border: `1px solid ${adText === v ? CYAN : c.borderSoft}`, borderRadius: 11, padding: "11px 13px", color: c.text, fontSize: 13, lineHeight: 1.8, cursor: "pointer", fontFamily: "inherit" }}>
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Ad text ────────────────────────────────────────────────────── */}
        <div style={card}>
          <h2 style={h2}>{t("نص الإعلان", "Ad text")}</h2>
          <input value={adText} onChange={(e) => setAdText(e.target.value.slice(0, 100))}
            placeholder={t("نص قصير يظهر مع الإعلان", "A short line shown with the ad")} style={inp} />
          <div style={{ fontSize: 11.5, color: adText.length > 90 ? AMBER : c.dim, marginTop: 7 }}>
            {adText.length}/100 — {t("تيك توك يقتصّ ما يزيد عن ١٠٠ حرف", "TikTok truncates anything over 100 characters")}
          </div>
        </div>

        {/* ── Targeting ──────────────────────────────────────────────────── */}
        <div style={card}>
          <h2 style={{ ...h2, display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={17} color={PINK} /> {t("الجمهور", "Audience")}
          </h2>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label style={{ flex: "1 1 120px", fontSize: 12.5, color: c.muted }}>
              {t("العمر من", "Age from")}
              <input type="number" min={13} max={65} value={ageMin}
                onChange={(e) => setAgeMin(Number(e.target.value))} style={{ ...inp, marginTop: 6 }} />
            </label>
            <label style={{ flex: "1 1 120px", fontSize: 12.5, color: c.muted }}>
              {t("إلى", "to")}
              <input type="number" min={13} max={65} value={ageMax}
                onChange={(e) => setAgeMax(Number(e.target.value))} style={{ ...inp, marginTop: 6 }} />
            </label>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {([["all", t("الجميع", "All")], ["male", t("ذكور", "Men")], ["female", t("إناث", "Women")]] as const).map(([g, label]) => (
              <button key={g} onClick={() => setGender(g)} style={{ ...chip(gender === g), flex: "1 1 90px" }}>{label}</button>
            ))}
          </div>

          {/* Locations */}
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 12.5, color: c.muted, marginBottom: 7 }}>{t("المدن والمناطق", "Cities & regions")}</div>
            {locations.length > 0 && (
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 9 }}>
                {locations.map((l) => (
                  <span key={l.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${PINK}1f`, border: `1px solid ${PINK}55`, borderRadius: 999, padding: "5px 11px", fontSize: 12.5 }}>
                    {l.name}
                    <X size={13} style={{ cursor: "pointer" }} onClick={() => setLocations(locations.filter((x) => x.id !== l.id))} />
                  </span>
                ))}
              </div>
            )}
            <div style={{ position: "relative" }}>
              <Search size={15} color={c.dim} style={{ position: "absolute", top: 12, [rtl ? "right" : "left"]: 11 }} />
              <input value={locQuery} onChange={(e) => setLocQuery(e.target.value)}
                placeholder={t("ابحث عن مدينة… (اتركه فارغاً لكل ليبيا)", "Search a city… (leave empty for all Libya)")}
                style={{ ...inp, [rtl ? "paddingRight" : "paddingLeft"]: 34 }} />
            </div>
            {locResults.length > 0 && (
              <div style={{ display: "grid", gap: 6, marginTop: 8, maxHeight: 180, overflowY: "auto" }}>
                {locResults.map((l) => (
                  <button key={l.id}
                    onClick={() => { if (!locations.find((x) => x.id === l.id)) setLocations([...locations, l]); setLocQuery(""); setLocResults([]); }}
                    style={{ textAlign: "start", background: c.surface, border: `1px solid ${c.borderSoft}`, borderRadius: 9, padding: "9px 12px", color: c.text, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                    {l.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Interests */}
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 12.5, color: c.muted, marginBottom: 7 }}>{t("الاهتمامات", "Interests")}</div>
            {interests.length > 0 && (
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 9 }}>
                {interests.map((i) => (
                  <span key={i.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${CYAN}1f`, border: `1px solid ${CYAN}55`, borderRadius: 999, padding: "5px 11px", fontSize: 12.5 }}>
                    {i.name}
                    <X size={13} style={{ cursor: "pointer" }} onClick={() => setInterests(interests.filter((x) => x.id !== i.id))} />
                  </span>
                ))}
              </div>
            )}
            <div style={{ position: "relative" }}>
              <Search size={15} color={c.dim} style={{ position: "absolute", top: 12, [rtl ? "right" : "left"]: 11 }} />
              <input value={intQuery} onChange={(e) => setIntQuery(e.target.value)}
                placeholder={t("ابحث عن اهتمام…", "Search an interest…")}
                style={{ ...inp, [rtl ? "paddingRight" : "paddingLeft"]: 34 }} />
            </div>
            {intResults.length > 0 && (
              <div style={{ display: "grid", gap: 6, marginTop: 8, maxHeight: 180, overflowY: "auto" }}>
                {intResults.map((i) => (
                  <button key={i.id}
                    onClick={() => { if (!interests.find((x) => x.id === i.id)) setInterests([...interests, i]); setIntQuery(""); setIntResults([]); }}
                    style={{ textAlign: "start", background: c.surface, border: `1px solid ${c.borderSoft}`, borderRadius: 9, padding: "9px 12px", color: c.text, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                    {i.name}
                  </button>
                ))}
              </div>
            )}
            <div style={{ fontSize: 11.5, color: c.dim, marginTop: 9, lineHeight: 1.75 }}>
              {t("على تيك توك، الاستهداف الواسع يؤدي أفضل من الضيّق — اترك الاهتمامات فارغة إن لم تكن متأكداً.",
                 "On TikTok broad targeting outperforms narrow — leave interests empty if unsure.")}
            </div>
          </div>
        </div>

        {/* ── Budget ─────────────────────────────────────────────────────── */}
        <div style={card}>
          <h2 style={h2}>{t("الميزانية والمدة", "Budget & duration")}</h2>

          <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: c.surface, border: `1px solid ${c.borderSoft}`, borderRadius: 12, padding: "11px 13px", marginBottom: 14 }}>
            <Info size={16} color={CYAN} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.8 }}>
              {t(`تيك توك يفرض حدّاً أدنى ${minDaily}$ للإنفاق اليومي — أي ${floorUsd}$ على الأقل لهذه المدة. شرط من المنصّة، لا عمولة منّا.`,
                 `TikTok enforces a $${minDaily} minimum daily spend — at least $${floorUsd} for this duration. That is the platform's rule, not a fee from us.`)}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => setMode("package")} style={{ ...chip(mode === "package"), flex: "1 1 120px" }}>
              {t("باقة جاهزة", "A package")}
            </button>
            <button onClick={() => me?.vip && setMode("custom")} disabled={!me?.vip}
              style={{ ...chip(mode === "custom"), flex: "1 1 120px", opacity: me?.vip ? 1 : 0.5, cursor: me?.vip ? "pointer" : "not-allowed" }}>
              {t("ميزانية حرة", "Free budget")}
            </button>
            <button onClick={() => me?.vip && setMode("continuous")} disabled={!me?.vip}
              style={{ ...chip(mode === "continuous"), flex: "1 1 120px", opacity: me?.vip ? 1 : 0.5, cursor: me?.vip ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <InfinityIcon size={14} /> {t("مفتوحة", "Open-ended")}
            </button>
          </div>
          {!me?.vip && (
            <div style={{ fontSize: 12, color: c.dim, marginTop: 9, lineHeight: 1.75 }}>
              {t("الميزانية الحرة والحملات المفتوحة لمشتركي إعلانات تيك توك.", "Free budgets and open-ended campaigns are for TikTok Ads subscribers.")}
            </div>
          )}

          {mode === "package" && (
            <>
              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                {packages.map((p) => (
                  <button key={p.id} onClick={() => setPkgId(p.id)} style={{ ...chip(pkgId === p.id), flex: "1 1 100px" }}>
                    {t(p.name, p.nameEn)}
                  </button>
                ))}
              </div>
              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                {(activePkg?.options || []).map((o) => (
                  <button key={o.days} onClick={() => setDays(o.days)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: days === o.days ? `${PINK}1a` : c.surface, border: `1px solid ${days === o.days ? PINK : c.borderSoft}`, borderRadius: 12, padding: "12px 14px", color: c.text, cursor: "pointer", fontFamily: "inherit", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700 }}>{o.days} {t("أيام", "days")}</span>
                    <span style={{ fontSize: 12.5, color: c.muted }}>
                      <Eye size={13} style={{ verticalAlign: "-2px" }} /> {o.viewsMin.toLocaleString()}–{o.viewsMax.toLocaleString()}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: PINK }}>{o.priceLyd.toLocaleString()} {LYD}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {mode !== "package" && (
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <label style={{ flex: "1 1 160px", fontSize: 12.5, color: c.muted }}>
                {mode === "continuous" ? t("الميزانية اليومية ($)", "Daily budget ($)") : t("الميزانية الكلية ($)", "Total budget ($)")}
                <input type="number" min={floorUsd} value={budgetUsd || ""}
                  onChange={(e) => setBudgetUsd(Number(e.target.value))}
                  placeholder={String(floorUsd)} style={{ ...inp, marginTop: 6 }} />
              </label>
              {mode === "custom" && (
                <label style={{ flex: "1 1 120px", fontSize: 12.5, color: c.muted }}>
                  {t("المدة (أيام)", "Duration (days)")}
                  <input type="number" min={1} max={30} value={days}
                    onChange={(e) => setDays(Number(e.target.value))} style={{ ...inp, marginTop: 6 }} />
                </label>
              )}
            </div>
          )}
        </div>

        {/* ── Summary + submit ───────────────────────────────────────────── */}
        <div style={{ ...card, background: G_TT, border: "none", color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12.5, opacity: 0.9 }}>
                {mode === "continuous" ? t("السعر اليومي", "Daily price") : t("الإجمالي", "Total")}
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>
                {previewLyd.toLocaleString()} {LYD}
              </div>
              {mode === "continuous" && (
                <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 5, lineHeight: 1.7 }}>
                  {t("يُخصم يوم واحد الآن، ثم يوم بيوم من محفظتك حتى توقفها.",
                     "One day is charged now, then daily from your wallet until you stop it.")}
                </div>
              )}
            </div>
            <button onClick={submit} disabled={submitting}
              style={{ background: "#fff", color: "#111", border: "none", borderRadius: 12, padding: "13px 24px", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, opacity: submitting ? 0.7 : 1 }}>
              {submitting ? <Loader2 size={17} className="spin" /> : <Check size={17} />}
              {t("متابعة للدفع", "Continue to payment")}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "#ef444418", border: "1px solid #ef444455", borderRadius: 12, padding: "12px 14px", marginTop: 14 }}>
            <AlertCircle size={17} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13, lineHeight: 1.8 }}>{error}</div>
          </div>
        )}
      </div>
    </div>
  );
}
