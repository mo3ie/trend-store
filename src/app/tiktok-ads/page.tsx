"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Loader2, Eye, ListOrdered, Plus, Link2, Zap,
} from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useTheme } from "@/hooks/useTheme";
import LangToggle from "@/components/LangToggle";
import { tt, ttCard, ttPrimary, ttSecondary, TT_CYAN } from "@/lib/tiktokTheme";
import {
  AccountStrip, ScreenTitle, SpendReceipt, Disclosure, Chip,
} from "@/components/tiktok/TikTokKit";

/**
 * TikTok Ads — the entry screen.
 *
 * Its whole job is to make TikTok's minimum spend legible before the advertiser
 * invests any effort. The platform refuses any ad group under $20/day, so the
 * cheapest honest campaign here costs many times what a comparable one costs
 * elsewhere, and an advertiser who meets that number without explanation assumes a
 * markup.
 *
 * Two deliberate choices follow from that, both taken from the design direction:
 *   * The default offer is a three-day SPRINT — the smallest thing TikTok will
 *     actually run — not the biggest package.
 *   * The price is shown as a receipt that puts TikTok's share first, so the figure
 *     reads as reach being bought.
 *
 * Nothing on this screen compares TikTok to another platform. Without the comparison
 * there is nothing to feel cheated about.
 */

interface AdOption { days: number; priceLyd: number; budgetUsd: number; viewsMin: number; viewsMax: number }
interface AdPackage { id: string; name: string; nameEn: string; level: number; options: AdOption[] }
interface Me {
  configured: boolean; connected: boolean; vip: boolean; minDailyUsd: number;
  advertisers: Array<{ advertiserId: string; name: string }>;
  pricing: { packages: AdPackage[]; rate: number; commission: number };
}
interface Status {
  account: { handle: string; avatarUrl: string | null } | null;
  ads: { total: number; live: number };
}

export default function TikTokAdsPage() {
  const router = useRouter();
  const { t, rtl } = useLang();
  const { light } = useTheme();
  const c = tt(light);
  const Back = rtl ? ArrowLeft : ArrowRight;

  const [me, setMe] = useState<Me | null>(null);
  const [st, setSt] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [linking, setLinking] = useState(false);

  async function linkAccount() {
    setLinking(true); setError("");
    try {
      const r = await fetch("/api/tiktok/connect");
      const d = await r.json().catch(() => ({}));
      if (d.url) { window.location.href = d.url; return; }
      setError(d.message || d.error || t("تعذّر بدء الربط", "Could not start linking"));
    } catch { setError(t("تعذّر الاتصال", "Connection failed")); }
    setLinking(false);
  }
  const [error, setError] = useState("");
  const [tier, setTier] = useState("first");
  const [days, setDays] = useState(3);

  useEffect(() => {
    Promise.all([
      fetch("/api/tiktok/ads/me").then((r) => (r.status === 401 ? null : r.json())),
      fetch("/api/tiktok/status").then((r) => (r.status === 401 ? null : r.json())),
    ])
      .then(([m, s]) => {
        if (!m) { router.push("/login?next=/tiktok-ads"); return; }
        if (!m.error) setMe(m);
        if (s && !s.error) setSt(s);
      })
      .catch(() => setError(t("تعذّر التحميل", "Could not load")))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect() {
    setConnecting(true); setError("");
    try {
      const r = await fetch("/api/tiktok/ads/connect");
      const d = await r.json();
      if (d.url) { window.location.href = d.url; return; }
      setError(d.message || t("ربط حساب الإعلانات قيد الإعداد.", "Ad-account linking is still in setup."));
    } catch {
      setError(t("تعذّر الاتصال", "Connection failed"));
    }
    setConnecting(false);
  }

  const packages = me?.pricing.packages || [];
  const pkg = packages.find((p) => p.id === tier) || packages[0];
  const option = pkg?.options.find((o) => o.days === days) || pkg?.options[0];

  // The split the receipt shows. The ad spend is what TikTok charges, converted at
  // the advertiser's own rate; the fee is the remainder of what they pay.
  const platformLyd = option ? Math.ceil(option.budgetUsd * (me?.pricing.rate ?? 12)) : 0;
  const feeLyd = option ? Math.max(0, option.priceLyd - platformLyd) : 0;
  const minDaily = me?.minDailyUsd ?? 20;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={24} className="spin" color={c.pinkInk} />
      </div>
    );
  }

  return (
    <div dir={rtl ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: c.bg, color: c.text }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "16px 16px 40px" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => router.push("/tiktok")}
            style={{ background: "none", border: "none", color: c.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", fontSize: 14 }}>
            <Back size={18} /> {t("أدوات تيك توك", "TikTok tools")}
          </button>
          <LangToggle />
        </div>

        <div style={{ marginTop: 14 }}>
          <ScreenTitle c={c} rtl={rtl}>{t("إعلانات تيك توك", "TikTok Ads")}</ScreenTitle>
        </div>

        <AccountStrip
          account={st?.account ? { handle: st.account.handle, avatarUrl: st.account.avatarUrl } : null}
          c={c} t={t} rtl={rtl}
          pending={st === null}
          onLink={linkAccount} linking={linking}
        />

        {error && (
          <div style={{ background: `${c.danger}18`, border: `1px solid ${c.danger}55`, borderRadius: 11, padding: "11px 13px", marginBottom: 13, fontSize: 13, lineHeight: 1.65 }}>
            {error}
          </div>
        )}

        {/* The sprint: the smallest campaign TikTok will actually run. */}
        {option && (
          <div style={{ ...ttCard(c), padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Zap size={16} color={c.pinkInk} />
              <span style={{ fontSize: 14, fontWeight: 700 }}>
                {days === 3 ? t("تجربة ٣ أيام", "3-day sprint") : `${t("حملة", "Campaign")} ${days} ${t("أيام", "days")}`}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.7 }}>
              <Eye size={12} style={{ verticalAlign: "-2px" }} />{" "}
              {option.viewsMin.toLocaleString()}–{option.viewsMax.toLocaleString()} {t("مشاهدة (تقدير)", "views (estimate)")}
            </div>

            <div style={{ marginTop: 14 }}>
              <SpendReceipt platformLyd={platformLyd} feeLyd={feeLyd} c={c} t={t} />
            </div>

            <Disclosure title={t("لماذا ٢٠$ يومياً؟", `Why $${minDaily} a day?`)} c={c}>
              {t(`تيك توك لا يقبل أقل من ${minDaily}$ يومياً لأي حملة. القاعدة من المنصّة نفسها، ونحن لا نضيف عليها شيئاً.`,
                 `TikTok will not accept less than $${minDaily} a day for any campaign. That rule is the platform's own, and we add nothing to it.`)}
            </Disclosure>

            {/* Duration, and then the tier — in that order, because the shortest run is
                the one most advertisers want to start with. */}
            <div style={{ fontSize: 12, fontWeight: 700, color: c.muted, margin: "16px 0 8px" }}>
              {t("المدة", "Duration")}
            </div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {(pkg?.options || []).map((o) => (
                <Chip key={o.days} on={o.days === days} onClick={() => setDays(o.days)} c={c}>
                  {o.days} {t("أيام", "d")}
                </Chip>
              ))}
            </div>

            {packages.length > 1 && (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.muted, margin: "16px 0 8px" }}>
                  {t("قوة الحملة", "Campaign strength")}
                </div>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                  {packages.map((p) => (
                    <Chip key={p.id} on={p.id === tier} onClick={() => setTier(p.id)} c={c}>
                      {t(p.name, p.nameEn)}
                    </Chip>
                  ))}
                </div>
              </>
            )}

            <div style={{ display: "flex", gap: 9, marginTop: 18, flexWrap: "wrap" }}>
              {me?.connected ? (
                <button onClick={() => router.push(`/tiktok-ads/create?tier=${tier}&days=${days}`)}
                  style={{ ...ttPrimary(rtl), flex: "1 1 170px" }}>
                  <Plus size={16} /> {t("ابدأ الحملة", "Start the campaign")}
                </button>
              ) : (
                <button onClick={connect} disabled={connecting || !me?.configured}
                  style={{ ...ttPrimary(rtl, connecting || !me?.configured), flex: "1 1 190px" }}>
                  {connecting ? <Loader2 size={16} className="spin" /> : <Link2 size={16} />}
                  {t("اربط حساب الإعلانات", "Link your ad account")}
                </button>
              )}
              {!!st?.ads.total && (
                <button onClick={() => router.push("/tiktok-ads/campaigns")}
                  style={{ ...ttSecondary(c), flex: "1 1 140px" }}>
                  <ListOrdered size={15} /> {t("حملاتي", "My campaigns")}
                  {st.ads.live ? ` (${st.ads.live})` : ""}
                </button>
              )}
            </div>

            {!me?.configured && (
              <div style={{ fontSize: 11.5, color: c.muted, marginTop: 10, lineHeight: 1.7 }}>
                {t("ربط حساب الإعلانات قيد الإعداد — الأسعار والتقديرات أعلاه نهائية.",
                   "Ad-account linking is still in setup — the prices and estimates above are final.")}
              </div>
            )}
          </div>
        )}

        {/* How a TikTok ad differs, in the three facts that change what the
            advertiser has to prepare. */}
        <div style={{ ...ttCard(c), padding: 16, marginTop: 14 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>
            {t("قبل أن تبدأ", "Before you start")}
          </div>
          {[
            t("تختار فيديو موجوداً في حسابك — يُروَّج كما هو، باسم حسابك.",
              "You pick a video already on your account — it runs as it is, under your account's name."),
            t("الفيديوهات الأكثر تفاعلاً عضوياً هي الأنجح إعلانياً، ونعلّمها لك.",
              "The videos that already perform organically do best as ads, and we mark them for you."),
            t("الاستهداف الواسع يعطي نتائج أفضل هنا من الضيّق.",
              "Broad targeting beats narrow targeting here."),
          ].map((line, i) => (
            <div key={i} style={{ display: "flex", gap: 9, marginTop: i ? 9 : 0 }}>
              <span style={{ width: 5, height: 5, borderRadius: 999, background: TT_CYAN, flexShrink: 0, marginTop: 7 }} />
              <span style={{ fontSize: 13, color: c.muted, lineHeight: 1.65 }}>{line}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
