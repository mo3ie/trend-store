"use client";

/**
 * «صفحاتي» — the NEUTRAL place to connect and manage Facebook Pages for every tool.
 * Connecting used to land on /ads/connect (the ads flow, with "next: create an ad"),
 * even when the owner came for the bot or the AI Employee. Here a Page is just a Page:
 * each row offers the three tools, and nothing assumes ads.
 */
import { useEffect, useMemo, useState } from "react";
import { Link2, Plus, Search, Megaphone, MessageCircleReply, Bot, Trash2, CheckCircle2, AlertTriangle, Loader2, XCircle, RefreshCw } from "lucide-react";
import FbHeader, { FbPageHead } from "@/components/fb/FbHeader";
import AdsBottomNav from "@/components/AdsBottomNav";
import { useLang } from "@/hooks/useLang";
import { useTheme } from "@/hooks/useTheme";
import { fbPalette, FB_FONT, fbBtn, fbBtnGhost, G_HERO } from "@/lib/fbTheme";
import { startPageConnect } from "@/lib/connectPage";

type Page = { id: string; page_id: string; page_name: string; page_picture: string | null; platform: string | null; created_at: string };
const SHOW = 20;

export default function MyPagesPage() {
  const { t, rtl, lang } = useLang();
  const { light } = useTheme();
  const c = fbPalette(light);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);
  const [health, setHealth] = useState<Record<string, string>>({});
  const [publishing, setPublishing] = useState<Record<string, boolean | null>>({});
  const [healthMsg, setHealthMsg] = useState("");
  const [checking, setChecking] = useState(false);
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const n = sp.get("connected"), e = sp.get("error"), reason = sp.get("reason") || "";
    if (sp.get("success") === "1") setMsg({ kind: "ok", text: t(`تم ربط الصفحات بنجاح${n ? ` (أعاد فيسبوك ${n} صفحة)` : ""}.`, `Pages connected${n ? ` (Facebook returned ${n})` : ""}.`) });
    else if (e === "cancelled") setMsg({ kind: "err", text: t("أُلغي الربط.", "Connection cancelled.") });
    else if (e === "no_pages") setMsg({ kind: "err", text: t("لم نجد صفحات تديرها في حساب فيسبوك هذا.", "No Pages you manage were found on this Facebook account.") });
    else if (e) {
      const known: [RegExp, string][] = [
        [/authorization code has been used/i, "انتهت صلاحية رابط الربط لأنه استُخدم مرتين. اضغط «ربط صفحة» مرة واحدة وانتظر حتى يكتمل."],
        [/request limit reached|\(#4\)|\(#17\)|\(#32\)/i, "فيسبوك يحدّ الطلبات مؤقتاً. انتظر بضع دقائق ثم أعد المحاولة."],
        [/expired/i, "انتهت صلاحية جلسة فيسبوك. أعد الربط من جديد."],
        [/permission|scope/i, "لم تُمنح كل الصلاحيات المطلوبة. أعد الربط ووافق على جميع الصلاحيات."],
      ];
      const ar = known.find(([re]) => re.test(reason))?.[1];
      setMsg({ kind: "err", text: t(`فشل الربط — ${ar || reason || "حاول مرة أخرى."}`, `Connection failed — ${reason || "try again."}`) });
    }
    if (sp.toString()) window.history.replaceState({}, "", "/facebook/pages");
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/promo/pages", { cache: "no-store" });
    if (r.status === 401) { setNotAuthed(true); setLoading(false); return; }
    const d = await r.json();
    setPages((d.pages || []).filter((p: Page) => !p.platform || p.platform === "meta" || p.platform === "facebook"));
    setLoading(false);
    checkHealth();
  }

  async function checkHealth() {
    setChecking(true);
    try {
      const r = await fetch("/api/promo/pages/health", { cache: "no-store" });
      const d = await r.json();
      if (r.ok) { setHealth(d.statuses || {}); setPublishing(d.publishing || {}); setHealthMsg(d.message || ""); }
    } catch { /* the list works without it */ }
    setChecking(false);
  }

  async function connect() {
    setConnecting(true);
    const err = await startPageConnect("/facebook/pages");
    if (err) { setMsg({ kind: "err", text: err }); setConnecting(false); }
  }

  async function remove(ids: string[], label: string) {
    if (!ids.length) return;
    if (!window.confirm(t(`إلغاء ربط ${label}؟ ستتوقف عليها كل الأدوات (الإعلانات والرد الآلي والموظف الذكي). يمكنك ربطها لاحقاً.`, `Disconnect ${label}? All tools stop on it. You can reconnect later.`))) return;
    setBusy(ids.join(","));
    const r = await fetch(`/api/promo/pages?ids=${encodeURIComponent(ids.join(","))}`, { method: "DELETE" });
    setBusy("");
    if (r.ok) { setPages((ps) => ps.filter((p) => !ids.includes(p.id))); setMsg({ kind: "ok", text: t("تم إلغاء الربط.", "Disconnected.") }); }
    else setMsg({ kind: "err", text: t("تعذّر إلغاء الربط.", "Could not disconnect.") });
  }

  async function openBot(p: Page) {
    setBusy(p.page_id);
    await fetch("/api/bot/configs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pageId: p.page_id }) }).catch(() => {});
    window.location.href = `/bot/${p.page_id}`;
  }

  const filtered = useMemo(() => pages.filter((p) => (p.page_name || "").toLowerCase().includes(q.trim().toLowerCase()) || p.page_id.includes(q.trim())), [pages, q]);
  const shown = all || q ? filtered : filtered.slice(0, SHOW);
  const dead = pages.filter((p) => health[p.page_id] === "dead");
  const noPublish = pages.filter((p) => health[p.page_id] === "alive" && publishing[p.page_id] === false).length;
  const n = (v: number) => v.toLocaleString(lang === "ar" ? "ar-LY" : "en-US");

  const chip = (bg: string, color: string): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 8, background: bg, color, fontSize: 12, fontWeight: 700 });
  const toolBtn = (color: string): React.CSSProperties => ({ height: 38, padding: "0 12px", borderRadius: 10, border: `1px solid ${color}55`, background: `${color}14`, color, fontFamily: FB_FONT, fontSize: 13.5, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" });

  return (
    <div style={{ minHeight: "100vh", background: c.bg, color: c.text, fontFamily: FB_FONT, direction: rtl ? "rtl" : "ltr", paddingBottom: 96 }}>
      <FbHeader active="pages" />
      <FbPageHead
        crumbs={[{ label: t("صفحاتي", "My Pages") }]}
        icon={<Link2 size={24} />}
        title={t("صفحاتي على فيسبوك", "My Facebook Pages")}
        desc={t("صفحاتك المربوطة بأدوات فيسبوك كلها. اختر لكل صفحة الأداة التي تريدها.", "Your Pages, connected to every Facebook tool. Pick the tool you want for each Page.")}
        actions={!notAuthed && (<>
          <button onClick={checkHealth} disabled={checking} style={fbBtnGhost(c)}><RefreshCw size={16} className={checking ? "fbp-spin" : ""} /> {t("فحص الصفحات", "Check Pages")}</button>
          <button onClick={connect} disabled={connecting} style={fbBtn(G_HERO)}>{connecting ? <Loader2 size={16} className="fbp-spin" /> : <Plus size={16} />} {t("ربط صفحة", "Connect a Page")}</button>
        </>)}
      />

      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "16px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        {msg && (
          <div role="status" style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 14, fontSize: 14, fontWeight: 600, background: msg.kind === "ok" ? c.chipGreen : "rgba(239,98,98,.12)", color: msg.kind === "ok" ? c.greenText : "#e05252" }}>
            {msg.kind === "ok" ? <CheckCircle2 size={18} /> : <XCircle size={18} />} {msg.text}
          </div>
        )}
        {healthMsg && <div role="status" style={{ padding: "12px 16px", borderRadius: 14, fontSize: 14, fontWeight: 600, background: c.chipAmber, color: c.amberText }}>{healthMsg}</div>}

        {notAuthed ? (
          <div style={{ background: c.surface, border: `1px dashed ${c.border}`, borderRadius: 18, padding: 28, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <b style={{ fontSize: 17 }}>{t("سجّل الدخول لإدارة صفحاتك.", "Sign in to manage your Pages.")}</b>
            <a href="/login?next=/facebook/pages" style={fbBtn(G_HERO)}>{t("تسجيل الدخول", "Sign in")}</a>
          </div>
        ) : loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 50 }}><Loader2 size={30} className="fbp-spin" color="#438DF5" /></div>
        ) : pages.length === 0 ? (
          <div style={{ background: c.surface, border: `1px dashed ${c.border}`, borderRadius: 18, padding: 32, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <span style={{ width: 58, height: 58, borderRadius: 16, background: c.chipBlue, display: "grid", placeItems: "center" }}><Link2 size={26} color="#438DF5" /></span>
            <b style={{ fontSize: 18 }}>{t("لم تربط أي صفحة بعد.", "No Pages connected yet.")}</b>
            <p style={{ margin: 0, color: c.muted, fontSize: 14.5, maxWidth: 460 }}>{t("تسجيل دخول فيسبوك الرسمي. نطلب صلاحيات صفحاتك فقط، ويمكنك إلغاؤها في أي وقت. الصفحة الواحدة تعمل مع الأدوات الثلاث.", "Official Facebook login. We only ask for your Pages' permissions — revoke anytime. One Page works with all three tools.")}</p>
            <button onClick={connect} disabled={connecting} style={fbBtn(G_HERO)}><Plus size={16} /> {t("ربط صفحة فيسبوك", "Connect a Facebook Page")}</button>
          </div>
        ) : (
          <>
            {/* summary + search */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <span style={chip(c.chipBlue, c.blueText)}>{t(`${n(pages.length)} صفحة مربوطة`, `${pages.length} Pages connected`)}</span>
              {dead.length > 0 && <span style={chip("rgba(239,98,98,.12)", "#e05252")}><AlertTriangle size={13} /> {t(`${n(dead.length)} فقدت الصلاحية`, `${dead.length} lost access`)}</span>}
              {noPublish > 0 && <span style={chip(c.chipAmber, c.amberText)}>{t(`${n(noPublish)} تحتاج إعادة ربط للنشر`, `${noPublish} need reconnecting to publish`)}</span>}
              {dead.length > 0 && (
                <button onClick={() => remove(dead.map((p) => p.id), t(`${n(dead.length)} صفحة فقدت الصلاحية`, `${dead.length} Pages that lost access`))} style={{ ...fbBtnGhost(c), height: 34, fontSize: 13, marginInlineStart: "auto" }}>
                  <Trash2 size={14} /> {t("إزالة الصفحات التي فقدت الصلاحية", "Remove Pages that lost access")}
                </button>
              )}
            </div>
            <label style={{ position: "relative", display: "block" }}>
              <span className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{t("ابحث عن صفحة", "Search Pages")}</span>
              <Search size={16} color={c.dim} style={{ position: "absolute", insetInlineStart: 14, top: "50%", transform: "translateY(-50%)" }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("ابحث باسم الصفحة أو رقمها…", "Search by Page name or ID…")}
                style={{ width: "100%", boxSizing: "border-box", height: 46, borderRadius: 12, border: `1px solid ${c.border}`, background: c.surface, color: c.text, paddingInlineStart: 40, paddingInlineEnd: 14, fontSize: 14.5, fontFamily: FB_FONT }} />
            </label>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {shown.map((p) => {
                const st = health[p.page_id];
                const pub = publishing[p.page_id];
                return (
                  <div key={p.id} style={{ background: c.surface, border: `1px solid ${st === "dead" ? "rgba(239,98,98,.45)" : c.border}`, borderRadius: 16, padding: "14px 16px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "1 1 260px", minWidth: 0 }}>
                      {p.page_picture
                        ? <img src={p.page_picture} alt="" style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover", flex: "none" }} /> // eslint-disable-line @next/next/no-img-element
                        : <span style={{ width: 46, height: 46, borderRadius: "50%", background: c.chipBlue, display: "grid", placeItems: "center", flex: "none", fontWeight: 700 }}>{(p.page_name || "؟").slice(0, 1)}</span>}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.page_name}</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 3 }}>
                          <span dir="ltr" style={{ fontSize: 12, color: c.dim }}>ID: {p.page_id}</span>
                          {st === "alive" && <span style={chip(c.chipGreen, c.greenText)}><CheckCircle2 size={12} /> {pub === false ? t("تعمل — النشر يحتاج إعادة ربط", "Works — publishing needs reconnect") : t("تعمل", "Working")}</span>}
                          {st === "dead" && <span style={chip("rgba(239,98,98,.12)", "#e05252")}><AlertTriangle size={12} /> {t("فقدت الصلاحية — أعد الربط", "Lost access — reconnect")}</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <a href={`/ads/create?page=${encodeURIComponent(p.page_id)}`} style={toolBtn("#438DF5")}><Megaphone size={15} /> {t("إعلان", "Ad")}</a>
                      <button onClick={() => openBot(p)} disabled={busy === p.page_id} style={toolBtn("#20BE83")}>{busy === p.page_id ? <Loader2 size={15} className="fbp-spin" /> : <MessageCircleReply size={15} />} {t("الرد الآلي", "Auto-Reply")}</button>
                      <a href={`/studio?page=${encodeURIComponent(p.page_id)}`} style={toolBtn("#9367ED")}><Bot size={15} /> {t("الموظف الذكي", "AI Employee")}</a>
                      <button onClick={() => remove([p.id], `«${p.page_name}»`)} disabled={busy === p.id} aria-label={t(`إلغاء ربط ${p.page_name}`, `Disconnect ${p.page_name}`)} title={t("إلغاء الربط", "Disconnect")}
                        style={{ height: 38, width: 38, borderRadius: 10, border: "1px solid rgba(239,98,98,.35)", background: "rgba(239,98,98,.08)", color: "#e05252", cursor: "pointer", display: "grid", placeItems: "center" }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {!all && !q && filtered.length > SHOW && (
              <button onClick={() => setAll(true)} style={{ ...fbBtnGhost(c), width: "100%", borderStyle: "dashed", color: "#438DF5" }}>
                {t(`إظهار كل الصفحات (${n(filtered.length)})`, `Show all Pages (${filtered.length})`)}
              </button>
            )}
          </>
        )}
      </main>
      <style>{`@keyframes fbpspin{to{transform:rotate(360deg)}}.fbp-spin{animation:fbpspin 1s linear infinite}`}</style>
      <AdsBottomNav />
    </div>
  );
}
