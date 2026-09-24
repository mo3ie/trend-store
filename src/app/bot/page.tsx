"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot, MessageSquare, ArrowLeft, ArrowRight, Loader2, Plus, Settings2,
  CheckCircle, Zap, ShieldCheck, Sparkles, Search,
} from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useTheme } from "@/hooks/useTheme";
import { botColors } from "@/lib/botTheme";
import LangToggle from "@/components/LangToggle";
import { startPageConnect } from "@/lib/connectPage";

const BLUE     = "#1877f2";
const GREEN    = "#22c55e";

interface Sub { status: string; expires_at: string | null; }
interface Config { id: string; enabled: boolean; }
interface PageRow {
  page_id: string;
  page_name: string;
  page_picture?: string;
  config: Config | null;
  subscription: Sub | null;
}

function subActive(s: Sub | null): boolean {
  return !!s && s.status === "active" && (!s.expires_at || new Date(s.expires_at).getTime() > Date.now());
}

export default function BotDashboard() {
  const { light } = useTheme();
  const c = botColors(light);
  const GRADIENT = c.gradient;
  const CARD_BG = c.card;
  const router = useRouter();
  const { t, rtl } = useLang();
  const Back = rtl ? ArrowLeft : ArrowRight;
  const [pages, setPages]   = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [price, setPrice]   = useState(50);
  const [busy, setBusy]     = useState<string>("");
  const [q, setQ]           = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [cfg, st] = await Promise.all([
      fetch("/api/bot/configs").then((r) => r.json()).catch(() => ({ pages: [] })),
      fetch("/api/bot/settings").then((r) => r.json()).catch(() => ({ monthly_price_lyd: 50 })),
    ]);
    setPages(cfg.pages || []);
    setPrice(Number(st.monthly_price_lyd ?? 50));
    setLoading(false);
  }

  // Ensure a config exists, then open the management console for a page.
  async function manage(page: PageRow) {
    setBusy(page.page_id);
    if (!page.config) {
      await fetch("/api/bot/configs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: page.page_id }),
      });
    }
    router.push(`/bot/${page.page_id}`);
  }

  return (
    <div style={{ minHeight: "100vh", background: GRADIENT, color: c.text, fontFamily: "Cairo, sans-serif", direction: rtl ? "rtl" : "ltr", paddingBottom: 80 }}>
      <div style={{ padding: "20px 24px", borderBottom: `1px solid ${c.borderSoft}`, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.push("/")} style={{ background: "none", border: "none", color: c.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Back size={18} /> {t("رجوع", "Back")}
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <Bot size={20} color={BLUE} /> {t("بوت الرد الآلي", "Auto-Reply Bot")}
        </h1>
        <div style={{ marginInlineStart: "auto" }}><LangToggle /></div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "36px 24px" }}>
        {/* Hero */}
        <div style={{ background: `linear-gradient(135deg, ${BLUE}22, #6b46c122)`, border: `1px solid ${BLUE}33`, borderRadius: 20, padding: 28, marginBottom: 28 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 10px" }}>
            {t("ردّ تلقائي على كل تعليق ورسالة", "Auto-reply to every comment & DM")}
          </h2>
          <p style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.9, margin: "0 0 18px" }}>
            {t(
              "يرد البوت على تعليقات صفحتك تلقائياً ويرسل السعر والتفاصيل في الخاص فوراً — على مدار الساعة، دون أن تفوتك أي فرصة بيع.",
              "The bot replies to your Page comments and instantly sends the price & details in a private message — 24/7, so you never miss a sale.",
            )}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            {[
              [MessageSquare, t("رد علني + رسالة خاصة", "Public reply + private DM")],
              [Zap, t("تبديل تلقائي بين الحسابات ضد الحظر", "Auto account-switch anti-block")],
              [Sparkles, t("ردود ذكية بالذكاء الاصطناعي", "Smart AI replies")],
              [ShieldCheck, t("صلاحيات فيسبوك رسمية", "Official Facebook permissions")],
            ].map(([Icon, label], i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#e2e8f0" }}>
                {/* @ts-expect-error lucide icon element */}
                <Icon size={16} color={BLUE} /> {label as string}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18, fontSize: 15, fontWeight: 700, color: c.text }}>
            {price} {t("د.ل / شهرياً لكل صفحة", "LYD / month per Page")}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 50, color: c.dim }}><Loader2 size={30} className="spin" /></div>
        ) : pages.length === 0 ? (
          <div style={{ background: CARD_BG, border: `1px solid ${c.borderSoft}`, borderRadius: 16, padding: 34, textAlign: "center" }}>
            <Bot size={40} color="#475569" style={{ marginBottom: 14 }} />
            <p style={{ color: c.muted, margin: "0 0 18px", fontSize: 14 }}>
              {t("اربط صفحة فيسبوك أولاً لتفعيل البوت عليها", "Connect a Facebook Page first to enable the bot on it")}
            </p>
            <button onClick={() => startPageConnect("/bot")}
              style={{ background: `linear-gradient(135deg, ${BLUE}, #1565c0)`, border: "none", borderRadius: 12, padding: "13px 26px", color: c.text, fontWeight: 700, fontSize: 15, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Plus size={18} /> {t("ربط صفحة", "Connect a Page")}
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 14px", flexWrap: "wrap" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#cbd5e1", margin: 0 }}>
                {t("صفحاتك", "Your Pages")} ({pages.length})
              </h3>
              <button onClick={() => startPageConnect("/bot")}
                style={{ marginInlineStart: "auto", background: `${BLUE}1f`, border: `1px solid ${BLUE}55`, borderRadius: 10, padding: "8px 14px", color: c.text, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7 }}>
                <Plus size={15} /> {t("ربط صفحة", "Connect a Page")}
              </button>
            </div>

            {/* Search */}
            <div style={{ position: "relative", marginBottom: 14 }}>
              <Search size={16} style={{ position: "absolute", insetInlineStart: 14, top: "50%", transform: "translateY(-50%)", color: c.dim }} />
              <input value={q} onChange={(e) => setQ(e.target.value)}
                placeholder={t("ابحث عن صفحة…", "Search for a Page…")}
                style={{ width: "100%", boxSizing: "border-box", background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, paddingBlock: 11, paddingInlineStart: 40, paddingInlineEnd: 14, color: c.text, fontSize: 14 }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {pages.filter((p) => (p.page_name || "").toLowerCase().includes(q.trim().toLowerCase())).map((p) => {
                const active = subActive(p.subscription);
                const on = p.config?.enabled && active;
                return (
                  <div key={p.page_id} style={{ background: CARD_BG, border: `1px solid ${on ? `${GREEN}44` : c.border}`, borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
                    {p.page_picture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.page_picture} alt="" style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: 46, height: 46, borderRadius: "50%", background: `${BLUE}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Bot size={22} color={BLUE} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.page_name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                        {on ? (
                          <span style={{ fontSize: 12, color: GREEN, display: "flex", alignItems: "center", gap: 4 }}><CheckCircle size={13} /> {t("يعمل", "Running")}</span>
                        ) : active ? (
                          <span style={{ fontSize: 12, color: "#fbbf24" }}>{t("مشترك — متوقف", "Subscribed — off")}</span>
                        ) : (
                          <span style={{ fontSize: 12, color: c.muted }}>{t("غير مشترك", "Not subscribed")}</span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => manage(p)} disabled={busy === p.page_id}
                      style={{ background: `${BLUE}22`, border: `1px solid ${BLUE}55`, borderRadius: 10, padding: "9px 16px", color: c.text, cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}>
                      {busy === p.page_id ? <Loader2 size={15} className="spin" /> : <Settings2 size={15} />}
                      {t("إدارة", "Manage")}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin-anim { to { transform: rotate(360deg); } } .spin { animation: spin-anim 1s linear infinite; }`}</style>
    </div>
  );
}
