"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Loader2, Music2, Plus, Power, CreditCard, Trash2,
  MessageSquare, Sparkles, Zap, CheckCircle, XCircle, Settings2, Activity, Save,
} from "lucide-react";
import { useLang } from "@/hooks/useLang";
import LangToggle from "@/components/LangToggle";

// TikTok brand palette — deliberately distinct from the blue Facebook console.
const GRADIENT = "linear-gradient(135deg, #0b0b12 0%, #17141f 100%)";
const PINK = "#ff0050", CYAN = "#00f2ea";
const CARD = "rgba(255,255,255,0.04)", BORDER = "rgba(255,255,255,0.08)";
const GREEN = "#22c55e";

interface Sub { status: string; expires_at: string | null; }
interface Config {
  id: string; enabled: boolean; reply_public: boolean; ai_enabled: boolean;
  ai_persona: string | null; throttle_per_min: number;
}
interface Account {
  page_id: string; page_name: string; page_picture?: string;
  config: Config; subscription: Sub | null;
}
interface Rule {
  id: string; name: string | null; keywords: string[]; match_type: string;
  public_reply: string | null; enabled: boolean; priority: number;
}
type TF = (ar: string, en: string) => string;

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
  const [openId, setOpenId] = useState<string>("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [cfg, st] = await Promise.all([
      fetch("/api/tiktok/configs").then((r) => r.json()).catch(() => ({ accounts: [] })),
      fetch("/api/bot/settings").then((r) => r.json()).catch(() => ({ monthly_price_lyd: 50 })),
    ]);
    setAccounts(cfg.accounts || []);
    setPrice(Number(st.monthly_price_lyd ?? 50));
    setLoading(false);
  }, []);

  useEffect(() => {
    const s = searchParams.get("success");
    const e = searchParams.get("error");
    if (s === "1") setSuccess(t("تم ربط حساب تيك توك بنجاح!", "TikTok account connected!"));
    if (e === "cancelled") setError(t("تم إلغاء الربط", "Connection cancelled"));
    if (e === "oauth_failed") {
      const reason = searchParams.get("reason");
      setError(t(`فشل الربط${reason ? ` — ${reason}` : ""}`, `Connection failed${reason ? ` — ${reason}` : ""}`));
    }
    load();
  }, [searchParams, load, t]);

  async function connect() {
    setConnecting(true); setError("");
    const data = await fetch("/api/tiktok/connect").then((r) => r.json());
    if (data.url) window.location.href = data.url;
    else { setError(data.error || t("حدث خطأ", "Something went wrong")); setConnecting(false); }
  }

  async function subscribe(pageId: string) {
    setBusy(pageId);
    const res = await fetch("/api/bot/subscribe", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId, platform: "tiktok" }),
    });
    const data = await res.json();
    setBusy("");
    if (!res.ok) { setError(data.message || t("فشل الاشتراك", "Subscription failed")); return; }
    setSuccess(t("تم الاشتراك ✅", "Subscribed ✅"));
    load();
  }

  async function patchConfig(id: string, patch: Partial<Config>) {
    const res = await fetch("/api/tiktok/configs", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.message || data.error); return; }
    setAccounts((a) => a.map((x) => x.config.id === id ? { ...x, config: data.config } : x));
  }

  async function disconnect(id: string) {
    if (!confirm(t("إلغاء ربط هذا الحساب؟", "Disconnect this account?"))) return;
    await fetch(`/api/tiktok/configs?id=${id}`, { method: "DELETE" });
    setAccounts((a) => a.filter((x) => x.config.id !== id));
  }

  return (
    <div style={{ minHeight: "100vh", background: GRADIENT, color: "#fff", fontFamily: "Cairo, sans-serif", direction: rtl ? "rtl" : "ltr", paddingBottom: 80 }}>
      <div style={{ padding: "20px 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.push("/")} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Back size={18} /> {t("رجوع", "Back")}
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <Music2 size={20} color={PINK} /> {t("بوت تيك توك", "TikTok Bot")}
        </h1>
        <div style={{ marginInlineStart: "auto" }}><LangToggle /></div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 22px" }}>
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

        {/* Hero */}
        <div style={{ background: `linear-gradient(135deg, ${PINK}1c, ${CYAN}12)`, border: `1px solid ${PINK}33`, borderRadius: 20, padding: 26, marginBottom: 24 }}>
          <h2 style={{ fontSize: 21, fontWeight: 800, margin: "0 0 10px" }}>
            {t("ردّ تلقائي على تعليقات تيك توك", "Auto-reply to TikTok comments")}
          </h2>
          <p style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.9, margin: "0 0 16px" }}>
            {t(
              "يراقب البوت تعليقات فيديوهاتك ويرد عليها تلقائياً بالسعر والتفاصيل — بكلمات مفتاحية أو بالذكاء الاصطناعي.",
              "The bot watches your videos' comments and replies automatically with prices and details — by keyword or with AI.",
            )}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 14 }}>
            {[[MessageSquare, t("رد علني فوري", "Instant public reply")], [Sparkles, t("ذكاء اصطناعي", "AI replies")], [Zap, t("حماية من الحظر", "Anti-block pacing")]].map(([Icon, l], i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "#e2e8f0" }}>
                {/* @ts-expect-error lucide icon element */}
                <Icon size={15} color={CYAN} /> {l as string}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{price} {t("د.ل / شهرياً لكل حساب", "LYD / month per account")}</div>
          <div style={{ marginTop: 10, fontSize: 12, color: "#94a3b8", lineHeight: 1.7 }}>
            {t(
              "ملاحظة: تيك توك لا يوفّر رسائل خاصة آلية للتعليقات العضوية — يرد البوت علنياً تحت التعليق.",
              "Note: TikTok offers no automated DMs for organic comments — the bot replies publicly under the comment.",
            )}
          </div>
        </div>

        <button onClick={connect} disabled={connecting}
          style={{ width: "100%", background: `linear-gradient(135deg, ${PINK}, #d6006b)`, border: "none", borderRadius: 13, padding: "14px 0", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, marginBottom: 26 }}>
          {connecting ? <Loader2 size={18} className="spin" /> : <Plus size={18} />}
          {connecting ? t("جارٍ الاتصال...", "Connecting...") : t("ربط حساب تيك توك", "Connect a TikTok account")}
        </button>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}><Loader2 size={28} className="spin" /></div>
        ) : accounts.length === 0 ? (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
            <Music2 size={38} color="#475569" style={{ marginBottom: 12 }} />
            <div>{t("لم تربط أي حساب تيك توك بعد", "No TikTok account connected yet")}</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {accounts.map((a) => (
              <AccountCard key={a.page_id} account={a} price={price} busy={busy === a.page_id}
                t={t} onSubscribe={() => subscribe(a.page_id)}
                onPatch={(p) => patchConfig(a.config.id, p)}
                onDisconnect={() => disconnect(a.config.id)}
                onOpen={() => setOpenId(openId === a.page_id ? "" : a.page_id)}
                open={openId === a.page_id} />
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin-anim { to { transform: rotate(360deg); } } .spin { animation: spin-anim 1s linear infinite; }`}</style>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} aria-pressed={on}
      style={{ width: 50, height: 29, borderRadius: 20, border: "none", cursor: "pointer", background: on ? GREEN : "#334155", position: "relative", flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 3, insetInlineStart: on ? 24 : 3, width: 23, height: 23, borderRadius: "50%", background: "#fff", transition: "inset-inline-start .2s" }} />
    </button>
  );
}

function AccountCard({ account, price, busy, t, onSubscribe, onPatch, onDisconnect, onOpen, open }: {
  account: Account; price: number; busy: boolean; t: TF;
  onSubscribe: () => void; onPatch: (p: Partial<Config>) => void;
  onDisconnect: () => void; onOpen: () => void; open: boolean;
}) {
  const active = subActive(account.subscription);
  const running = account.config.enabled && active;

  return (
    <div style={{ background: CARD, border: `1px solid ${running ? `${GREEN}44` : BORDER}`, borderRadius: 16, padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
        {account.page_picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={account.page_picture} alt="" style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: `${PINK}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Music2 size={21} color={PINK} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{account.page_name}</div>
          <div style={{ fontSize: 12, marginTop: 3, color: running ? GREEN : active ? "#fbbf24" : "#94a3b8" }}>
            {running ? t("يعمل", "Running") : active ? t("مشترك — متوقف", "Subscribed — off") : t("غير مشترك", "Not subscribed")}
          </div>
        </div>
        {!active ? (
          <button onClick={onSubscribe} disabled={busy}
            style={{ background: `linear-gradient(135deg, ${PINK}, #d6006b)`, border: "none", borderRadius: 10, padding: "10px 16px", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}>
            {busy ? <Loader2 size={14} className="spin" /> : <CreditCard size={14} />}
            {t(`اشترك — ${price} د.ل`, `Subscribe — ${price} LYD`)}
          </button>
        ) : (
          <>
            <Power size={17} color={running ? GREEN : "#64748b"} />
            <Toggle on={account.config.enabled} onChange={(v) => onPatch({ enabled: v })} />
          </>
        )}
        <button onClick={onOpen} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "7px 9px", color: "#cbd5e1", cursor: "pointer" }}>
          <Settings2 size={15} />
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
          <SettingsRow label={t("الرد العلني على التعليقات", "Public reply on comments")}>
            <Toggle on={account.config.reply_public} onChange={(v) => onPatch({ reply_public: v })} />
          </SettingsRow>
          <SettingsRow label={t("الردود الذكية (AI)", "Smart AI replies")} hint={t("رد بالذكاء الاصطناعي عند عدم مطابقة قاعدة", "AI reply when no rule matches")}>
            <Toggle on={account.config.ai_enabled} onChange={(v) => onPatch({ ai_enabled: v })} />
          </SettingsRow>
          <SettingsRow label={t("سقف الردود بالدقيقة", "Replies per minute")} hint={t("حماية من الحظر", "Anti-block protection")}>
            <input type="number" min={1} max={60} defaultValue={account.config.throttle_per_min}
              onBlur={(e) => onPatch({ throttle_per_min: Number(e.target.value) })}
              style={{ width: 66, background: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER}`, borderRadius: 9, padding: "8px 10px", color: "#fff", textAlign: "center" }} />
          </SettingsRow>

          <RulesEditor configId={account.config.id} t={t} />

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button onClick={() => window.open(`/bot/${account.page_id}`, "_self")}
              style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 0", color: "#cbd5e1", cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <Activity size={14} /> {t("سجل النشاط", "Activity log")}
            </button>
            <button onClick={onDisconnect}
              style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "10px 14px", color: "#f87171", cursor: "pointer" }}>
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</div>
        {hint && <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 2 }}>{hint}</div>}
      </div>
      {children}
    </div>
  );
}

// Compact keyword→reply editor (TikTok replies are public only, so one text field).
function RulesEditor({ configId, t }: { configId: string; t: TF }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [kw, setKw] = useState("");
  const [reply, setReply] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const d = await fetch(`/api/bot/rules?configId=${configId}`).then((r) => r.json());
    setRules(d.rules || []); setLoaded(true);
  }, [configId]);
  useEffect(() => { load(); }, [load]);

  async function add() {
    const keywords = kw.split(/[،,\n]/).map((s) => s.trim()).filter(Boolean);
    if (!reply.trim()) return;
    setSaving(true);
    await fetch("/api/bot/rules", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        configId, keywords, public_reply: reply,
        match_type: keywords.length ? "any_contains" : "catch_all",
      }),
    });
    setKw(""); setReply(""); setSaving(false); load();
  }

  async function del(id: string) {
    await fetch(`/api/bot/rules?id=${id}`, { method: "DELETE" });
    setRules((r) => r.filter((x) => x.id !== id));
  }

  const inp: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER}`, borderRadius: 9, padding: "10px 13px", color: "#fff", boxSizing: "border-box", fontSize: 13.5 };

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>{t("قواعد الرد", "Reply rules")}</div>

      {loaded && rules.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 12 }}>
          {rules.map((r) => (
            <div key={r.id} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "9px 13px", display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: CYAN, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.match_type === "catch_all" ? t("كل التعليقات", "All comments") : r.keywords.join("، ")}
                </div>
                <div style={{ fontSize: 12.5, color: "#cbd5e1", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>↳ {r.public_reply}</div>
              </div>
              <button onClick={() => del(r.id)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}

      <input value={kw} onChange={(e) => setKw(e.target.value)} style={{ ...inp, marginBottom: 8 }}
        placeholder={t("الكلمات المفتاحية (اتركها فارغة = كل التعليقات)", "Keywords (leave empty = all comments)")} />
      <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} style={{ ...inp, resize: "vertical", marginBottom: 8 }}
        placeholder={t("نص الرد — مثال: السعر 250 د.ل، راسلنا للطلب 📩", "Reply text — e.g. Price is 250 LYD, DM us to order 📩")} />
      <button onClick={add} disabled={saving || !reply.trim()}
        style={{ width: "100%", background: reply.trim() ? `linear-gradient(135deg, ${CYAN}, #00b8b2)` : "rgba(255,255,255,0.06)", border: "none", borderRadius: 10, padding: "10px 0", color: reply.trim() ? "#0b0b12" : "#64748b", fontWeight: 700, fontSize: 13.5, cursor: reply.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
        {saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />} {t("إضافة قاعدة", "Add rule")}
      </button>
    </div>
  );
}

export default function TikTokBotPage() {
  return <Suspense><TikTokBotInner /></Suspense>;
}
