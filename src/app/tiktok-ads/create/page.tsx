"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Loader2, Check, Loader, AlertCircle, Link2,
  Sparkles, Wand2, Flame, Save, Users, X, Swords,
} from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useTheme } from "@/hooks/useTheme";
import LangToggle from "@/components/LangToggle";
import {
  tt, ttCard, ttPrimary, ttSecondary, ttInput, ttStage, ttOverlayText,
  TT_SCRIM, TT_PINK, TT_CYAN, TT_AD_TEXT_MAX,
} from "@/lib/tiktokTheme";
import {
  AccountStrip, ScreenTitle, SpendReceipt, Disclosure, Chip, BudgetSlider,
} from "@/components/tiktok/TikTokKit";

/**
 * Creating a TikTok campaign.
 *
 * Five steps in the order the design direction set, because each one narrows what the
 * next has to ask: pick the video, pick the goal, set the audience (defaulting to
 * broad), set the budget against a visible floor, then review.
 *
 * Three decisions worth stating:
 *   * Videos are sorted so the organically strongest come first and the top three
 *     carry a badge. Spark Ads amplify what already works, so steering the advertiser
 *     there is the single highest-value thing this screen does.
 *   * The audience defaults to broad and hides interests behind "advanced". Narrow
 *     targeting starves delivery on TikTok, so the default must be the good choice.
 *   * The A/B test is two VIDEOS, not two audiences — on TikTok the clip is what
 *     decides delivery, so "which of my videos works?" is the question worth money.
 */

interface AdOption { days: number; priceLyd: number; budgetUsd: number; viewsMin: number; viewsMax: number }
interface AdPackage { id: string; name: string; nameEn: string; level: number; options: AdOption[] }
interface Me {
  configured: boolean; connected: boolean; vip: boolean; minDailyUsd: number;
  advertisers: Array<{ advertiserId: string; name: string }>;
  pricing: { packages: AdPackage[]; rate: number; commission: number };
}
interface Identity { identityId: string; identityType: string; displayName: string; avatarUrl: string | null }
interface SparkVideo { itemId: string; caption: string; thumbnail: string | null }
interface Picked { id: string; name: string }
interface Audience { id: string; name: string; targeting: Record<string, unknown> }

const GOALS = [
  { id: "video_views", ar: "مشاهدات",       en: "Views" },
  { id: "traffic",     ar: "زيارات المتجر", en: "Store visits" },
  { id: "followers",   ar: "متابعون",       en: "Followers" },
];

const AGE_BUCKETS: Array<[string, number, number, boolean]> = [
  ["18-24", 18, 24, true],
  ["25-34", 25, 34, true],
  ["35-44", 35, 44, false],
  ["45+",   45, 65, false],
];

function CreateInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { t, rtl } = useLang();
  const { light } = useTheme();
  const c = tt(light);
  const Back = rtl ? ArrowLeft : ArrowRight;

  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [advertiserId, setAdvertiserId] = useState("");
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [needsLink, setNeedsLink] = useState<string | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [videos, setVideos] = useState<SparkVideo[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);

  const [itemId, setItemId] = useState("");
  const [itemIdB, setItemIdB] = useState("");
  const [abMode, setAbMode] = useState(false);

  const [goal, setGoal] = useState("video_views");
  const [adText, setAdText] = useState("");

  // Audience — broad by default.
  const [ages, setAges] = useState<string[]>(["18-24", "25-34"]);
  const [gender, setGender] = useState<"all" | "male" | "female">("all");
  const [advanced, setAdvanced] = useState(false);
  const [locations, setLocations] = useState<Picked[]>([]);
  const [interests, setInterests] = useState<Picked[]>([]);
  const [locQ, setLocQ] = useState("");
  const [locRes, setLocRes] = useState<Picked[]>([]);
  const [intQ, setIntQ] = useState("");
  const [intRes, setIntRes] = useState<Picked[]>([]);

  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [audName, setAudName] = useState("");

  // Budget
  const [tier, setTier] = useState(params.get("tier") || "first");
  const [days, setDays] = useState(Number(params.get("days")) || 3);
  const [custom, setCustom] = useState(false);
  const [budgetUsd, setBudgetUsd] = useState(0);

  const [aiDesc, setAiDesc] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState("");
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyVariants, setCopyVariants] = useState<string[]>([]);

  const minDaily = me?.minDailyUsd ?? 20;
  const sides = abMode && itemIdB ? 2 : 1;
  const floorUsd = minDaily * Math.max(1, days) * sides;

  useEffect(() => {
    Promise.all([
      fetch("/api/tiktok/ads/me").then((r) => (r.status === 401 ? null : r.json())),
      fetch("/api/tiktok/ads/audiences").then((r) => r.json()).catch(() => ({})),
    ])
      .then(([m, a]) => {
        if (!m) { router.push("/login?next=/tiktok-ads/create"); return; }
        if (m.error) return;
        setMe(m);
        if (!m.connected) { router.push("/tiktok-ads"); return; }
        setAdvertiserId(m.advertisers?.[0]?.advertiserId || "");
        setAudiences(a.audiences || []);
      })
      .catch(() => setError(t("تعذّر التحميل", "Could not load")))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!advertiserId) return;
    setIdentity(null); setVideos([]); setItemId(""); setItemIdB("");
    fetch(`/api/tiktok/ads/identities?advertiserId=${encodeURIComponent(advertiserId)}`)
      .then((r) => r.json())
      .then((d) => {
        setIdentities(d.identities || []);
        setNeedsLink(d.needsLink ? (d.message || "") : null);
        if ((d.identities || []).length === 1) setIdentity(d.identities[0]);
      })
      .catch(() => {});
  }, [advertiserId]);

  useEffect(() => {
    if (!identity || !advertiserId) return;
    setVideosLoading(true); setItemId(""); setItemIdB("");
    const q = new URLSearchParams({ advertiserId, identityId: identity.identityId, identityType: identity.identityType });
    fetch(`/api/tiktok/ads/spark-videos?${q}`)
      .then((r) => r.json())
      .then((d) => setVideos(d.videos || []))
      .catch(() => setVideos([]))
      .finally(() => setVideosLoading(false));
  }, [identity, advertiserId]);

  useEffect(() => {
    if (!advertiserId || locQ.trim().length < 2) { setLocRes([]); return; }
    const id = setTimeout(() => {
      fetch(`/api/tiktok/ads/geo?q=${encodeURIComponent(locQ)}&advertiserId=${encodeURIComponent(advertiserId)}`)
        .then((r) => r.json())
        .then((d) => setLocRes((d.locations || []).map((l: Picked) => ({ id: l.id, name: l.name }))))
        .catch(() => {});
    }, 400);
    return () => clearTimeout(id);
  }, [locQ, advertiserId]);

  useEffect(() => {
    if (!advertiserId || intQ.trim().length < 2) { setIntRes([]); return; }
    const id = setTimeout(() => {
      fetch(`/api/tiktok/ads/interests?q=${encodeURIComponent(intQ)}&advertiserId=${encodeURIComponent(advertiserId)}`)
        .then((r) => r.json())
        .then((d) => setIntRes((d.interests || []).map((i: Picked) => ({ id: i.id, name: i.name }))))
        .catch(() => {});
    }, 400);
    return () => clearTimeout(id);
  }, [intQ, advertiserId]);

  const packages = me?.pricing.packages || [];
  const pkg = packages.find((p) => p.id === tier) || packages[0];
  const option = pkg?.options.find((o) => o.days === days) || pkg?.options[0];

  const rate = me?.pricing.rate ?? 12;
  const usd = custom ? budgetUsd : (option?.budgetUsd ?? 0);
  const totalLyd = custom
    ? Math.ceil(Math.ceil(usd * rate) * (1 + (me?.pricing.commission ?? 0) / 100))
    : (option?.priceLyd ?? 0);
  const platformLyd = Math.ceil(usd * rate);
  const feeLyd = Math.max(0, totalLyd - platformLyd);

  const ageRange = () => {
    const on = AGE_BUCKETS.filter(([k]) => ages.includes(k));
    if (!on.length) return { min: 18, max: 34 };
    return { min: Math.min(...on.map(([, a]) => a)), max: Math.max(...on.map(([, , b]) => b)) };
  };

  async function applyAi() {
    if (!aiDesc.trim()) return;
    setAiBusy(true); setAiMsg(""); setError("");
    try {
      const r = await fetch("/api/tiktok/ads/ai-targeting", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiDesc, advertiserId }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.message || d.error || t("تعذّر الاقتراح", "Suggestion failed")); setAiBusy(false); return; }
      setGender(d.gender);
      setLocations(d.locations || []); setInterests(d.interests || []);
      if ((d.locations || []).length || (d.interests || []).length) setAdvanced(true);
      if (d.objective && GOALS.some((g) => g.id === d.objective)) setGoal(d.objective);
      if (me?.vip) { setCustom(true); setDays(d.days); setBudgetUsd(d.budgetUsd); }
      setAiMsg([d.message, d.expected].filter(Boolean).join(" "));
    } catch {
      setError(t("تعذّر الاتصال بالمساعد", "Could not reach the assistant"));
    }
    setAiBusy(false);
  }

  async function writeAdText() {
    if (!aiDesc.trim()) { setError(t("صف منتجك أولاً", "Describe your product first")); return; }
    setCopyBusy(true); setError("");
    try {
      const r = await fetch("/api/tiktok/ads/ad-copy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiDesc }),
      });
      const d = await r.json();
      if (!r.ok) setError(d.error || t("تعذّر توليد النصوص", "Could not generate"));
      else setCopyVariants(d.variations || []);
    } catch {
      setError(t("تعذّر الاتصال", "Connection failed"));
    }
    setCopyBusy(false);
  }

  async function saveAudience() {
    if (!audName.trim()) return;
    const r = await fetch("/api/tiktok/ads/audiences", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: audName,
        targeting: { ages, gender, locations, interests },
      }),
    }).then((x) => x.json()).catch(() => null);
    if (r?.audience) { setAudiences([r.audience, ...audiences]); setAudName(""); }
  }

  function applyAudience(a: Audience) {
    const tg = a.targeting as {
      ages?: string[]; gender?: "all" | "male" | "female";
      locations?: Picked[]; interests?: Picked[];
    };
    if (tg.ages) setAges(tg.ages);
    if (tg.gender) setGender(tg.gender);
    setLocations(tg.locations || []);
    setInterests(tg.interests || []);
    if ((tg.locations || []).length || (tg.interests || []).length) setAdvanced(true);
  }

  async function submit() {
    setError("");
    if (!identity) { setError(t("اختر هوية الحساب", "Pick the account identity")); return; }
    if (goal !== "followers" && !itemId) { setError(t("اختر الفيديو", "Pick a video")); return; }
    if (abMode && !itemIdB) { setError(t("اختر الفيديو الثاني للمقارنة", "Pick the second video to compare")); return; }
    if (custom && usd < floorUsd) {
      setError(t(`الحدّ الأدنى ${floorUsd}$ لهذه المدة`, `Minimum $${floorUsd} for this duration`));
      return;
    }

    setSubmitting(true);
    const { min, max } = ageRange();
    try {
      const r = await fetch("/api/tiktok/ads/campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advertiserId,
          identityId: identity.identityId,
          identityType: identity.identityType,
          identityName: identity.displayName,
          itemId: goal === "followers" ? null : itemId,
          itemIdB: abMode ? itemIdB : null,
          objective: goal,
          adText,
          landingPageUrl: "https://www.trendstore-ly.com",
          packageId: custom ? undefined : tier,
          budgetUsd: custom ? usd : undefined,
          durationDays: days,
          targeting: {
            ageMin: min, ageMax: max, gender,
            locationIds: locations.map((l) => l.id),
            interestIds: interests.map((i) => i.id),
            locations, interests,
          },
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.message || d.error || t("تعذّر إنشاء الحملة", "Could not create")); setSubmitting(false); return; }
      router.push(`/ads/checkout?campaignId=${d.campaign.id}`);
    } catch {
      setError(t("تعذّر الاتصال", "Connection failed"));
      setSubmitting(false);
    }
  }

  const label = (s: string) => (
    <div style={{ fontSize: 12, fontWeight: 700, color: c.muted, margin: "0 0 8px" }}>{s}</div>
  );
  const section: React.CSSProperties = { ...ttCard(c), padding: 16, marginTop: 14 };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={24} className="spin" color={c.pinkInk} />
      </div>
    );
  }

  // The organically strongest first: Spark Ads amplify what already works.
  const ranked = videos;

  return (
    <div dir={rtl ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: c.bg, color: c.text }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "16px 16px 40px" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => router.push("/tiktok-ads")}
            style={{ background: "none", border: "none", color: c.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", fontSize: 14 }}>
            <Back size={18} /> {t("إعلانات تيك توك", "TikTok Ads")}
          </button>
          <LangToggle />
        </div>

        <div style={{ marginTop: 14 }}>
          <ScreenTitle c={c} rtl={rtl}>{t("حملة جديدة", "New campaign")}</ScreenTitle>
        </div>

        {(me?.advertisers.length || 0) > 1 && (
          <div style={{ ...ttCard(c), padding: 16 }}>
            {label(t("الحساب الإعلاني", "Ad account"))}
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {me!.advertisers.map((a) => (
                <Chip key={a.advertiserId} on={advertiserId === a.advertiserId} onClick={() => setAdvertiserId(a.advertiserId)} c={c}>
                  {a.name}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {/* ── 1. the video ─────────────────────────────────────────────────── */}
        <div style={section}>
          {label(t("١ · الفيديو", "1 · The video"))}

          {needsLink !== null ? (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: `${c.warn}14`, border: `1px solid ${c.warn}44`, borderRadius: 11, padding: "12px 13px" }}>
              <Link2 size={16} color={c.warn} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 12.5, lineHeight: 1.7 }}>{needsLink}</div>
            </div>
          ) : (
            <>
              {identities.length > 1 && (
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 13 }}>
                  {identities.map((i) => (
                    <Chip key={i.identityId} on={identity?.identityId === i.identityId} onClick={() => setIdentity(i)} c={c}>
                      {i.displayName}
                    </Chip>
                  ))}
                </div>
              )}

              {goal === "followers" ? (
                <div style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.7 }}>
                  {t("هدف المتابعين يروّج حسابك نفسه — لا يحتاج فيديو.",
                     "The followers goal promotes your account itself — no video needed.")}
                </div>
              ) : videosLoading ? (
                <Loader2 size={20} className="spin" color={c.pinkInk} />
              ) : ranked.length === 0 ? (
                <div style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.7 }}>
                  {t("لا فيديوهات قابلة للترويج في هذا الحساب. انشر فيديو أولاً.",
                     "No promotable videos on this account. Post a video first.")}
                </div>
              ) : (
                <>
                  {/* A TikTok profile grid: 3 columns, 2px gutters, square corners. */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 2 }}>
                    {ranked.map((v, i) => {
                      const isA = itemId === v.itemId;
                      const isB = itemIdB === v.itemId;
                      const hot = i < 3;
                      return (
                        <button key={v.itemId}
                          onClick={() => {
                            if (abMode && itemId && !isA) setItemIdB(isB ? "" : v.itemId);
                            else setItemId(isA ? "" : v.itemId);
                          }}
                          style={{
                            ...ttStage(), borderRadius: 4, padding: 0, cursor: "pointer",
                            border: isA ? `2px solid ${TT_PINK}` : isB ? `2px solid ${TT_CYAN}` : "none",
                            fontFamily: "inherit",
                          }}>
                          {v.thumbnail
                            ? <img src={v.thumbnail} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                            : <div style={{ position: "absolute", inset: 0, padding: 7, fontSize: 10, color: "rgba(255,255,255,.7)", textAlign: "start" }}>{v.caption.slice(0, 50)}</div>}
                          <div style={{ position: "absolute", inset: 0, background: TT_SCRIM }} />
                          {hot && (
                            <span style={{ position: "absolute", top: 4, insetInlineEnd: 4, background: "rgba(0,0,0,.6)", color: TT_CYAN, borderRadius: 3, padding: "1px 4px", fontSize: 8.5, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 2 }}>
                              <Flame size={8} /> {t("الأكثر تفاعلاً", "Top")}
                            </span>
                          )}
                          {(isA || isB) && (
                            <span style={{ position: "absolute", bottom: 4, insetInlineStart: 4, background: isA ? TT_PINK : TT_CYAN, color: isA ? "#fff" : "#000", borderRadius: 3, padding: "1px 5px", fontSize: 9, fontWeight: 800 }}>
                              {isA ? "A" : "B"}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* The head-to-head test, named for what it does. */}
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 9, marginTop: 13, cursor: "pointer" }}>
                    <input type="checkbox" checked={abMode}
                      onChange={(e) => { setAbMode(e.target.checked); if (!e.target.checked) setItemIdB(""); }}
                      style={{ marginTop: 3 }} />
                    <span>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}>
                        <Swords size={14} color={c.pinkInk} /> {t("جرّب فيديوهين", "Try two videos")}
                      </span>
                      <span style={{ display: "block", fontSize: 11.5, color: c.muted, marginTop: 3, lineHeight: 1.65 }}>
                        {t("يعرض الاثنين على الجمهور نفسه لترى أيّهما يبيع. يحتاج ضعف الميزانية — تيك توك يفرض حدّه الأدنى على كل فيديو.",
                           "Runs both to the same audience so you see which one sells. Needs double the budget — TikTok applies its minimum to each video.")}
                      </span>
                    </span>
                  </label>
                </>
              )}
            </>
          )}
        </div>

        {/* ── 2. the goal ──────────────────────────────────────────────────── */}
        <div style={section}>
          {label(t("٢ · الهدف", "2 · The goal"))}
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {GOALS.map((g) => (
              <Chip key={g.id} on={goal === g.id} onClick={() => setGoal(g.id)} c={c} grow>
                {t(g.ar, g.en)}
              </Chip>
            ))}
          </div>
        </div>

        {/* ── 3. the audience ──────────────────────────────────────────────── */}
        <div style={section}>
          {label(t("٣ · الجمهور", "3 · The audience"))}

          <div style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.7, marginBottom: 12 }}>
            {t("الاستهداف الواسع يعطي نتائج أفضل على تيك توك — اتركه كما هو إن لم تكن متأكداً.",
               "Broad targeting performs better on TikTok — leave it as it is if you're unsure.")}
          </div>

          {label(t("العمر", "Age"))}
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {AGE_BUCKETS.map(([k]) => (
              <Chip key={k} on={ages.includes(k)} c={c}
                onClick={() => setAges(ages.includes(k) ? ages.filter((x) => x !== k) : [...ages, k])}>
                {k}
              </Chip>
            ))}
          </div>

          <div style={{ marginTop: 14 }}>{label(t("الجنس", "Gender"))}</div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {([["all", t("الجميع", "All")], ["male", t("ذكور", "Men")], ["female", t("إناث", "Women")]] as const).map(([g, lbl]) => (
              <Chip key={g} on={gender === g} onClick={() => setGender(g)} c={c} grow>{lbl}</Chip>
            ))}
          </div>

          {audiences.length > 0 && (
            <>
              <div style={{ marginTop: 14 }}>{label(t("جماهير محفوظة", "Saved audiences"))}</div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {audiences.map((a) => (
                  <Chip key={a.id} on={false} onClick={() => applyAudience(a)} c={c}>
                    <Users size={12} /> {a.name}
                  </Chip>
                ))}
              </div>
            </>
          )}

          <button onClick={() => setAdvanced(!advanced)}
            style={{ background: "none", border: "none", padding: 0, marginTop: 14, cursor: "pointer", color: c.pinkInk, fontSize: 12.5, fontWeight: 700, fontFamily: "inherit" }}>
            {advanced ? t("إخفاء التخصيص المتقدّم", "Hide advanced") : t("تخصيص متقدّم", "Advanced targeting")}
          </button>

          {advanced && (
            <div style={{ marginTop: 13 }}>
              {label(t("المدن والمناطق", "Cities & regions"))}
              {locations.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  {locations.map((l) => (
                    <span key={l.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: `${TT_PINK}1a`, border: `1px solid ${TT_PINK}44`, borderRadius: 999, padding: "4px 10px", fontSize: 12, color: c.pinkInk, fontWeight: 700 }}>
                      {l.name}
                      <X size={12} style={{ cursor: "pointer" }} onClick={() => setLocations(locations.filter((x) => x.id !== l.id))} />
                    </span>
                  ))}
                </div>
              )}
              <input value={locQ} onChange={(e) => setLocQ(e.target.value)}
                placeholder={t("ابحث عن مدينة… (فارغ = كل ليبيا)", "Search a city… (empty = all Libya)")}
                style={ttInput(c)} />
              {locRes.length > 0 && (
                <div style={{ display: "grid", gap: 5, marginTop: 7, maxHeight: 160, overflowY: "auto" }}>
                  {locRes.map((l) => (
                    <button key={l.id}
                      onClick={() => { if (!locations.find((x) => x.id === l.id)) setLocations([...locations, l]); setLocQ(""); setLocRes([]); }}
                      style={{ textAlign: "start", background: c.surface2, border: "none", borderRadius: 9, padding: "9px 11px", color: c.text, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                      {l.name}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 14 }}>{label(t("الاهتمامات", "Interests"))}</div>
              {interests.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  {interests.map((i) => (
                    <span key={i.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: c.surface2, border: `1px solid ${c.border}`, borderRadius: 999, padding: "4px 10px", fontSize: 12, color: c.cyanInk, fontWeight: 700 }}>
                      {i.name}
                      <X size={12} style={{ cursor: "pointer" }} onClick={() => setInterests(interests.filter((x) => x.id !== i.id))} />
                    </span>
                  ))}
                </div>
              )}
              <input value={intQ} onChange={(e) => setIntQ(e.target.value)}
                placeholder={t("ابحث عن اهتمام…", "Search an interest…")} style={ttInput(c)} />
              {intRes.length > 0 && (
                <div style={{ display: "grid", gap: 5, marginTop: 7, maxHeight: 160, overflowY: "auto" }}>
                  {intRes.map((i) => (
                    <button key={i.id}
                      onClick={() => { if (!interests.find((x) => x.id === i.id)) setInterests([...interests, i]); setIntQ(""); setIntRes([]); }}
                      style={{ textAlign: "start", background: c.surface2, border: "none", borderRadius: 9, padding: "9px 11px", color: c.text, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                      {i.name}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 7, marginTop: 14 }}>
                <input value={audName} onChange={(e) => setAudName(e.target.value)}
                  placeholder={t("اسم لحفظ هذا الجمهور", "Name to save this audience")}
                  style={{ ...ttInput(c), flex: 1 }} />
                <button onClick={saveAudience} disabled={!audName.trim()}
                  style={{ ...ttSecondary(c), padding: "10px 14px" }}>
                  <Save size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── AI assistant ─────────────────────────────────────────────────── */}
        <div style={section}>
          {label(t("المساعد الذكي", "AI assistant"))}
          <textarea value={aiDesc} onChange={(e) => setAiDesc(e.target.value)} rows={2}
            placeholder={t("صف منتجك… مثال: عطور نسائية في طرابلس", "Describe your product… e.g. women's perfume in Tripoli")}
            style={{ ...ttInput(c), resize: "vertical" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button onClick={applyAi} disabled={aiBusy || !me?.vip}
              style={{ ...ttSecondary(c), flex: "1 1 160px", opacity: me?.vip ? 1 : 0.55 }}>
              {aiBusy ? <Loader2 size={15} className="spin" /> : <Wand2 size={15} />}
              {t("اقترح الجمهور", "Suggest the audience")}
            </button>
            <button onClick={writeAdText} disabled={copyBusy}
              style={{ ...ttSecondary(c), flex: "1 1 150px" }}>
              {copyBusy ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
              {t("اكتب النص", "Write the text")}
            </button>
          </div>
          {!me?.vip && (
            <div style={{ fontSize: 11.5, color: c.muted, marginTop: 8, lineHeight: 1.65 }}>
              {t("اقتراح الجمهور متاح لمشتركي إعلانات تيك توك.", "Audience suggestions are for TikTok Ads subscribers.")}
            </div>
          )}
          {aiMsg && (
            <div style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.8, marginTop: 11, background: c.surface2, borderRadius: 10, padding: "11px 12px" }}>{aiMsg}</div>
          )}
          {copyVariants.length > 0 && (
            <div style={{ display: "grid", gap: 7, marginTop: 11 }}>
              {copyVariants.map((v, i) => (
                <button key={i} onClick={() => setAdText(v)}
                  style={{ textAlign: "start", background: adText === v ? `${TT_PINK}14` : c.surface2, border: `1px solid ${adText === v ? TT_PINK : "transparent"}`, borderRadius: 10, padding: "10px 12px", color: c.text, fontSize: 13, lineHeight: 1.7, cursor: "pointer", fontFamily: "inherit" }}>
                  {v}
                </button>
              ))}
            </div>
          )}

          <div style={{ marginTop: 14 }}>{label(t("نص الإعلان", "Ad text"))}</div>
          <input value={adText} onChange={(e) => setAdText(e.target.value.slice(0, TT_AD_TEXT_MAX))}
            placeholder={t("سطر قصير يظهر مع الإعلان", "A short line shown with the ad")} style={ttInput(c)} />
          <div style={{ fontSize: 11, color: adText.length > TT_AD_TEXT_MAX - 10 ? c.warn : c.muted, marginTop: 6, fontVariantNumeric: "tabular-nums" }}>
            {adText.length}/{TT_AD_TEXT_MAX}
          </div>
        </div>

        {/* ── 4. budget ────────────────────────────────────────────────────── */}
        <div style={section}>
          {label(t("٤ · الميزانية والمدة", "4 · Budget & duration"))}

          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 13 }}>
            {(pkg?.options || []).map((o) => (
              <Chip key={o.days} on={!custom && o.days === days} onClick={() => { setCustom(false); setDays(o.days); }} c={c}>
                {o.days} {t("أيام", "d")}
              </Chip>
            ))}
            {me?.vip && (
              <Chip on={custom} onClick={() => { setCustom(true); if (!budgetUsd) setBudgetUsd(floorUsd); }} c={c}>
                {t("ميزانية حرة", "Free budget")}
              </Chip>
            )}
          </div>

          {!custom && packages.length > 1 && (
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 13 }}>
              {packages.map((p) => (
                <Chip key={p.id} on={p.id === tier} onClick={() => setTier(p.id)} c={c}>
                  {t(p.name, p.nameEn)}
                </Chip>
              ))}
            </div>
          )}

          {custom && (
            <div style={{ marginBottom: 13 }}>
              <BudgetSlider
                valueUsd={Math.max(budgetUsd, floorUsd)} minUsd={floorUsd} maxUsd={Math.max(floorUsd * 6, 600)}
                onChange={setBudgetUsd} c={c} t={t} rtl={rtl}
              />
              <label style={{ display: "block", fontSize: 12, color: c.muted, marginTop: 10 }}>
                {t("المدة (أيام)", "Days")}
                <input type="number" min={1} max={30} value={days}
                  onChange={(e) => setDays(Number(e.target.value))} style={{ ...ttInput(c), marginTop: 5 }} />
              </label>
            </div>
          )}

          {option && !custom && (
            <div style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.7, marginBottom: 12 }}>
              {option.viewsMin.toLocaleString()}–{option.viewsMax.toLocaleString()} {t("مشاهدة (تقدير)", "views (estimate)")}
            </div>
          )}

          <SpendReceipt platformLyd={platformLyd} feeLyd={feeLyd} c={c} t={t} />

          <Disclosure title={t("لماذا ٢٠$ يومياً؟", `Why $${minDaily} a day?`)} c={c}>
            {t(`تيك توك لا يقبل أقل من ${minDaily}$ يومياً لأي حملة. القاعدة من المنصّة نفسها، ونحن لا نضيف عليها شيئاً.`,
               `TikTok will not accept less than $${minDaily} a day for any campaign. That rule is the platform's own, and we add nothing to it.`)}
          </Disclosure>
        </div>

        {/* ── 5. review ────────────────────────────────────────────────────── */}
        <div style={section}>
          {label(t("٥ · المراجعة", "5 · Review"))}
          <div style={{ display: "flex", gap: 13, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ ...ttStage(), width: 108, flexShrink: 0 }}>
              {(() => {
                const v = videos.find((x) => x.itemId === itemId);
                return v?.thumbnail
                  ? <img src={v.thumbnail} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                  : null;
              })()}
              <div style={{ position: "absolute", inset: 0, background: TT_SCRIM }} />
              <span style={{ position: "absolute", top: 6, insetInlineStart: 6, background: "rgba(0,0,0,.65)", color: "#fff", borderRadius: 3, padding: "2px 5px", fontSize: 8.5, fontWeight: 800 }}>
                {t("مُموَّل", "Sponsored")}
              </span>
              {adText && (
                <div style={{ position: "absolute", bottom: 26, insetInlineStart: 7, insetInlineEnd: 7, ...ttOverlayText, fontSize: 10 }}>
                  {adText.slice(0, 60)}
                </div>
              )}
              <div style={{ position: "absolute", bottom: 6, insetInlineStart: 6, insetInlineEnd: 6, background: TT_PINK, color: "#fff", borderRadius: 4, textAlign: "center", fontSize: 9, fontWeight: 800, padding: "3px 0" }}>
                {goal === "followers" ? t("متابعة", "Follow") : t("اشترِ الآن", "Shop now")}
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 160, fontSize: 12.5, color: c.muted, lineHeight: 1.9 }}>
              <div>
                {t("يظهر الإعلان باسم حسابك", "The ad runs under your account's name")}
                {identity ? ` — @${identity.displayName}` : ""}
              </div>
              <div>{t("الهدف", "Goal")}: {t(GOALS.find((g) => g.id === goal)?.ar || "", GOALS.find((g) => g.id === goal)?.en || "")}</div>
              <div>{t("المدة", "Duration")}: {days} {t("أيام", "days")}</div>
              {abMode && itemIdB && (
                <div style={{ color: c.cyanInk, fontWeight: 700 }}>{t("تجربة فيديوهين (A ضد B)", "Two-video test (A vs B)")}</div>
              )}
            </div>
          </div>

          <button onClick={submit} disabled={submitting}
            style={{ ...ttPrimary(rtl, submitting), width: "100%", marginTop: 16 }}>
            {submitting ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
            {t(`متابعة للدفع · ${totalLyd.toLocaleString()} د.ل`, `Continue to payment · ${totalLyd.toLocaleString()} LYD`)}
          </button>
        </div>

        {error && (
          <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: `${c.danger}18`, border: `1px solid ${c.danger}55`, borderRadius: 11, padding: "12px 13px", marginTop: 14 }}>
            <AlertCircle size={16} color={c.danger} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>{error}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TikTokAdsCreatePage() {
  return (
    <Suspense fallback={null}>
      <CreateInner />
    </Suspense>
  );
}
