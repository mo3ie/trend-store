"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Loader2, Music2, Plus, MessageSquare, Sparkles, Zap,
  ShieldCheck, CheckCircle, XCircle, Settings2, Search, Radio,
} from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useTikTokDemo } from "@/hooks/useTikTokDemo";
import LangToggle from "@/components/LangToggle";
import { TikTokDemoAccountCard } from "@/components/tiktok-demo/DemoAccountCard";

// TikTok brand palette — deliberately distinct from the blue Facebook console.
const GRADIENT = "linear-gradient(135deg, #0b0b12 0%, #17141f 100%)";
const PINK = "#ff0050", CYAN = "#00f2ea";
const CARD = "rgba(255,255,255,0.04)", BORDER = "rgba(255,255,255,0.08)";
const GREEN = "#22c55e";

interface Sub { status: string; expires_at: string | null; }
interface Config { id: string; enabled: boolean; }
interface Account {
  account_id: string; page_id: string; page_name: string; page_picture?: string;
  granted_scopes?: string[]; token_status?: string;
  config: Config | null; subscription: Sub | null;
}
/** App-level webhook state — one configuration serves every connected account. */
interface WebhookState { subscribed: boolean; event_type: string; last_event_at: string | null; }

function subActive(s: Sub | null): boolean {
  return !!s && s.status === "active" && (!s.expires_at || new Date(s.expires_at).getTime() > Date.now());
}

function TikTokBotInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, rtl } = useLang();
  const Back = rtl ? ArrowLeft : ArrowRight;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [price, setPrice] = useState(50);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [webhook, setWebhook] = useState<WebhookState | null>(null);
  const [q, setQ] = useState("");
  // Prototype state for the TikTok Accounts API demonstration. It is local-only and is
  // rendered alongside — never instead of — the real connected accounts below.
  const demo = useTikTokDemo();

  const load = useCallback(async () => {
    setLoading(true);
    const [cfg, st] = await Promise.all([
      fetch("/api/tiktok/configs").then((r) => r.json()).catch(() => ({ accounts: [] })),
      fetch("/api/bot/settings").then((r) => r.json()).catch(() => ({ monthly_price_lyd: 50 })),
    ]);
    setAccounts(cfg.accounts || []);
    setWebhook(cfg.webhook ?? null);
    setPrice(Number(st.monthly_price_lyd ?? 50));
    setLoading(false);
  }, []);

  useEffect(() => {
    const s = searchParams.get("success");
    const e = searchParams.get("error");
    if (s === "1") setSuccess(t("تم ربط حساب تيك توك بنجاح!", "TikTok account connected!"));
    if (e === "cancelled") setError(t("تم إلغاء الربط", "Connection cancelled"));
    // Fixed error codes from the hardened callback (no raw upstream text is reflected).
    if (e === "invalid_state") setError(t("رابط الربط غير صالح — أعد المحاولة من جديد", "Invalid connection link — please start again"));
    if (e === "expired") setError(t("انتهت صلاحية محاولة الربط — أعد المحاولة", "The connection attempt expired — please try again"));
    if (e === "not_signed_in") setError(t("سجّل الدخول أولاً ثم أعد الربط", "Please sign in first, then connect again"));
    if (e === "oauth_failed") setError(t("فشل الربط — حاول مرة أخرى", "Connection failed — please try again"));
    load();
  }, [searchParams, load, t]);

  async function connect() {
    setConnecting(true); setError("");
    const data = await fetch("/api/tiktok/connect").then((r) => r.json());
    if (data.url) window.location.href = data.url;
    else { setError(data.error || t("حدث خطأ", "Something went wrong")); setConnecting(false); }
  }

  const shown = accounts.filter((a) => (a.page_name || "").toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div style={{ minHeight: "100vh", background: GRADIENT, color: "#fff", fontFamily: "Cairo, sans-serif", direction: rtl ? "rtl" : "ltr", paddingBottom: 80 }}>
      <div style={{ padding: "20px 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.push("/tiktok")} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Back size={18} /> {t("رجوع", "Back")}
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <Music2 size={20} color={PINK} /> {t("بوت تيك توك", "TikTok Bot")}
        </h1>
        <div style={{ marginInlineStart: "auto" }}><LangToggle /></div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "36px 24px" }}>
        {success && (
          <div style={{ background: "rgba(34,197,94,0.14)", border: "1px solid #22c55e40", borderRadius: 12, padding: "13px 17px", marginBottom: 20, display: "flex", alignItems: "center", gap: 9, color: "#86efac", fontSize: 14 }}>
            <CheckCircle size={17} /> {success}
          </div>
        )}
        {error && (
          <div style={{ background: "rgba(239,68,68,0.14)", border: "1px solid #ef444440", borderRadius: 12, padding: "13px 17px", marginBottom: 20, display: "flex", alignItems: "center", gap: 9, color: "#fca5a5", fontSize: 14 }}>
            <XCircle size={17} /> {error}
          </div>
        )}

        {demo.hydrated && demo.connected && <TikTokDemoAccountCard />}

        {/* Hero */}
        <div style={{ background: `linear-gradient(135deg, ${PINK}1c, ${CYAN}12)`, border: `1px solid ${PINK}33`, borderRadius: 20, padding: 28, marginBottom: 28 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 10px" }}>
            {t("ردّ تلقائي على كل تعليق في فيديوهاتك", "Auto-reply to every comment on your videos")}
          </h2>
          <p style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.9, margin: "0 0 18px" }}>
            {t(
              "يراقب البوت تعليقات فيديوهاتك ويرد عليها تلقائياً بالسعر والتفاصيل — على مدار الساعة، دون أن تفوتك أي فرصة بيع.",
              "The bot watches the comments on your videos and replies automatically with the price and details — 24/7, so you never miss a sale.",
            )}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            {([
              [MessageSquare, t("رد علني فوري تحت التعليق", "Instant public reply under the comment")],
              [Sparkles, t("ردود ذكية بالذكاء الاصطناعي", "Smart AI replies")],
              [Zap, t("تهدئة تلقائية ضد الحظر", "Auto pacing anti-block")],
              [ShieldCheck, t("صلاحيات تيك توك رسمية", "Official TikTok permissions")],
            ] as [React.ComponentType<{ size?: number; color?: string }>, string][]).map(([Icon, label], i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#e2e8f0" }}>
                <Icon size={16} color={CYAN} /> {label}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18, fontSize: 15, fontWeight: 700, color: "#fff" }}>
            {price} {t("د.ل / شهرياً لكل حساب", "LYD / month per account")}
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: "#94a3b8", lineHeight: 1.7 }}>
            {t(
              "ملاحظة: تيك توك لا يوفّر رسائل خاصة آلية للتعليقات العضوية — يرد البوت علنياً تحت التعليق.",
              "Note: TikTok offers no automated DMs for organic comments — the bot replies publicly under the comment.",
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 50, color: "#64748b" }}><Loader2 size={30} className="spin" /></div>
        ) : accounts.length === 0 ? (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 34, textAlign: "center" }}>
            <Music2 size={40} color="#475569" style={{ marginBottom: 14 }} />
            <p style={{ color: "#94a3b8", margin: "0 0 18px", fontSize: 14 }}>
              {t("اربط حساب تيك توك أولاً لتفعيل البوت عليه", "Connect a TikTok account first to enable the bot on it")}
            </p>
            <button onClick={connect} disabled={connecting}
              style={{ background: `linear-gradient(135deg, ${PINK}, #d6006b)`, border: "none", borderRadius: 12, padding: "13px 26px", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
              {connecting ? <Loader2 size={18} className="spin" /> : <Plus size={18} />}
              {connecting ? t("جارٍ الاتصال...", "Connecting...") : t("ربط حساب تيك توك", "Connect a TikTok account")}
            </button>
          </div>
        ) : (
          <>
            {webhook && (
              <div style={{ background: webhook.subscribed ? "rgba(34,197,94,0.10)" : "rgba(251,191,36,0.10)",
                border: `1px solid ${webhook.subscribed ? "rgba(34,197,94,0.30)" : "rgba(251,191,36,0.30)"}`,
                borderRadius: 12, padding: "11px 15px", marginBottom: 14, display: "flex", alignItems: "center", gap: 9,
                fontSize: 13, color: webhook.subscribed ? "#86efac" : "#fbbf24" }}>
                <Radio size={15} />
                {webhook.subscribed
                  ? t("الردّ الفوري مفعّل — تصل التعليقات لحظياً", "Instant replies active — comments arrive in real time")
                  : t("الردّ الفوري غير مفعّل بعد — يعمل البوت بالفحص الدوري", "Instant delivery not enabled yet — the bot falls back to periodic checks")}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 14px", flexWrap: "wrap" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#cbd5e1", margin: 0 }}>
                {t("حساباتك", "Your accounts")} ({accounts.length})
              </h3>
              <button onClick={connect} disabled={connecting}
                style={{ marginInlineStart: "auto", background: `${PINK}1f`, border: `1px solid ${PINK}55`, borderRadius: 10, padding: "8px 14px", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7 }}>
                {connecting ? <Loader2 size={15} className="spin" /> : <Plus size={15} />} {t("ربط حساب", "Connect account")}
              </button>
            </div>

            {/* Search */}
            <div style={{ position: "relative", marginBottom: 14 }}>
              <Search size={16} style={{ position: "absolute", insetInlineStart: 14, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
              <input value={q} onChange={(e) => setQ(e.target.value)}
                placeholder={t("ابحث عن حساب…", "Search for an account…")}
                style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, paddingBlock: 11, paddingInlineStart: 40, paddingInlineEnd: 14, color: "#fff", fontSize: 14 }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {shown.map((a) => {
                const active = subActive(a.subscription);
                const on = a.config?.enabled && active;
                return (
                  <div key={a.page_id} style={{ background: CARD, border: `1px solid ${on ? `${GREEN}44` : BORDER}`, borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
                    {a.page_picture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.page_picture} alt="" style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: 46, height: 46, borderRadius: "50%", background: `${PINK}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Music2 size={22} color={PINK} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.page_name}</div>
                      <div style={{ fontSize: 12, marginTop: 4, color: on ? GREEN : active ? "#fbbf24" : "#94a3b8", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        {on ? <><CheckCircle size={13} /> {t("يعمل", "Running")}</> : active ? t("مشترك — متوقف", "Subscribed — off") : t("غير مشترك", "Not subscribed")}
                        {a.token_status && a.token_status !== "active" && (
                          <span style={{ color: "#f87171" }}>
                            • {t("يحتاج إعادة ربط", "Needs reconnect")}
                          </span>
                        )}
                        {!!a.granted_scopes?.length && (
                          <span style={{ color: "#64748b" }}>
                            • {a.granted_scopes.length} {t("صلاحية", "permissions")}
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => router.push(`/tiktok-bot/${a.page_id}`)}
                      style={{ background: `${PINK}22`, border: `1px solid ${PINK}55`, borderRadius: 10, padding: "9px 16px", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}>
                      <Settings2 size={15} /> {t("إدارة", "Manage")}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin-anim { to { transform: rotate(360deg); } } .spin { animation: spin-anim 1s linear infinite; } input, textarea { font-family: inherit; }`}</style>
    </div>
  );
}

export default function TikTokBotPage() {
  return <Suspense><TikTokBotInner /></Suspense>;
}
