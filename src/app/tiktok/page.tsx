"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MessageSquareReply, Bot, Megaphone, Home, MoreHorizontal, Loader2, X, Presentation,
} from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useTheme } from "@/hooks/useTheme";
import LangToggle from "@/components/LangToggle";
import { tt, ttCard } from "@/lib/tiktokTheme";
import { AccountStrip, ScreenTitle, ToolRow } from "@/components/tiktok/TikTokKit";

/**
 * The TikTok tools hub.
 *
 * Rewritten away from three marketing cards with feature bullets. Bullets read
 * identically on every account and on a first visit — they advertise something the
 * user has already chosen to open. Each tool now carries a status line built from the
 * owner's own data, so the screen answers "where did I leave off?".
 *
 * The app-review demonstration material used to occupy most of this page, which is
 * exactly why it read as a promo. It still exists, unchanged, behind the overflow
 * menu: it is needed for the screen recording, not for the product.
 */

interface Status {
  linking: { organic: boolean; ads: boolean };
  account: { handle: string; avatarUrl: string | null } | null;
  bot: { configured: boolean; enabled: boolean; rules: number; priceLyd: number | null };
  studio: { hasPlan: boolean; planDays: number | null; planStatus: string | null; priceLyd: number | null };
  ads: { connected: boolean; total: number; live: number; priceLyd: number | null };
}

export default function TikTokToolsPage() {
  const router = useRouter();
  const { t, rtl } = useLang();
  const { light } = useTheme();
  const c = tt(light);

  const [st, setSt] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [menu, setMenu] = useState(false);
  const [notified, setNotified] = useState(false);

  useEffect(() => {
    fetch("/api/tiktok/status")
      .then((r) => (r.status === 401 ? null : r.json()))
      .then((d) => { if (d && !d.error) setSt(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Each line describes what this owner actually has, and names the next step when
  // they have nothing — an empty tool should still say what it wants from you.
  const botStatus = !st?.bot.configured
    ? t("لم يُضبط بعد — ابدأ بقاعدة واحدة", "Not set up yet — start with one rule")
    : `${st.bot.rules} ${t("قاعدة", "rules")} · ${st.bot.enabled ? t("يعمل", "running") : t("متوقف", "stopped")}`;

  const studioStatus = !st?.studio.hasPlan
    ? t("لا خطة بعد — ولّد خطة فيديوهات", "No plan yet — generate a video plan")
    : `${t("خطة", "Plan")} ${st.studio.planDays ?? 7} ${t("أيام", "days")} · ${
        st.studio.planStatus === "active" ? t("نشطة", "active") : t("مسوّدة", "draft")}`;

  const adsStatus = !st?.ads.total
    ? t("لا حملات — روّج فيديو من حسابك", "No campaigns — promote a video from your account")
    : `${st.ads.total} ${t("حملة", "campaigns")}${st.ads.live ? ` · ${st.ads.live} ${t("تعمل", "live")}` : ""}`;

  const tools = [
    { icon: MessageSquareReply, name: t("الرد الآلي على التعليقات", "Comment auto-reply"), status: botStatus,    href: "/tiktok-bot" },
    { icon: Bot,                name: t("الموظف الذكي", "AI Employee"),                     status: studioStatus, href: "/tiktok-studio" },
    { icon: Megaphone,          name: t("إعلانات تيك توك", "TikTok Ads"),                   status: adsStatus,    href: "/tiktok-ads" },
  ];

  const linkingPending = !!st && !st.linking.organic;

  return (
    <div dir={rtl ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: c.bg, color: c.text }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "16px 16px 40px" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Link href="/" aria-label={t("الرئيسية", "Home")} style={{ color: c.muted, display: "flex", padding: 4 }}>
            <Home size={19} />
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <LangToggle />
            <button onClick={() => setMenu(true)} aria-label={t("المزيد", "More")}
              style={{ background: "none", border: "none", cursor: "pointer", color: c.muted, padding: 6, display: "flex" }}>
              <MoreHorizontal size={20} />
            </button>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <ScreenTitle c={c} rtl={rtl}>{t("أدوات تيك توك", "TikTok tools")}</ScreenTitle>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
            <Loader2 size={24} className="spin" color={c.pinkInk} />
          </div>
        ) : (
          <>
            <AccountStrip
              account={st?.account ? { handle: st.account.handle, avatarUrl: st.account.avatarUrl } : null}
              c={c} t={t} rtl={rtl}
              pending={linkingPending}
              onNotify={() => setNotified(true)}
              notifying={notified}
            />

            <div style={{ display: "grid", gap: 10 }}>
              {tools.map((tool) => (
                <ToolRow key={tool.href} icon={tool.icon} name={tool.name} status={tool.status}
                  href={tool.href} c={c} rtl={rtl} />
              ))}
            </div>

            {/*
              What a TikTok owner needs to know before linking, in three lines rather
              than a feature grid. The third is the one nobody expects, so it is said
              here instead of being discovered inside the bot editor.
            */}
            <div style={{ ...ttCard(c), padding: 16, marginTop: 14 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>
                {t("كيف تعمل الأدوات على تيك توك", "How these work on TikTok")}
              </div>
              {[
                t("كل المحتوى فيديو عمودي — الموظف الذكي يكتب لك سكربت تصوّره بهاتفك.",
                  "Everything is vertical video — the AI Employee writes you a script you film on your phone."),
                t("الإعلانات تروّج فيديو موجوداً في حسابك، تختاره من صورته.",
                  "Ads promote a video already on your account, picked by its thumbnail."),
                t("لا توجد رسائل خاصة آلية على تيك توك، فالسعر يُكتب في الردّ العلني نفسه.",
                  "TikTok has no automated private messages, so the price goes in the public reply itself."),
              ].map((line, i) => (
                <div key={i} style={{ display: "flex", gap: 9, marginTop: i ? 9 : 0 }}>
                  <span style={{ width: 5, height: 5, borderRadius: 999, background: c.pinkInk, flexShrink: 0, marginTop: 7 }} />
                  <span style={{ fontSize: 13, color: c.muted, lineHeight: 1.65 }}>{line}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* The demonstration material, out of the main flow. */}
      {menu && (
        <div onClick={() => setMenu(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 60, display: "flex", alignItems: "flex-end" }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: c.surface, borderRadius: "16px 16px 0 0", width: "100%", padding: 18, maxWidth: 680, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{t("المزيد", "More")}</span>
              <button onClick={() => setMenu(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: c.muted, display: "flex" }}>
                <X size={19} />
              </button>
            </div>
            <button onClick={() => { setMenu(false); router.push("/tiktok-demo/authorization"); }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, background: c.surface2, border: "none", borderRadius: 11, padding: "13px 14px", color: c.text, cursor: "pointer", fontFamily: "inherit", textAlign: rtl ? "right" : "left" }}>
              <Presentation size={18} color={c.pinkInk} />
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{t("عرض تقديمي", "Presentation")}</span>
                <span style={{ display: "block", fontSize: 11.5, color: c.muted, marginTop: 2 }}>
                  {t("جولة توضيحية للتكامل مع تيك توك", "A guided tour of the TikTok integration")}
                </span>
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
