"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Loader2, Music2, MessageSquare, Settings2, Activity,
  Video, Trash2, Save, Power, CreditCard, AlertTriangle, Sparkles, KeyRound, Package,
} from "lucide-react";
import { useLang } from "@/hooks/useLang";
import LangToggle from "@/components/LangToggle";
import WalletModal from "@/components/WalletModal";
import { useTheme } from "@/hooks/useTheme";
import { botColors } from "@/lib/botTheme";
import { BannedWordsEditor, CatalogPanel, ReplyGroupsEditor, type ReplyGroup } from "@/components/bot/ReplySettings";
import { PostOverrideEditor, type PostOverrideValue } from "@/components/bot/PostOverrideEditor";

// The TikTok reply console: accounts and videos, public replies only.
const PINK = "#ff0050", CYAN = "#00f2ea", GREEN = "#22c55e";

/** TikTok keeps its own backdrop; everything else comes from the shared palette. */
function tiktokGradient(light: boolean): string {
  return light
    ? "linear-gradient(135deg, #fbf5f8 0%, #f1f4fb 100%)"
    : "linear-gradient(135deg, #0b0b12 0%, #17141f 100%)";
}

type TF = (ar: string, en: string) => string;

interface Sub { status: string; expires_at: string | null; }
interface Config {
  id: string; enabled: boolean; reply_public: boolean; ai_enabled: boolean;
  ai_persona: string | null; throttle_per_min: number;
  // Same `bot_configs` row as the Facebook bot, so the same reply configuration.
  page_id?: string;
  reply_groups: ReplyGroup[] | null; banned_words: string[] | null;
  banned_action: "delete" | "hide" | "ignore" | null;
  mention_author: boolean | null; once_per_user: boolean | null;
  like_comments: boolean | null; public_replies: string[] | null;
  default_public_reply: string | null;
  catalog_match: string | null; catalog_ambiguous_reply: string | null;
  post_overrides?: Record<string, PostOverrideValue> | null;
}
interface Account {
  account_id: string; page_id: string; page_name: string; page_picture?: string;
  username?: string | null; granted_scopes?: string[]; token_status?: string;
  config: Config; subscription: Sub | null;
}
interface Rule {
  id: string; name: string | null; keywords: string[]; match_type: string;
  public_reply: string | null; enabled: boolean; priority: number;
}
interface LogRow {
  id: string; commenter_name: string | null; comment_message: string | null;
  public_status: string; error: string | null; created_at: string;
}

function subActive(s: Sub | null): boolean {
  return !!s && s.status === "active" && (!s.expires_at || new Date(s.expires_at).getTime() > Date.now());
}

export default function TikTokBotManage() {
  const { light } = useTheme();
  const c = botColors(light);
  const CARD = c.card;
  const BORDER = c.border;
  const GRADIENT = tiktokGradient(light);
  const router = useRouter();
  const params = useParams();
  const accountId = String(params.accountId);
  const { t, rtl } = useLang();
  const Back = rtl ? ArrowLeft : ArrowRight;

  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<Account | null>(null);
  const [price, setPrice] = useState(50);
  const [tab, setTab] = useState<"rules" | "settings" | "videos" | "catalog" | "activity">("rules");
  const [toast, setToast] = useState("");
  const [subscribing, setSubscribing] = useState(false);
  const [pay, setPay] = useState<{ amount: number; label: string } | null>(null);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2600); };

  const load = useCallback(async () => {
    setLoading(true);
    const [cfg, st] = await Promise.all([
      fetch("/api/tiktok/configs").then((r) => r.json()).catch(() => ({ accounts: [] })),
      fetch("/api/bot/settings").then((r) => r.json()).catch(() => ({ monthly_price_lyd: 50 })),
    ]);
    setPrice(Number(st.monthly_price_lyd ?? 50));
    const found = (cfg.accounts || []).find(
      (a: Account) => a.page_id === accountId || a.account_id === accountId,
    );
    setAccount(found && found.config ? found : null);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  async function patchConfig(patch: Partial<Config>): Promise<boolean> {
    if (!account) return false;
    const res = await fetch("/api/tiktok/configs", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: account.config.id, ...patch }),
    });
    const data = await res.json();
    if (!res.ok) { flash(data.message || data.error || t("خطأ", "Error")); return false; }
    setAccount((a) => (a ? { ...a, config: data.config } : a));
    return true;
  }

  async function subscribe() {
    setSubscribing(true);
    const res = await fetch("/api/bot/subscribe", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId: accountId, platform: "tiktok" }),
    });
    const data = await res.json();
    setSubscribing(false);
    if (!res.ok) {
      if (data.error === "insufficient_balance") {
        // Pay the shortfall inline, then subscribe automatically.
        const need = Math.max(0, Number(data.price ?? 0) - Number(data.balance ?? 0));
        setPay({ amount: Math.ceil(need), label: t("اشتراك بوت الرد الآلي", "Auto-reply bot subscription") });
        return;
      }
      flash(data.message || t("فشل الاشتراك", "Subscription failed"));
      return;
    }
    setAccount((a) => (a ? { ...a, subscription: data.subscription } : a));
    flash(t("تم الاشتراك بنجاح ✅", "Subscribed ✅"));
  }

  async function disconnect() {
    if (!account) return;
    if (!confirm(t("إلغاء ربط هذا الحساب؟", "Disconnect this account?"))) return;
    // Disconnect revokes the token at TikTok, then destroys the local credential.
    const query = account.account_id ? `accountId=${account.account_id}` : `id=${account.config.id}`;
    await fetch(`/api/tiktok/configs?${query}`, { method: "DELETE" });
    router.push("/tiktok-bot");
  }

  if (loading) {
    return <div style={{ minHeight: "100vh", background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 size={34} color={PINK} className="spin" /></div>;
  }

  if (!account) {
    return (
      <div style={{ minHeight: "100vh", background: GRADIENT, color: c.text, fontFamily: "Cairo, sans-serif", direction: rtl ? "rtl" : "ltr", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <Music2 size={40} color={c.dim} />
        <div style={{ color: c.muted, fontSize: 14 }}>{t("هذا الحساب غير مرتبط", "This account is not connected")}</div>
        <button onClick={() => router.push("/tiktok-bot")}
          style={{ background: `${PINK}22`, border: `1px solid ${PINK}55`, borderRadius: 10, padding: "10px 20px", color: c.text, fontWeight: 700, cursor: "pointer" }}>
          {t("رجوع", "Back")}
        </button>
      </div>
    );
  }

  const sub = account.subscription;
  const active = subActive(sub);
  const running = account.config.enabled && active;

  return (
    <div style={{ minHeight: "100vh", background: GRADIENT, color: c.text, fontFamily: "Cairo, sans-serif", direction: rtl ? "rtl" : "ltr", paddingBottom: 80 }}>
      <div style={{ padding: "18px 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.push("/tiktok-bot")} style={{ background: "none", border: "none", color: c.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Back size={18} /> {t("رجوع", "Back")}
        </button>
        <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Music2 size={19} color={PINK} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{account.page_name}</span>
        </h1>
        <div style={{ marginInlineStart: "auto" }}><LangToggle /></div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 20px" }}>
        {/* Subscription / power bar */}
        <div style={{ background: running ? `${GREEN}14` : CARD, border: `1px solid ${running ? `${GREEN}44` : BORDER}`, borderRadius: 16, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <Power size={20} color={running ? GREEN : c.dim} />
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              {running ? t("البوت يعمل الآن", "Bot is running") : active ? t("مشترك — البوت متوقف", "Subscribed — bot is off") : t("غير مشترك", "Not subscribed")}
            </div>
            <div style={{ fontSize: 12, color: c.muted, marginTop: 3 }}>
              {active && sub?.expires_at
                ? t(`ينتهي الاشتراك: ${new Date(sub.expires_at).toLocaleDateString("ar-LY")}`, `Renews/expires: ${new Date(sub.expires_at).toLocaleDateString("en-GB")}`)
                : t(`${price} د.ل شهرياً`, `${price} LYD / month`)}
            </div>
          </div>
          {!active ? (
            <button onClick={subscribe} disabled={subscribing}
              style={{ background: `linear-gradient(135deg, ${PINK}, #d6006b)`, border: "none", borderRadius: 11, padding: "11px 20px", color: c.text, fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              {subscribing ? <Loader2 size={16} className="spin" /> : <CreditCard size={16} />}
              {t(`اشترك — ${price} د.ل`, `Subscribe — ${price} LYD`)}
            </button>
          ) : (
            <Toggle on={account.config.enabled} onChange={(v) => patchConfig({ enabled: v }).then((ok) => ok && flash(v ? t("تم التشغيل", "Turned on") : t("تم الإيقاف", "Turned off")))} />
          )}
        </div>

        {active && sub?.expires_at && new Date(sub.expires_at).getTime() - Date.now() < 3 * 86400000 && (
          <div style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.35)", borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#fbbf24", display: "flex", gap: 8 }}>
            <AlertTriangle size={16} /> {t("اشتراكك على وشك الانتهاء — جدّد لتفادي توقف البوت", "Your subscription is expiring soon — renew to avoid downtime")}
            <button onClick={subscribe} style={{ marginInlineStart: "auto", background: "none", border: "none", color: "#fde68a", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>{t("تجديد", "Renew")}</button>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 18, overflowX: "auto" }}>
          {([
            ["rules", MessageSquare, t("القواعد", "Rules")],
            ["settings", Settings2, t("الإعدادات", "Settings")],
            ["videos", Video, t("الفيديوهات", "Videos")],
            ["catalog", Package, t("الكتالوج", "Catalog")],
            ["activity", Activity, t("النشاط", "Activity")],
          ] as const).map(([k, Icon, label]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ background: tab === k ? `${PINK}22` : "transparent", border: `1px solid ${tab === k ? `${PINK}55` : BORDER}`, borderRadius: 10, padding: "9px 15px", color: tab === k ? c.text : c.muted, cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {tab === "rules" && <RulesTab configId={account.config.id} t={t} />}
        {tab === "settings" && <SettingsTab config={account.config} patch={patchConfig} onDisconnect={disconnect} scopes={account.granted_scopes} t={t} />}
        {tab === "videos" && <VideosTab accountId={account.account_id} config={account.config} patch={patchConfig} t={t} />}
        {tab === "catalog" && (
          <CatalogTab config={account.config} accountKey={account.page_id} patch={patchConfig} t={t} />
        )}
        {tab === "activity" && <ActivityTab configId={account.config.id} t={t} />}
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 24, insetInlineStart: "50%", transform: "translateX(-50%)", background: c.toast, border: `1px solid ${PINK}55`, borderRadius: 12, padding: "12px 22px", fontSize: 14, fontWeight: 700, zIndex: 50, boxShadow: "0 8px 30px rgba(0,0,0,0.5)" }}>{toast}</div>
      )}

      {pay && (
        <WalletModal
          payAmount={pay.amount}
          payLabel={pay.label}
          onPaid={() => { setPay(null); subscribe(); }}
          onClose={() => setPay(null)}
        />
      )}
      <style>{`@keyframes spin-anim { to { transform: rotate(360deg); } } .spin { animation: spin-anim 1s linear infinite; } input, textarea, select { font-family: inherit; }`}</style>
    </div>
  );
}

// ── Toggle ─────────────────────────────────────────────────────────────────────
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  const { light } = useTheme();
  const c = botColors(light);
  return (
    <button onClick={() => onChange(!on)} aria-pressed={on}
      style={{ width: 52, height: 30, borderRadius: 20, border: "none", cursor: "pointer", background: on ? GREEN : "#334155", position: "relative", transition: "background .2s", flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 3, insetInlineStart: on ? 25 : 3, width: 24, height: 24, borderRadius: "50%", background: "#fff", transition: "inset-inline-start .2s" }} />
    </button>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const { light } = useTheme();
  const c = botColors(light);
  const BORDER = c.border;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
        {hint && <div style={{ fontSize: 12, color: c.muted, marginTop: 3 }}>{hint}</div>}
      </div>
      {children}
    </div>
  );
}

// ── Settings tab ─────────────────────────────────────────────────────────────
function SettingsTab({ config, patch, onDisconnect, scopes, t }: {
  config: Config; patch: (p: Partial<Config>) => Promise<boolean>; onDisconnect: () => void;
  scopes?: string[]; t: TF;
}) {
  const { light } = useTheme();
  const c = botColors(light);
  const CARD = c.card;
  const BORDER = c.border;

  // Account-level keyword groups and banned words — inherited by every video
  // unless a video defines its own, exactly as on the Facebook side.
  const [groups, setGroups] = useState<ReplyGroup[]>(config.reply_groups || []);
  const [banned, setBanned] = useState((config.banned_words || []).join("، "));
  function saveGroups() {
    patch({
      reply_groups: groups
        .map((g) => ({ ...g, keywords: (g.keywords || []).map((k) => k.trim()).filter(Boolean) }))
        .filter((g) => g.keywords.length > 0),
      banned_words: banned.split(/[،,\n]/).map((x) => x.trim()).filter(Boolean),
    });
  }

  const box: React.CSSProperties = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20, marginTop: 18 };

  return (
    <>
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "6px 20px 20px" }}>
      <Row label={t("الرد العلني على التعليقات", "Public reply on comments")}
        hint={t("ينشر البوت الرد تحت تعليق العميل", "The bot posts the reply under the customer's comment")}>
        <Toggle on={config.reply_public} onChange={(v) => patch({ reply_public: v })} />
      </Row>
      <Row label={t("الردود الذكية (AI)", "Smart AI replies")}
        hint={t("رد بالذكاء الاصطناعي عند عدم مطابقة أي قاعدة", "AI reply when no rule matches")}>
        <Toggle on={config.ai_enabled} onChange={(v) => patch({ ai_enabled: v })} />
      </Row>
      <Row label={t("سقف الردود بالدقيقة", "Replies per minute")} hint={t("حماية من الحظر", "Anti-block protection")}>
        <input type="number" min={1} max={60} defaultValue={config.throttle_per_min}
          onBlur={(e) => patch({ throttle_per_min: Number(e.target.value) })}
          style={{ width: 70, background: c.surface, border: `1px solid ${BORDER}`, borderRadius: 9, padding: "9px 10px", color: c.text, textAlign: "center" }} />
      </Row>

      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 7 }}>
          <Sparkles size={14} color={CYAN} /> {t("شخصية البوت", "Bot persona")}
        </div>
        <textarea defaultValue={config.ai_persona || ""} rows={3}
          onBlur={(e) => patch({ ai_persona: e.target.value })}
          placeholder={t("مثال: أنت موظف مبيعات لطيف في محل إلكترونيات في بنغازي…", "e.g. You are a friendly sales rep at an electronics shop in Benghazi…")}
          style={{ width: "100%", boxSizing: "border-box", background: c.surface, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "11px 14px", color: c.text, fontSize: 13.5, resize: "vertical" }} />
      </div>

      {!!scopes?.length && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 7 }}>
            <KeyRound size={14} color={CYAN} /> {t("الصلاحيات الممنوحة", "Granted permissions")}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {scopes.map((sc) => (
              <span key={sc} style={{ fontSize: 11.5, color: c.text, background: c.surface,
                border: `1px solid ${BORDER}`, borderRadius: 999, padding: "4px 10px" }}>{sc}</span>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: c.muted, marginTop: 8, lineHeight: 1.7 }}>
            {t(
              "تُمنح هذه الصلاحيات من تيك توك عند الربط — لتغييرها أعد ربط الحساب.",
              "TikTok grants these at connection time — reconnect the account to change them.",
            )}
          </div>
        </div>
      )}

      <button onClick={onDisconnect}
        style={{ width: "100%", marginTop: 20, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 11, padding: "12px 0", color: "#f87171", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <Trash2 size={15} /> {t("إلغاء ربط الحساب", "Disconnect account")}
      </button>
    </div>

    {/* Keyword groups — "price" comments get the price, "phone" comments get the
        numbers. Set once here and every video inherits them. */}
    <div style={box}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 7 }}>
        <MessageSquare size={15} color={CYAN} /> {t("مجموعات الردود الافتراضية", "Default reply groups")}
      </div>
      <div style={{ fontSize: 12, color: c.muted, marginBottom: 10, lineHeight: 1.8 }}>
        {t("اضبطها مرة واحدة وترثها كل الفيديوهات — تعليق فيه «سعر» يأخذ ردّ السعر، وتعليق فيه «رقم» يأخذ أرقام التواصل.",
           "Set these once and every video inherits them — a comment containing \"price\" gets the price reply, one containing \"phone\" gets the contact numbers.")}
      </div>
      <ReplyGroupsEditor groups={groups} onChange={setGroups} onSave={saveGroups} c={c} t={t} accent={PINK} />
    </div>

    <div style={box}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{t("الكلمات المحظورة", "Banned words")}</div>
      <BannedWordsEditor
        words={banned} action={(config.banned_action as "delete" | "hide" | "ignore") || "hide"}
        onWords={setBanned} onAction={(a) => patch({ banned_action: a })}
        onSave={saveGroups} c={c} t={t}
      />
      <div style={{ marginTop: 16 }}>
        <Row label={t("ابدأ الرد باسم صاحب التعليق", "Open replies with the commenter's name")}
          hint={t("«أحمد، السعر 250 د.ل»", "\"Ahmed, it's 250 LYD\"")}>
          <Toggle on={config.mention_author !== false} onChange={(v) => patch({ mention_author: v })} />
        </Row>
        <Row label={t("رد واحد لكل شخص في الفيديو", "One reply per person per video")}
          hint={t("من يعلّق خمس مرات يصله رد واحد", "Someone who comments five times gets one answer")}>
          <Toggle on={config.once_per_user !== false} onChange={(v) => patch({ once_per_user: v })} />
        </Row>
        <Row label={t("إعجاب بالتعليقات", "Like comments")}
          hint={t("إعجاب على كل تعليق يردّ عليه", "A like on every comment it answers")}>
          <Toggle on={!!config.like_comments} onChange={(v) => patch({ like_comments: v })} />
        </Row>
      </div>
    </div>
    </>
  );
}

// ── Rules tab — compact keyword→reply editor (TikTok replies are public only) ──
function RulesTab({ configId, t }: { configId: string; t: TF }) {
  const { light } = useTheme();
  const c = botColors(light);
  const CARD = c.card;
  const BORDER = c.border;
  const [rules, setRules] = useState<Rule[]>([]);
  const [kw, setKw] = useState("");
  const [reply, setReply] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const d = await fetch(`/api/bot/rules?configId=${configId}`).then((r) => r.json());
    setRules(d.rules || []); setLoading(false);
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

  const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", background: c.surface, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "11px 14px", color: c.text, fontSize: 13.5 };

  return (
    <div>
      {loading ? (
        <div style={{ textAlign: "center", padding: 30, color: c.dim }}><Loader2 size={24} className="spin" /></div>
      ) : rules.length === 0 ? (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24, textAlign: "center", color: c.muted, fontSize: 14, marginBottom: 16 }}>
          {t("لا قواعد بعد — أضف أول قاعدة ردّ بالأسفل", "No rules yet — add your first reply rule below")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {rules.map((r) => (
            <div key={r.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: CYAN, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.match_type === "catch_all" ? t("كل التعليقات", "All comments") : r.keywords.join("، ")}
                </div>
                <div style={{ fontSize: 13, color: c.muted, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>↳ {r.public_reply}</div>
              </div>
              <button onClick={() => del(r.id)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{t("إضافة قاعدة ردّ", "Add a reply rule")}</div>
        <input value={kw} onChange={(e) => setKw(e.target.value)} style={{ ...inp, marginBottom: 9 }}
          placeholder={t("الكلمات المفتاحية (اتركها فارغة = كل التعليقات)", "Keywords (leave empty = all comments)")} />
        <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} style={{ ...inp, resize: "vertical", marginBottom: 10 }}
          placeholder={t("نص الرد — مثال: السعر 250 د.ل، راسلنا للطلب 📩", "Reply text — e.g. Price is 250 LYD, DM us to order 📩")} />
        <button onClick={add} disabled={saving || !reply.trim()}
          style={{ width: "100%", background: reply.trim() ? `linear-gradient(135deg, ${PINK}, #d6006b)` : c.surface, border: "none", borderRadius: 11, padding: "12px 0", color: reply.trim() ? "#fff" : c.dim, fontWeight: 700, fontSize: 14, cursor: reply.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />} {t("إضافة قاعدة", "Add rule")}
        </button>
      </div>
    </div>
  );
}

// ── Videos tab — placeholder shell (per-video replies land here later) ────────
interface VideoRow { id: string; caption: string; createdTime: number | null; thumbnail: string | null }

function VideosTab({ accountId, config, patch, t }: {
  accountId: string; config: Config; patch: (p: Partial<Config>) => Promise<boolean>; t: TF;
}) {
  const { light } = useTheme();
  const c = botColors(light);
  const CARD = c.card;
  const BORDER = c.border;
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<VideoRow | null>(null);

  useEffect(() => {
    fetch(`/api/tiktok/videos?accountId=${encodeURIComponent(accountId)}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setErr(d.message || d.error); else setVideos(d.videos || []); })
      .catch(() => setErr(t("تعذّر جلب الفيديوهات", "Couldn't load videos")))
      .finally(() => setLoading(false));
  }, [accountId]); // eslint-disable-line react-hooks/exhaustive-deps

  const overrides = (config.post_overrides || {}) as Record<string, PostOverrideValue>;
  const hasOverride = (id: string) => {
    const o = overrides[id];
    return !!o && ((o.groups?.length ?? 0) > 0 || !!(o.private_reply || "").trim()
      || (o.public_replies?.some((s) => (s || "").trim()) ?? false) || !!o.ai);
  };

  async function saveOverride(videoId: string, v: PostOverrideValue) {
    await patch({ post_overrides: { ...overrides, [videoId]: v } });
    setEditing(null);
  }

  if (editing) {
    return (
      <PostOverrideEditor
        initial={overrides[editing.id]}
        unitLabel={t("الفيديو", "video")}
        onSave={(v) => saveOverride(editing.id, v)}
        onClose={() => setEditing(null)}
        c={c} t={t} accent={PINK}
      />
    );
  }

  if (loading) {
    return <div style={{ textAlign: "center", padding: 34 }}><Loader2 size={24} className="spin" color={PINK} /></div>;
  }

  if (err) {
    return (
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 28, textAlign: "center" }}>
        <AlertTriangle size={30} color="#f59e0b" style={{ marginBottom: 10 }} />
        <div style={{ fontSize: 13.5, color: c.muted, lineHeight: 1.8 }}>{err}</div>
      </div>
    );
  }

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20 }}>
      <div style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.8, marginBottom: 14 }}>
        {t("خصّص ردّاً لفيديو بعينه — يتقدّم على القواعد العامة ومجموعات الحساب.",
           "Give one video its own reply — it takes priority over the general rules and the account's groups.")}
      </div>
      {videos.length === 0 ? (
        <div style={{ fontSize: 13, color: c.muted, textAlign: "center", padding: 20 }}>
          {t("لا فيديوهات في هذا الحساب بعد.", "No videos on this account yet.")}
        </div>
      ) : videos.map((v) => (
        <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 11, background: c.surface, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 11, marginBottom: 9 }}>
          {v.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.thumbnail} alt="" style={{ width: 46, height: 60, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <div style={{ width: 46, height: 60, borderRadius: 8, background: c.card, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Video size={18} color={c.dim} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {v.caption || t("(فيديو بدون وصف)", "(video with no caption)")}
            </div>
            {hasOverride(v.id) && (
              <span style={{ fontSize: 10.5, fontWeight: 800, color: GREEN, background: "rgba(34,197,94,0.15)", borderRadius: 100, padding: "2px 8px", display: "inline-block", marginTop: 5 }}>
                {t("ردّ مخصّص", "custom reply")}
              </span>
            )}
          </div>
          <button onClick={() => setEditing(v)}
            style={{ background: `${PINK}1f`, border: `1px solid ${PINK}55`, borderRadius: 9, padding: "7px 13px", color: PINK, fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
            {hasOverride(v.id) ? t("تعديل", "Edit") : t("تخصيص", "Customise")}
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Catalog tab ──────────────────────────────────────────────────────────────
// The same smart catalog the Facebook bot uses, reading the same products: which
// one a comment is about, and that product's price. Only the wording differs
// ("video" rather than "post"), which the shared panel handles.
function CatalogTab({ config, accountKey, patch, t }: {
  config: Config; accountKey: string; patch: (p: Partial<Config>) => Promise<boolean>; t: TF;
}) {
  const { light } = useTheme();
  const c = botColors(light);
  return (
    <CatalogPanel
      pageId={accountKey}
      platform="tiktok"
      mode={config.catalog_match || "off"}
      onMode={(m) => patch({ catalog_match: m })}
      c={c}
      t={t}
      accent={PINK}
    />
  );
}

// ── Activity tab ─────────────────────────────────────────────────────────────
function ActivityTab({ configId, t }: { configId: string; t: TF }) {
  const { light } = useTheme();
  const c = botColors(light);
  const CARD = c.card;
  const BORDER = c.border;
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [stats, setStats] = useState<{ total: number; public_sent: number; failed: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/bot/logs?configId=${configId}`).then((r) => r.json()).then((d) => {
      setLogs(d.logs || []); setStats(d.stats || null); setLoading(false);
    });
  }, [configId]);

  const badge = (s: string) => {
    const c = s === "sent" ? GREEN : s === "failed" ? "#ef4444" : "#94a3b8";
    const l = s === "sent" ? t("أُرسل", "sent") : s === "failed" ? t("فشل", "failed") : t("تخطّي", "skip");
    return <span style={{ fontSize: 11, color: c, background: `${c}18`, padding: "2px 7px", borderRadius: 6 }}>{l}</span>;
  };

  if (loading) return <div style={{ textAlign: "center", padding: 30, color: c.dim }}><Loader2 size={24} className="spin" /></div>;

  return (
    <div>
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
          {[[t("تعليقات معالجة", "Comments handled"), stats.total, CYAN], [t("ردود علنية", "Public replies"), stats.public_sent, PINK], [t("إخفاقات", "Failures"), stats.failed, "#ef4444"]].map(([l, v, hue], i) => (
            <div key={i} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: hue as string }}>{v as number}</div>
              <div style={{ fontSize: 11, color: c.muted, marginTop: 3 }}>{l as string}</div>
            </div>
          ))}
        </div>
      )}
      {logs.length === 0 ? (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24, textAlign: "center", color: c.muted, fontSize: 14 }}>
          {t("لا نشاط بعد — سيظهر هنا كل تعليق يرد عليه البوت", "No activity yet — every comment the bot replies to will appear here")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {logs.map((l) => (
            <div key={l.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{l.commenter_name || t("زائر", "Visitor")}</span>
                <span style={{ marginInlineStart: "auto" }}>{badge(l.public_status)}</span>
              </div>
              <div style={{ fontSize: 13, color: c.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.comment_message || "—"}</div>
              {l.error && <div style={{ fontSize: 11, color: "#f87171", marginTop: 4 }}>{l.error}</div>}
              <div style={{ fontSize: 11, color: c.dim, marginTop: 4 }}>{new Date(l.created_at).toLocaleString(t("ar-LY", "en-GB"))}</div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
