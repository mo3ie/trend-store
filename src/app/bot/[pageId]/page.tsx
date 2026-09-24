"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Loader2, Bot, MessageSquare, Users, Activity,
  Settings2, Plus, Trash2, Save, AlertTriangle, Upload, X,
  Sparkles, CreditCard, Power, Clock, Newspaper, Star, CheckCircle2, RefreshCw, Pencil,
} from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useTheme } from "@/hooks/useTheme";
import { botColors } from "@/lib/botTheme";
import LangToggle from "@/components/LangToggle";
import WalletModal from "@/components/WalletModal";
import { startPageConnect } from "@/lib/connectPage";

const BLUE = "#1877f2", GREEN = "#22c55e";

interface Attachment { type: "image" | "file"; url: string; }
interface PostOverride { public_replies: string[]; private_reply: string; attachments: Attachment[]; }
interface Rule {
  id: string; name: string | null; keywords: string[]; match_type: string;
  public_reply: string | null; public_replies: string[]; private_reply: string | null; attachments: Attachment[];
  enabled: boolean; priority: number;
}
interface Config {
  id: string; enabled: boolean; reply_public: boolean; reply_private: boolean;
  ai_enabled: boolean; ai_persona: string | null; default_public_reply: string | null;
  throttle_per_min: number; webhook_subscribed: boolean;
  like_comments: boolean; min_delay_sec: number; max_delay_sec: number;
  default_private_reply: string | null; public_replies: string[];
  post_filter: string[]; post_filter_enabled: boolean; active_token_id: string | null;
  post_overrides: Record<string, PostOverride>;
}
interface Sub { status: string; expires_at: string | null; }
interface Token { id: string; label: string | null; status: string; cooldown_until: string | null; fail_count: number; last_used_at: string | null; }
interface Post { id: string; postId: string; message: string; createdTime: string; picture?: string; permalinkUrl?: string; }
interface LogRow { id: string; comment_id: string; commenter_name: string | null; comment_message: string | null; public_status: string; private_status: string; matched_rule_id: string | null; error: string | null; created_at: string; }

function subActive(s: Sub | null): boolean {
  return !!s && s.status === "active" && (!s.expires_at || new Date(s.expires_at).getTime() > Date.now());
}

export default function BotManage() {
  const { light } = useTheme();
  const c = botColors(light);
  const GRADIENT = c.gradient;
  const CARD_BG = c.card;
  const CARD = c.card;
  const BORDER = c.border;
  const router = useRouter();
  const params = useParams();
  const pageId = String(params.pageId);
  const { t, rtl } = useLang();
  const Back = rtl ? ArrowLeft : ArrowRight;

  const [loading, setLoading] = useState(true);
  const [pageName, setPageName] = useState("");
  const [config, setConfig] = useState<Config | null>(null);
  const [sub, setSub] = useState<Sub | null>(null);
  const [price, setPrice] = useState(50);
  const [tab, setTab] = useState<"settings" | "rules" | "posts" | "accounts" | "activity">("rules");
  const [toast, setToast] = useState("");
  const [subscribing, setSubscribing] = useState(false);
  const [pay, setPay] = useState<{ amount: number; label: string } | null>(null);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2600); };

  const load = useCallback(async () => {
    setLoading(true);
    const [cfg, st] = await Promise.all([
      fetch("/api/bot/configs").then((r) => r.json()).catch(() => ({ pages: [] })),
      fetch("/api/bot/settings").then((r) => r.json()).catch(() => ({ monthly_price_lyd: 50 })),
    ]);
    setPrice(Number(st.monthly_price_lyd ?? 50));
    const row = (cfg.pages || []).find((p: { page_id: string }) => p.page_id === pageId);
    if (row) {
      setPageName(row.page_name || pageId);
      setSub(row.subscription);
      if (row.config) setConfig(row.config);
      else {
        // No config yet — create one so the console is usable.
        const created = await fetch("/api/bot/configs", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageId }),
        }).then((r) => r.json());
        setConfig(created.config);
      }
    }
    setLoading(false);
  }, [pageId]);

  useEffect(() => { load(); }, [load]);

  async function patchConfig(patch: Partial<Config>): Promise<boolean> {
    if (!config) return false;
    const res = await fetch("/api/bot/configs", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: config.id, ...patch }),
    });
    const data = await res.json();
    if (!res.ok) { flash(data.message || data.error || t("خطأ", "Error")); return false; }
    setConfig(data.config);
    return true;
  }

  async function subscribe() {
    setSubscribing(true);
    const res = await fetch("/api/bot/subscribe", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId }),
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
    setSub(data.subscription);
    flash(t("تم الاشتراك بنجاح ✅", "Subscribed ✅"));
  }

  const active = subActive(sub);
  const running = !!config?.enabled && active;

  if (loading) {
    return <div style={{ minHeight: "100vh", background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 size={34} color={BLUE} className="spin" /></div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: GRADIENT, color: c.text, fontFamily: "Cairo, sans-serif", direction: rtl ? "rtl" : "ltr", paddingBottom: 80 }}>
      <div style={{ padding: "18px 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.push("/bot")} style={{ background: "none", border: "none", color: c.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Back size={18} /> {t("رجوع", "Back")}
        </button>
        <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Bot size={19} color={BLUE} /> <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pageName}</span>
        </h1>
        <div style={{ marginInlineStart: "auto" }}><LangToggle /></div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 20px" }}>
        {/* Subscription / power bar */}
        <div style={{ background: running ? `${GREEN}14` : CARD, border: `1px solid ${running ? `${GREEN}44` : BORDER}`, borderRadius: 16, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <Power size={20} color={running ? GREEN : "#64748b"} />
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
              style={{ background: `linear-gradient(135deg, ${BLUE}, #6b46c1)`, border: "none", borderRadius: 11, padding: "11px 20px", color: c.text, fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              {subscribing ? <Loader2 size={16} className="spin" /> : <CreditCard size={16} />}
              {t(`اشترك — ${price} د.ل`, `Subscribe — ${price} LYD`)}
            </button>
          ) : (
            <Toggle on={!!config?.enabled} onChange={(v) => patchConfig({ enabled: v }).then((ok) => ok && flash(v ? t("تم التشغيل", "Turned on") : t("تم الإيقاف", "Turned off")))} />
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
            ["posts", Newspaper, t("المنشورات", "Posts")],
            ["accounts", Users, t("الحسابات", "Accounts")],
            ["activity", Activity, t("النشاط", "Activity")],
          ] as const).map(([k, Icon, label]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ background: tab === k ? `${BLUE}22` : "transparent", border: `1px solid ${tab === k ? `${BLUE}55` : BORDER}`, borderRadius: 10, padding: "9px 15px", color: tab === k ? "#fff" : "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {config && tab === "rules" && <RulesTab configId={config.id} flash={flash} t={t} />}
        {config && tab === "settings" && <SettingsTab config={config} patch={patchConfig} t={t} />}
        {config && tab === "posts" && <PostsTab config={config} pageId={pageId} patch={patchConfig} flash={flash} t={t} />}
        {config && tab === "accounts" && <AccountsTab config={config} patch={patchConfig} flash={flash} t={t} />}
        {config && tab === "activity" && <ActivityTab configId={config.id} t={t} />}
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 24, insetInlineStart: "50%", transform: "translateX(-50%)", background: c.toast, border: `1px solid ${BLUE}55`, borderRadius: 12, padding: "12px 22px", fontSize: 14, fontWeight: 700, zIndex: 50, boxShadow: c.shadow }}>{toast}</div>
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
  return (
    <button onClick={() => onChange(!on)} aria-pressed={on}
      style={{ width: 52, height: 30, borderRadius: 20, border: "none", cursor: "pointer", background: on ? GREEN : "#334155", position: "relative", transition: "background .2s", flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 3, insetInlineStart: on ? 25 : 3, width: 24, height: 24, borderRadius: "50%", background: "#fff", transition: "inset-inline-start .2s" }} />
    </button>
  );
}

// ── Settings tab ─────────────────────────────────────────────────────────────
type TF = (ar: string, en: string) => string;
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

function SettingsTab({ config, patch, t }: { config: Config; patch: (p: Partial<Config>) => Promise<boolean>; t: TF }) {
  const { light } = useTheme();
  const c = botColors(light);
  const CARD = c.card;
  const BORDER = c.border;
  // Public-reply variants: one per line. Seeded from the array, or the legacy single value.
  const [pubVariants, setPubVariants] = useState(
    (config.public_replies?.length ? config.public_replies : (config.default_public_reply ? [config.default_public_reply] : [])).join("\n")
  );
  const [priv, setPriv] = useState(config.default_private_reply || "");
  const [persona, setPersona] = useState(config.ai_persona || "");
  const [throttle, setThrottle] = useState(config.throttle_per_min);
  const [minD, setMinD] = useState(config.min_delay_sec ?? 2);
  const [maxD, setMaxD] = useState(config.max_delay_sec ?? 6);

  const numInput: React.CSSProperties = { width: 64, background: c.surface, border: `1px solid ${BORDER}`, borderRadius: 9, padding: "8px 10px", color: c.text, textAlign: "center" };
  const box: React.CSSProperties = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "6px 20px" };

  function saveVariants() {
    const list = pubVariants.split("\n").map((s) => s.trim()).filter(Boolean);
    patch({ public_replies: list, default_public_reply: list[0] || "" });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={box}>
        <Row label={t("الرد العلني على التعليق", "Public reply on the comment")} hint={t("نشر رد ظاهر تحت التعليق", "Post a visible reply under the comment")}>
          <Toggle on={config.reply_public} onChange={(v) => patch({ reply_public: v })} />
        </Row>
        <Row label={t("الرد الخاص (رسالة)", "Private reply (DM)")} hint={t("إرسال السعر والتفاصيل في الخاص", "Send price & details in a private message")}>
          <Toggle on={config.reply_private} onChange={(v) => patch({ reply_private: v })} />
        </Row>
        <Row label={t("الإعجاب بالتعليق", "Like the comment")} hint={t("يضيف إعجاباً على كل تعليق يردّ عليه", "Add a like on every comment it replies to")}>
          <Toggle on={config.like_comments} onChange={(v) => patch({ like_comments: v })} />
        </Row>
        <Row label={t("الردود الذكية (AI)", "Smart AI replies")} hint={t("رد بالذكاء الاصطناعي عند عدم مطابقة أي قاعدة", "Use AI when no keyword rule matches")}>
          <Toggle on={config.ai_enabled} onChange={(v) => patch({ ai_enabled: v })} />
        </Row>
        <Row label={t("سقف الردود بالدقيقة", "Replies per minute cap")} hint={t("حماية من الحظر عند التعليقات الكثيرة", "Anti-block protection during comment bursts")}>
          <input type="number" min={1} max={60} value={throttle}
            onChange={(e) => setThrottle(Number(e.target.value))}
            onBlur={() => throttle !== config.throttle_per_min && patch({ throttle_per_min: throttle })}
            style={numInput} />
        </Row>
        <Row label={t("التأخير بين تعليق وتعليق (ثوانٍ)", "Delay between replies (seconds)")} hint={t("انتظار عشوائي بين كل رد وآخر ليبدو بشرياً", "Random wait before each reply so it looks human")}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="number" min={0} max={120} value={minD}
              onChange={(e) => setMinD(Number(e.target.value))}
              onBlur={() => minD !== config.min_delay_sec && patch({ min_delay_sec: minD })}
              style={numInput} />
            <Clock size={14} color="#64748b" />
            <input type="number" min={0} max={300} value={maxD}
              onChange={(e) => setMaxD(Number(e.target.value))}
              onBlur={() => maxD !== config.max_delay_sec && patch({ max_delay_sec: maxD })}
              style={numInput} />
          </div>
        </Row>
      </div>

      <div style={{ ...box, padding: 20 }}>
        <label style={{ fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <RefreshCw size={14} color={BLUE} /> {t("نصوص الرد العلني (تنويع)", "Public reply texts (variety)")}
        </label>
        <div style={{ fontSize: 12, color: c.muted, marginBottom: 8 }}>
          {t("سطر لكل نص — يختار البوت واحداً عشوائياً في كل مرة كي لا تتكرّر الردود.", "One text per line — the bot picks one at random each time so replies don't repeat.")}
        </div>
        <textarea value={pubVariants} onChange={(e) => setPubVariants(e.target.value)} onBlur={saveVariants} rows={4}
          placeholder={t("تمّت مراسلتك في الخاص ✅\nراسلناك على الخاص 📩\nتفقّد رسائلك 💬", "We've DMed you ✅\nCheck your inbox 📩\nSent you a private message 💬")}
          style={{ width: "100%", background: c.surface, border: `1px solid ${BORDER}`, borderRadius: 9, padding: "11px 14px", color: c.text, boxSizing: "border-box", resize: "vertical" }} />
      </div>

      <div style={{ ...box, padding: 20 }}>
        <label style={{ fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <MessageSquare size={14} color={BLUE} /> {t("الرسالة الخاصة الافتراضية", "Default private message")}
        </label>
        <div style={{ fontSize: 12, color: c.muted, marginBottom: 8 }}>
          {t("تُرسل في الخاص عندما لا تحدّد القاعدة رسالة خاصة خاصة بها.", "Sent privately when a matched rule has no private message of its own.")}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <textarea value={priv} onChange={(e) => setPriv(e.target.value)} rows={3}
            placeholder={t("شكراً لتواصلك! أرسل لنا استفسارك وسنردّ فوراً 🌟", "Thanks for reaching out! Send us your question and we'll reply right away 🌟")}
            style={{ flex: 1, background: c.surface, border: `1px solid ${BORDER}`, borderRadius: 9, padding: "11px 14px", color: c.text, boxSizing: "border-box", resize: "vertical" }} />
          <button onClick={() => patch({ default_private_reply: priv })}
            style={{ background: `${BLUE}22`, border: `1px solid ${BLUE}55`, borderRadius: 9, padding: "0 16px", color: c.text, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontWeight: 700, alignSelf: "stretch" }}>
            <Save size={15} /> {t("حفظ", "Save")}
          </button>
        </div>
      </div>

      {config.ai_enabled && (
        <div style={{ ...box, padding: 20 }}>
          <label style={{ fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><Sparkles size={15} color={BLUE} /> {t("شخصية البوت (للـ AI)", "Bot persona (for AI)")}</label>
          <textarea value={persona} onChange={(e) => setPersona(e.target.value)}
            onBlur={() => persona !== (config.ai_persona || "") && patch({ ai_persona: persona })}
            rows={4} placeholder={t("مثال: أنت مساعد مبيعات لمتجر إلكترونيات، ردودك مختصرة وودّية بالعربية.", "e.g. You are a sales assistant for an electronics store; keep replies short and friendly.")}
            style={{ width: "100%", background: c.surface, border: `1px solid ${BORDER}`, borderRadius: 9, padding: "11px 14px", color: c.text, boxSizing: "border-box", resize: "vertical" }} />
        </div>
      )}
    </div>
  );
}

// ── Rules tab ────────────────────────────────────────────────────────────────
const MATCH_LABELS = (t: TF): [string, string][] => [
  ["any_contains", t("يحتوي أي كلمة", "Contains any word")],
  ["all_contains", t("يحتوي كل الكلمات", "Contains all words")],
  ["exact", t("مطابقة تامة", "Exact match")],
  ["regex", t("تعبير نمطي", "Regex")],
  ["catch_all", t("يلتقط كل التعليقات", "Catch-all")],
];

function RulesTab({ configId, flash, t }: { configId: string; flash: (m: string) => void; t: TF }) {
  const { light } = useTheme();
  const c = botColors(light);
  const CARD = c.card;
  const BORDER = c.border;
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Rule | null>(null);

  const loadRules = useCallback(async () => {
    setLoading(true);
    const data = await fetch(`/api/bot/rules?configId=${configId}`).then((r) => r.json());
    setRules(data.rules || []);
    setLoading(false);
  }, [configId]);
  useEffect(() => { loadRules(); }, [loadRules]);

  function newRule() {
    setEditing({ id: "", name: "", keywords: [], match_type: "any_contains", public_reply: "", public_replies: [], private_reply: "", attachments: [], enabled: true, priority: 0 });
  }

  async function del(id: string) {
    if (!confirm(t("حذف هذه القاعدة؟", "Delete this rule?"))) return;
    await fetch(`/api/bot/rules?id=${id}`, { method: "DELETE" });
    setRules((r) => r.filter((x) => x.id !== id));
  }

  if (editing) return <RuleEditor rule={editing} configId={configId} t={t} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); loadRules(); flash(t("تم الحفظ", "Saved")); }} />;

  return (
    <div>
      <button onClick={newRule}
        style={{ width: "100%", background: `linear-gradient(135deg, ${BLUE}, #6b46c1)`, border: "none", borderRadius: 12, padding: "13px 0", color: c.text, fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 }}>
        <Plus size={17} /> {t("قاعدة جديدة", "New rule")}
      </button>

      {loading ? <div style={{ textAlign: "center", padding: 30, color: c.dim }}><Loader2 size={24} className="spin" /></div>
        : rules.length === 0 ? (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 28, textAlign: "center", color: c.muted, fontSize: 14 }}>
            {t("لا قواعد بعد. أنشئ قاعدة: مثلاً كلمة \"السعر\" → رد بالسعر في الخاص.", "No rules yet. Create one: e.g. keyword \"price\" → reply with the price privately.")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rules.map((r) => (
              <div key={r.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "14px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{r.name || (r.keywords[0] ?? t("قاعدة", "Rule"))}</div>
                    <div style={{ fontSize: 12, color: c.muted, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.match_type === "catch_all" ? t("كل التعليقات", "All comments") : (r.keywords.join("، ") || "—")}
                    </div>
                  </div>
                  {!r.enabled && <span style={{ fontSize: 11, color: c.muted, background: c.surface, padding: "3px 8px", borderRadius: 6 }}>{t("متوقفة", "Off")}</span>}
                  {r.attachments?.length > 0 && <span style={{ fontSize: 11, color: BLUE }}>{r.attachments.length} 📎</span>}
                  <button onClick={() => setEditing(r)} style={{ background: c.surface, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "6px 10px", color: "#cbd5e1", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>{t("تعديل", "Edit")}</button>
                  <button onClick={() => del(r.id)} style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "6px 8px", color: "#f87171", cursor: "pointer" }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

function RuleEditor({ rule, configId, t, onClose, onSaved }: { rule: Rule; configId: string; t: TF; onClose: () => void; onSaved: () => void }) {
  const { light } = useTheme();
  const c = botColors(light);
  const CARD = c.card;
  const BORDER = c.border;
  const [name, setName] = useState(rule.name || "");
  const [kwText, setKwText] = useState(rule.keywords.join("، "));
  const [matchType, setMatchType] = useState(rule.match_type);
  const [pubVariants, setPubVariants] = useState(
    (rule.public_replies?.length ? rule.public_replies : (rule.public_reply ? [rule.public_reply] : [])).join("\n")
  );
  const [priv, setPriv] = useState(rule.private_reply || "");
  const [atts, setAtts] = useState<Attachment[]>(rule.attachments || []);
  const [enabled, setEnabled] = useState(rule.enabled);
  const [priority, setPriority] = useState(rule.priority);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/bot/upload", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);
    if (data.url) setAtts((a) => [...a, { type: data.type, url: data.url }]);
  }

  async function save() {
    setSaving(true);
    const keywords = kwText.split(/[،,\n]/).map((s) => s.trim()).filter(Boolean);
    const publicList = pubVariants.split("\n").map((s) => s.trim()).filter(Boolean);
    const payload = { name, keywords, match_type: matchType, public_reply: publicList[0] || "", public_replies: publicList, private_reply: priv, attachments: atts, enabled, priority };
    if (rule.id) {
      await fetch("/api/bot/rules", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: rule.id, ...payload }) });
    } else {
      await fetch("/api/bot/rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ configId, ...payload }) });
    }
    setSaving(false);
    onSaved();
  }

  const inp: React.CSSProperties = { width: "100%", background: c.surface, border: `1px solid ${BORDER}`, borderRadius: 9, padding: "11px 14px", color: c.text, boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 600, display: "block", marginBottom: 7, marginTop: 16 };

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{rule.id ? t("تعديل القاعدة", "Edit rule") : t("قاعدة جديدة", "New rule")}</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", color: c.muted, cursor: "pointer" }}><X size={20} /></button>
      </div>

      <label style={lbl}>{t("اسم القاعدة (اختياري)", "Rule name (optional)")}</label>
      <input value={name} onChange={(e) => setName(e.target.value)} style={inp} placeholder={t("استفسار السعر", "Price inquiry")} />

      <label style={lbl}>{t("نوع المطابقة", "Match type")}</label>
      <select value={matchType} onChange={(e) => setMatchType(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
        {MATCH_LABELS(t).map(([v, l]) => <option key={v} value={v} style={{ background: "#0f172a" }}>{l}</option>)}
      </select>

      {matchType !== "catch_all" && (
        <>
          <label style={lbl}>{t("الكلمات المفتاحية (افصل بفاصلة)", "Keywords (comma-separated)")}</label>
          <input value={kwText} onChange={(e) => setKwText(e.target.value)} style={inp} placeholder={t("السعر، بكم، كم سعر، متوفر", "price, how much, available")} />
        </>
      )}

      <label style={lbl}>{t("الرد العلني — سطر لكل نص للتنويع (اختياري)", "Public reply — one text per line for variety (optional)")}</label>
      <textarea value={pubVariants} onChange={(e) => setPubVariants(e.target.value)} rows={3} style={{ ...inp, resize: "vertical" }} placeholder={t("تمّت مراسلتك في الخاص ✅\nراسلناك على الخاص 📩", "We've DMed you ✅\nCheck your inbox 📩")} />

      <label style={lbl}>{t("الرسالة الخاصة (السعر/التفاصيل)", "Private message (price/details)")}</label>
      <textarea value={priv} onChange={(e) => setPriv(e.target.value)} rows={4} style={{ ...inp, resize: "vertical" }} placeholder={t("السعر 250 د.ل، متوفر، للطلب أرسل عنوانك 📦", "Price is 250 LYD, in stock. Send your address to order 📦")} />

      <label style={lbl}>{t("مرفقات (صور/ملفات)", "Attachments (images/files)")}</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        {atts.map((a, i) => (
          <div key={i} style={{ position: "relative" }}>
            {a.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.url} alt="" style={{ width: 60, height: 60, borderRadius: 10, objectFit: "cover", border: `1px solid ${BORDER}` }} />
            ) : (
              <div style={{ width: 60, height: 60, borderRadius: 10, background: c.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: c.muted }}>PDF</div>
            )}
            <button onClick={() => setAtts((x) => x.filter((_, j) => j !== i))}
              style={{ position: "absolute", top: -6, insetInlineEnd: -6, background: "#ef4444", border: "none", borderRadius: "50%", width: 20, height: 20, color: c.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={12} /></button>
          </div>
        ))}
        <label style={{ width: 60, height: 60, borderRadius: 10, border: `1px dashed ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: c.muted }}>
          {uploading ? <Loader2 size={18} className="spin" /> : <Upload size={18} />}
          <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 20 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <Toggle on={enabled} onChange={setEnabled} /> {t("مفعّلة", "Enabled")}
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginInlineStart: "auto" }}>
          {t("الأولوية", "Priority")}
          <input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} style={{ width: 60, ...inp, padding: "8px 10px", textAlign: "center" }} />
        </label>
      </div>

      <button onClick={save} disabled={saving}
        style={{ width: "100%", marginTop: 20, background: `linear-gradient(135deg, ${GREEN}, #16a34a)`, border: "none", borderRadius: 11, padding: "13px 0", color: c.text, fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {saving ? <Loader2 size={17} className="spin" /> : <Save size={17} />} {t("حفظ القاعدة", "Save rule")}
      </button>
    </div>
  );
}

// ── Accounts (rotation pool) tab ─────────────────────────────────────────────
function AccountsTab({ config, patch, flash, t }: { config: Config; patch: (p: Partial<Config>) => Promise<boolean>; flash: (m: string) => void; t: TF }) {
  const { light } = useTheme();
  const c = botColors(light);
  const CARD = c.card;
  const BORDER = c.border;
  const configId = config.id;
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const activeId = config.active_token_id;

  const loadTokens = useCallback(async () => {
    setLoading(true);
    const data = await fetch(`/api/bot/tokens?configId=${configId}`).then((r) => r.json());
    setTokens(data.tokens || []);
    setLoading(false);
  }, [configId]);
  useEffect(() => { loadTokens(); }, [loadTokens]);

  async function makeActive(tk: Token) {
    const ok = await patch({ active_token_id: tk.id });
    if (ok) flash(t("تم اختيار الحساب للرد ✅", "Account set as active ✅"));
  }

  async function toggle(tk: Token) {
    const status = tk.status === "dead" ? "active" : "dead";
    await fetch("/api/bot/tokens", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: tk.id, status }) });
    loadTokens();
  }
  async function remove(id: string) {
    if (!confirm(t("إزالة هذا الحساب من المجموعة؟", "Remove this account from the pool?"))) return;
    await fetch(`/api/bot/tokens?id=${id}`, { method: "DELETE" });
    setTokens((x) => x.filter((tk) => tk.id !== id));
  }

  const statusColor: Record<string, string> = { active: GREEN, cooldown: "#fbbf24", dead: "#94a3b8" };
  const statusLabel = (s: string) => s === "active" ? t("نشط", "Active") : s === "cooldown" ? t("تبريد مؤقت", "Cooling down") : t("موقوف", "Disabled");

  return (
    <div>
      <div style={{ background: `${BLUE}12`, border: `1px solid ${BLUE}33`, borderRadius: 12, padding: "14px 16px", marginBottom: 16, fontSize: 13, color: "#cbd5e1", lineHeight: 1.8 }}>
        {t(
          "اربط عدة حسابات فيسبوك (كلها مشرفة على نفس الصفحة). اختر الحساب الذي يردّ بضغطة واحدة (⭐)، وعند أي حظر مؤقت يبدّل البوت تلقائياً لبقية الحسابات — حماية من إيقاف الحساب عند كثرة التعليقات.",
          "Link several Facebook accounts (all admins of the same Page). Pick which one replies with one tap (⭐); on any temporary block the bot auto-switches to the rest — protection against getting blocked during comment bursts.",
        )}
      </div>

      <button onClick={() => { startPageConnect("/bot") }}
        style={{ width: "100%", background: `linear-gradient(135deg, ${BLUE}, #1565c0)`, border: "none", borderRadius: 12, padding: "13px 0", color: c.text, fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 }}>
        <Plus size={17} /> {t("ربط حساب فيسبوك إضافي", "Link another Facebook account")}
      </button>

      {!loading && tokens.length <= 1 && tokens.length > 0 && (
        <div style={{ fontSize: 12, color: c.muted, marginBottom: 14, textAlign: "center", lineHeight: 1.7 }}>
          {t("لديك حساب واحد (وهو النشط ⭐). اربط حساباً آخر بالزرّ أعلاه، وعندها يظهر زرّ «اجعله النشط» للتبديل بينهما.", "You have one account (it's active ⭐). Link another with the button above, then a “Set active” button appears to switch between them.")}
        </div>
      )}

      {loading ? <div style={{ textAlign: "center", padding: 30, color: c.dim }}><Loader2 size={24} className="spin" /></div>
        : tokens.length === 0 ? (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24, textAlign: "center", color: c.muted, fontSize: 14 }}>
            {t("لا حسابات في المجموعة بعد", "No accounts in the pool yet")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {tokens.map((tk) => {
              const isActive = activeId === tk.id;
              return (
              <div key={tk.id} style={{ background: isActive ? `${GREEN}10` : CARD, border: `1px solid ${isActive ? `${GREEN}55` : BORDER}`, borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: statusColor[tk.status] || "#94a3b8", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 6 }}>
                    {tk.label || t("حساب", "Account")}
                    {isActive && <span style={{ fontSize: 11, color: GREEN, background: `${GREEN}22`, padding: "2px 8px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 3 }}><CheckCircle2 size={11} /> {t("يردّ الآن", "Replying")}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: statusColor[tk.status] || "#94a3b8", marginTop: 3 }}>
                    {statusLabel(tk.status)}{tk.fail_count > 0 ? ` · ${t("إخفاقات", "fails")}: ${tk.fail_count}` : ""}
                  </div>
                </div>
                {!isActive && tk.status !== "dead" && (
                  <button onClick={() => makeActive(tk)} title={t("اجعله الحساب الذي يردّ", "Make this the replying account")}
                    style={{ background: `${GREEN}18`, border: `1px solid ${GREEN}44`, borderRadius: 8, padding: "6px 10px", color: "#86efac", cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                    <Star size={13} /> {t("اجعله النشط", "Set active")}
                  </button>
                )}
                <button onClick={() => toggle(tk)} style={{ background: c.surface, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "6px 12px", color: "#cbd5e1", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                  {tk.status === "dead" ? t("تفعيل", "Enable") : t("إيقاف", "Disable")}
                </button>
                <button onClick={() => remove(tk.id)} style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "6px 8px", color: "#f87171", cursor: "pointer" }}><Trash2 size={14} /></button>
              </div>
              );
            })}
          </div>
        )}
    </div>
  );
}

// ── Posts targeting + per-post replies tab ───────────────────────────────────
function hasOverride(o?: PostOverride): boolean {
  return !!o && ((o.public_replies || []).some((s) => (s || "").trim()) || !!(o.private_reply || "").trim() || (o.attachments || []).length > 0);
}

function PostsTab({ config, pageId, patch, flash, t }: { config: Config; pageId: string; patch: (p: Partial<Config>) => Promise<boolean>; flash: (m: string) => void; t: TF }) {
  const { light } = useTheme();
  const c = botColors(light);
  const CARD = c.card;
  const BORDER = c.border;
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [targeted, setTargeted] = useState(config.post_filter_enabled);
  const [selected, setSelected] = useState<Set<string>>(new Set(config.post_filter || []));
  const [overrides, setOverrides] = useState<Record<string, PostOverride>>(config.post_overrides || {});
  const [editing, setEditing] = useState<Post | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/promo/posts?pageId=${pageId}`).then((r) => r.json()).then((d) => {
      if (d.error) setErr(d.error); else setPosts(d.posts || []);
      setLoading(false);
    }).catch(() => { setErr(t("تعذّر تحميل المنشورات", "Couldn't load posts")); setLoading(false); });
  }, [pageId, t]);

  function toggleSel(id: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async function saveSelection() {
    setSaving(true);
    const ok = await patch({ post_filter: [...selected], post_filter_enabled: targeted });
    setSaving(false);
    if (ok) flash(t("تم حفظ المنشورات المستهدفة ✅", "Saved targeted posts ✅"));
  }

  async function setAll(v: boolean) {
    // v = "reply on ALL posts" → targeting OFF
    setTargeted(!v);
    if (v) { await patch({ post_filter_enabled: false }); flash(t("سيردّ على كل المنشورات", "Will reply on all posts")); }
  }

  // Persist a post's custom reply. Saving one also targets that post so it's honoured
  // even in "specific posts" mode.
  async function saveOverride(post: Post, ov: PostOverride) {
    const next = { ...overrides };
    if (hasOverride(ov)) next[post.id] = ov; else delete next[post.id];
    const nextSel = new Set(selected); if (hasOverride(ov)) nextSel.add(post.id);
    const ok = await patch({ post_overrides: next, post_filter: [...nextSel] });
    if (ok) {
      setOverrides(next); setSelected(nextSel); setEditing(null);
      flash(hasOverride(ov) ? t("تم حفظ ردّ المنشور ✅", "Saved post reply ✅") : t("تم حذف ردّ المنشور", "Post reply removed"));
    }
  }

  const box: React.CSSProperties = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "6px 20px" };

  if (editing) {
    return <PostReplyEditor post={editing} initial={overrides[editing.id]} t={t}
      onClose={() => setEditing(null)} onSave={(ov) => saveOverride(editing, ov)} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={box}>
        <Row label={t("الرد على كل المنشورات", "Reply on all posts")} hint={t("عند الإيقاف، تختار منشورات محدّدة فقط", "When off, pick specific posts only")}>
          <Toggle on={!targeted} onChange={setAll} />
        </Row>
      </div>

      <div style={{ fontSize: 13, color: c.muted, lineHeight: 1.7 }}>
        {targeted
          ? t("اختر المنشورات (المربّع) التي يردّ عليها البوت، واضغط على أي منشور لتخصيص ردّ خاص به.", "Tick the posts the bot replies on, and tap any post to set a custom reply for it.")
          : t("اضغط على أي منشور لتخصيص ردّ خاص به (اختياري).", "Tap any post to give it its own custom reply (optional).")}
        {targeted && selected.size > 0 && <span style={{ color: BLUE, fontWeight: 700 }}> · {selected.size}</span>}
      </div>

      {loading ? <div style={{ textAlign: "center", padding: 30, color: c.dim }}><Loader2 size={24} className="spin" /></div>
        : err ? <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20, textAlign: "center", color: "#f87171", fontSize: 13 }}>{err}</div>
        : posts.length === 0 ? <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24, textAlign: "center", color: c.muted, fontSize: 14 }}>{t("لا منشورات على هذه الصفحة", "No posts on this Page")}</div>
        : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {posts.map((p) => {
              const on = selected.has(p.id);
              const custom = hasOverride(overrides[p.id]);
              return (
                <div key={p.id} onClick={() => setEditing(p)}
                  style={{ background: custom ? `${GREEN}10` : CARD, border: `1px solid ${custom ? `${GREEN}44` : (on ? `${BLUE}55` : BORDER)}`, borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", color: c.text }}>
                  {p.picture ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.picture} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 48, height: 48, borderRadius: 10, background: c.surface, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Newspaper size={20} color="#64748b" /></div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.message || t("(منشور بدون نص)", "(post with no text)")}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: c.dim }}>{new Date(p.createdTime).toLocaleDateString(t("ar-LY", "en-GB"))}</span>
                      {custom && <span style={{ fontSize: 11, color: GREEN, display: "inline-flex", alignItems: "center", gap: 3 }}><MessageSquare size={11} /> {t("ردّ مخصّص", "Custom reply")}</span>}
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setEditing(p); }} title={t("تعديل الرد", "Edit reply")}
                    style={{ background: c.surface, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "7px 9px", color: "#cbd5e1", cursor: "pointer", flexShrink: 0 }}>
                    <Pencil size={14} />
                  </button>
                  {targeted && (
                    <div onClick={(e) => { e.stopPropagation(); toggleSel(p.id); }}
                      style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${on ? BLUE : BORDER}`, background: on ? BLUE : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
                      {on && <CheckCircle2 size={16} color="#fff" />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      {targeted && (
        <button onClick={saveSelection} disabled={saving}
          style={{ background: `linear-gradient(135deg, ${GREEN}, #16a34a)`, border: "none", borderRadius: 11, padding: "12px 0", color: c.text, fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />} {t("حفظ المنشورات المختارة", "Save selected posts")}
        </button>
      )}
    </div>
  );
}

// Editor for a single post's custom public/private reply + attachments.
function PostReplyEditor({ post, initial, t, onClose, onSave }: { post: Post; initial?: PostOverride; t: TF; onClose: () => void; onSave: (ov: PostOverride) => void }) {
  const { light } = useTheme();
  const c = botColors(light);
  const CARD = c.card;
  const BORDER = c.border;
  const [pubVariants, setPubVariants] = useState((initial?.public_replies || []).join("\n"));
  const [priv, setPriv] = useState(initial?.private_reply || "");
  const [atts, setAtts] = useState<Attachment[]>(initial?.attachments || []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/bot/upload", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);
    if (data.url) setAtts((a) => [...a, { type: data.type, url: data.url }]);
  }

  async function save() {
    setSaving(true);
    await onSave({
      public_replies: pubVariants.split("\n").map((s) => s.trim()).filter(Boolean),
      private_reply: priv.trim(),
      attachments: atts,
    });
    setSaving(false);
  }

  const inp: React.CSSProperties = { width: "100%", background: c.surface, border: `1px solid ${BORDER}`, borderRadius: 9, padding: "11px 14px", color: c.text, boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 600, display: "block", marginBottom: 7, marginTop: 16 };

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{t("ردّ خاص بهذا المنشور", "Custom reply for this post")}</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", color: c.muted, cursor: "pointer" }}><X size={20} /></button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, background: c.card, borderRadius: 12, padding: 10, marginTop: 8 }}>
        {post.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.picture} alt="" style={{ width: 44, height: 44, borderRadius: 9, objectFit: "cover" }} />
        ) : <div style={{ width: 44, height: 44, borderRadius: 9, background: c.surface, display: "flex", alignItems: "center", justifyContent: "center" }}><Newspaper size={18} color="#64748b" /></div>}
        <div style={{ fontSize: 12, color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{post.message || t("(منشور بدون نص)", "(post with no text)")}</div>
      </div>

      <div style={{ fontSize: 12, color: c.muted, marginTop: 12, lineHeight: 1.7 }}>
        {t("يُستخدم هذا الردّ لكل تعليق على هذا المنشور تحديداً — ويتقدّم على القواعد العامة.", "This reply is used for every comment on this specific post — and takes priority over the general rules.")}
      </div>

      <label style={lbl}>{t("الرد العلني — سطر لكل نص للتنويع", "Public reply — one text per line for variety")}</label>
      <textarea value={pubVariants} onChange={(e) => setPubVariants(e.target.value)} rows={3} style={{ ...inp, resize: "vertical" }} placeholder={t("تمّت مراسلتك في الخاص ✅\nراسلناك على الخاص 📩", "We've DMed you ✅\nCheck your inbox 📩")} />

      <label style={lbl}>{t("الرسالة الخاصة (السعر/التفاصيل)", "Private message (price/details)")}</label>
      <textarea value={priv} onChange={(e) => setPriv(e.target.value)} rows={4} style={{ ...inp, resize: "vertical" }} placeholder={t("سعر هذا المنتج 250 د.ل، متوفر 📦", "This product is 250 LYD, in stock 📦")} />

      <label style={lbl}>{t("مرفقات (صور المنتج)", "Attachments (product images)")}</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        {atts.map((a, i) => (
          <div key={i} style={{ position: "relative" }}>
            {a.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.url} alt="" style={{ width: 60, height: 60, borderRadius: 10, objectFit: "cover", border: `1px solid ${BORDER}` }} />
            ) : (
              <div style={{ width: 60, height: 60, borderRadius: 10, background: c.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: c.muted }}>PDF</div>
            )}
            <button onClick={() => setAtts((x) => x.filter((_, j) => j !== i))}
              style={{ position: "absolute", top: -6, insetInlineEnd: -6, background: "#ef4444", border: "none", borderRadius: "50%", width: 20, height: 20, color: c.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={12} /></button>
          </div>
        ))}
        <label style={{ width: 60, height: 60, borderRadius: 10, border: `1px dashed ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: c.muted }}>
          {uploading ? <Loader2 size={18} className="spin" /> : <Upload size={18} />}
          <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
      </div>

      <button onClick={save} disabled={saving}
        style={{ width: "100%", marginTop: 20, background: `linear-gradient(135deg, ${GREEN}, #16a34a)`, border: "none", borderRadius: 11, padding: "13px 0", color: c.text, fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {saving ? <Loader2 size={17} className="spin" /> : <Save size={17} />} {t("حفظ ردّ المنشور", "Save post reply")}
      </button>
    </div>
  );
}

// ── Activity tab ─────────────────────────────────────────────────────────────
function ActivityTab({ configId, t }: { configId: string; t: TF }) {
  const { light } = useTheme();
  const c = botColors(light);
  const CARD = c.card;
  const BORDER = c.border;
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [stats, setStats] = useState<{ total: number; public_sent: number; private_sent: number; failed: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/bot/logs?configId=${configId}`).then((r) => r.json()).then((d) => {
      setLogs(d.logs || []); setStats(d.stats || null); setLoading(false);
    });
  }, [configId]);

  const badge = (s: string) => {
    const c = s === "sent" ? GREEN : s === "failed" ? "#ef4444" : "#64748b";
    const l = s === "sent" ? t("أُرسل", "sent") : s === "failed" ? t("فشل", "failed") : t("تخطّي", "skip");
    return <span style={{ fontSize: 11, color: c, background: `${c}18`, padding: "2px 7px", borderRadius: 6 }}>{l}</span>;
  };

  if (loading) return <div style={{ textAlign: "center", padding: 30, color: c.dim }}><Loader2 size={24} className="spin" /></div>;

  return (
    <div>
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
          {[[t("ردود خاصة", "DMs sent"), stats.private_sent, GREEN], [t("ردود علنية", "Public replies"), stats.public_sent, BLUE], [t("إخفاقات", "Failures"), stats.failed, "#ef4444"]].map(([l, v, hue], i) => (
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
                <span style={{ marginInlineStart: "auto", display: "flex", gap: 6 }}>{badge(l.public_status)}{badge(l.private_status)}</span>
              </div>
              <div style={{ fontSize: 13, color: "#cbd5e1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.comment_message || "—"}</div>
              {l.error && <div style={{ fontSize: 11, color: "#f87171", marginTop: 4 }}>{l.error}</div>}
              <div style={{ fontSize: 11, color: c.dim, marginTop: 4 }}>{new Date(l.created_at).toLocaleString(t("ar-LY", "en-GB"))}</div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
