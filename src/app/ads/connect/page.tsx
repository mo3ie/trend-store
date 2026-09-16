"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Globe, CheckCircle, XCircle, Trash2, Plus, ArrowLeft, ArrowRight, Loader2, Search, CheckSquare, Square } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useTheme } from "@/hooks/useTheme";
import LangToggle from "@/components/LangToggle";
import AdsBottomNav from "@/components/AdsBottomNav";

const G_HERO = "linear-gradient(140deg,#6d28d9 0%,#d6409f 55%,#ff7a59 100%)";
const G_META = "linear-gradient(135deg,#3b82f6,#22d3ee)";
const PINK    = "#d6409f";

interface ConnectedPage {
  id:           string;
  page_id:      string;
  page_name:    string;
  page_picture?: string;
}

function ConnectPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { t, rtl } = useLang();
  const { light } = useTheme();
  const Back = rtl ? ArrowLeft : ArrowRight;

  const c = light ? {
    bg: "#fbf7ff", text: "#1e1330", muted: "#6b5b78", dim: "#8b7d97",
    surface: "#ffffff", border: "rgba(120,60,160,0.14)", inputBg: "#f4eefb",
  } : {
    bg: "#100a18", text: "#f6eefb", muted: "#a394b0", dim: "#7a6d88",
    surface: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.10)", inputBg: "rgba(255,255,255,0.06)",
  };

  const [pages, setPages]     = useState<ConnectedPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch]   = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const s = searchParams.get("success");
    const e = searchParams.get("error");
    if (s === "1") setSuccess(t("تم ربط الصفحات بنجاح!", "Pages connected successfully!"));
    if (e === "cancelled")    setError(t("تم إلغاء الربط", "Connection cancelled"));
    if (e === "no_pages")     setError(t("لم نجد صفحات متاحة في حسابك", "No available Pages found in your account"));
    if (e === "oauth_failed") {
      const reason = searchParams.get("reason");
      setError(t(
        `فشل الربط${reason ? ` — ${reason}` : " — تأكد من صلاحيات التطبيق"}`,
        `Connection failed${reason ? ` — ${reason}` : " — check the app permissions"}`,
      ));
    }
    loadPages();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPages() {
    setLoading(true);
    const res  = await fetch("/api/promo/pages");
    const data = await res.json();
    setPages(data.pages || []);
    setLoading(false);
  }

  async function connectMeta() {
    setConnecting(true);
    setError("");
    const res  = await fetch("/api/promo/pages/connect");
    const data = await res.json();
    if (data.url) { window.location.href = data.url; }
    else { setError(data.error || t("حدث خطأ", "Something went wrong")); setConnecting(false); }
  }

  async function deletePage(id: string) {
    if (!confirm(t("هل تريد إلغاء ربط هذه الصفحة؟", "Disconnect this Page?"))) return;
    await fetch(`/api/promo/pages?id=${id}`, { method: "DELETE" });
    setPages((p) => p.filter((x) => x.id !== id));
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
  }

  function toggleSelect(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(t(`إلغاء ربط ${selected.size} صفحة؟`, `Disconnect ${selected.size} Page(s)?`))) return;
    setDeleting(true);
    const ids = Array.from(selected);
    await fetch(`/api/promo/pages?ids=${ids.join(",")}`, { method: "DELETE" });
    setPages((p) => p.filter((x) => !selected.has(x.id)));
    setSelected(new Set());
    setDeleting(false);
  }

  const filteredPages = pages.filter((p) => {
    const q = search.trim().toLowerCase();
    return !q || p.page_name.toLowerCase().includes(q) || p.page_id.includes(q);
  });
  const allFilteredSelected = filteredPages.length > 0 && filteredPages.every((p) => selected.has(p.id));
  function toggleSelectAll() {
    setSelected((s) => {
      const n = new Set(s);
      if (allFilteredSelected) filteredPages.forEach((p) => n.delete(p.id));
      else filteredPages.forEach((p) => n.add(p.id));
      return n;
    });
  }

  return (
    <div style={{ minHeight: "100vh", background: c.bg, color: c.text, fontFamily: "Cairo, sans-serif", direction: rtl ? "rtl" : "ltr", padding: "0 0 80px", overflowX: "hidden", transition: "background .2s,color .2s" }}>

      <div style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 12, maxWidth: 680, margin: "0 auto" }}>
        <button onClick={() => router.push("/ads")} style={{ background: "none", border: "none", color: c.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
          <Back size={18} /> {t("رجوع", "Back")}
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>{t("ربط صفحة فيسبوك", "Connect a Facebook Page")}</h1>
        <div style={{ marginInlineStart: "auto" }}><LangToggle /></div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "22px 20px" }}>

        {success && (
          <div style={{ background: "rgba(34,197,94,0.15)", border: "1px solid #22c55e55", borderRadius: 14, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10, color: "#22c55e" }}>
            <CheckCircle size={18} /> {success}
          </div>
        )}
        {error && (
          <div style={{ background: "rgba(239,68,68,0.15)", border: "1px solid #ef444455", borderRadius: 14, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10, color: "#ef4444" }}>
            <XCircle size={18} /> {error}
          </div>
        )}

        {/* Connect button */}
        <div style={{ background: c.surface, border: `2px solid ${c.border}`, borderRadius: 20, padding: 24, marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
            <div style={{ width: 50, height: 50, borderRadius: 15, background: G_META, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Globe size={26} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{t("ربط عبر Meta", "Connect via Meta")}</div>
              <div style={{ color: c.muted, fontSize: 13 }}>{t("صلاحيات رسمية — آمن ومحمي", "Official permissions — safe and secure")}</div>
            </div>
          </div>
          <ul style={{ margin: "0 0 18px", padding: "0 18px", color: c.muted, fontSize: 13, lineHeight: 2.1 }}>
            <li>{t("نطلب فقط صلاحيات إدارة الإعلانات لصفحاتك", "We only request ad-management permissions for your Pages")}</li>
            <li>{t("لا نطلع على كلمة مرورك أو رسائلك الخاصة", "We never see your password or private messages")}</li>
            <li>{t("يمكنك إلغاء الربط في أي وقت", "You can disconnect at any time")}</li>
          </ul>
          <button onClick={connectMeta} disabled={connecting}
            style={{ width: "100%", background: G_HERO, border: "none", borderRadius: 13, padding: "14px 0", color: "#fff", fontWeight: 900, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: connecting ? 0.7 : 1, fontFamily: "inherit" }}>
            {connecting ? <Loader2 size={18} className="spin" /> : <Plus size={18} />}
            {connecting ? t("جارٍ الاتصال...", "Connecting...") : t("ربط صفحة جديدة", "Connect a new Page")}
          </button>
        </div>

        {/* Pages list header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: c.text }}>
            {t("الصفحات المرتبطة", "Connected Pages")} ({pages.length})
          </h2>
          {selected.size > 0 && (
            <button onClick={deleteSelected} disabled={deleting}
              style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 10, padding: "8px 14px", color: "#ef4444", cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}>
              {deleting ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
              {t(`حذف المحدد (${selected.size})`, `Delete selected (${selected.size})`)}
            </button>
          )}
        </div>

        {pages.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search size={15} color={c.dim} style={{ position: "absolute", insetInlineStart: 12, top: "50%", transform: "translateY(-50%)" }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={t("ابحث في صفحاتك...", "Search your Pages...")}
                style={{ width: "100%", background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: 11, padding: "11px 14px", paddingInlineStart: 36, color: c.text, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
            </div>
            <button onClick={toggleSelectAll}
              style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 11, padding: "11px 14px", color: c.muted, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", fontFamily: "inherit" }}>
              {allFilteredSelected ? <CheckSquare size={15} color={PINK} /> : <Square size={15} />}
              {t("تحديد الكل", "Select all")}
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: c.dim }}><Loader2 size={28} className="spin" /></div>
        ) : pages.length === 0 ? (
          <div style={{ background: c.surface, border: `2px solid ${c.border}`, borderRadius: 16, padding: 32, textAlign: "center", color: c.muted }}>
            {t("لم تربط أي صفحة بعد — اضغط الزر أعلاه للبدء", "No Pages connected yet — tap the button above to start")}
          </div>
        ) : filteredPages.length === 0 ? (
          <div style={{ background: c.surface, border: `2px solid ${c.border}`, borderRadius: 16, padding: 24, textAlign: "center", color: c.muted }}>
            {t("لا توجد صفحات مطابقة للبحث", "No Pages match your search")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {(showAll ? filteredPages : filteredPages.slice(0, 8)).map((page) => {
              const isSel = selected.has(page.id);
              return (
              <div key={page.id} onClick={() => toggleSelect(page.id)}
                style={{ background: isSel ? "rgba(214,64,159,0.08)" : c.surface, border: `2px solid ${isSel ? `${PINK}88` : c.border}`, borderRadius: 15, padding: "15px 18px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
                {isSel ? <CheckSquare size={20} color={PINK} style={{ flexShrink: 0 }} /> : <Square size={20} color={c.dim} style={{ flexShrink: 0 }} />}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://graph.facebook.com/${page.page_id}/picture?type=square&width=88&height=88`} alt=""
                  style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", background: G_META, flexShrink: 0 }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{page.page_name}</div>
                  <div style={{ color: c.dim, fontSize: 12 }}>ID: {page.page_id}</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); deletePage(page.id); }}
                  style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 9, padding: "6px 10px", color: "#ef4444", cursor: "pointer", flexShrink: 0 }}>
                  <Trash2 size={14} />
                </button>
              </div>
              );
            })}
            {!showAll && filteredPages.length > 8 && (
              <button onClick={() => setShowAll(true)}
                style={{ width: "100%", background: c.surface, border: `1px dashed ${c.border}`, borderRadius: 12, padding: "11px 0", color: PINK, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                {t(`إظهار كل الصفحات (${filteredPages.length})`, `Show all pages (${filteredPages.length})`)}
              </button>
            )}
          </div>
        )}

        {pages.length > 0 && (
          <button onClick={() => router.push("/ads/create")}
            style={{ marginTop: 30, width: "100%", background: G_HERO, border: "none", borderRadius: 15, padding: "16px 0", color: "#fff", fontWeight: 900, fontSize: 16, cursor: "pointer", fontFamily: "inherit" }}>
            {t("التالي — إنشاء حملة إعلانية", "Next — create a campaign")}
          </button>
        )}
      </div>

      <AdsBottomNav />
      <style>{`@keyframes spin-anim { to { transform: rotate(360deg); } } .spin { animation: spin-anim 1s linear infinite; }`}</style>
    </div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense>
      <ConnectPageInner />
    </Suspense>
  );
}
