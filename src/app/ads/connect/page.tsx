"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Globe, CheckCircle, XCircle, Trash2, Plus, ArrowLeft, ArrowRight, Loader2, Search, CheckSquare, Square } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import LangToggle from "@/components/LangToggle";

const GRADIENT = "linear-gradient(135deg, #0f0f1a 0%, #0d1b2a 100%)";
const BLUE     = "#1877f2";
const CARD_BG  = "rgba(255,255,255,0.04)";

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
  const Back = rtl ? ArrowLeft : ArrowRight;
  const [pages, setPages]     = useState<ConnectedPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch]   = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

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
    if (data.url) {
      window.location.href = data.url;
    } else {
      setError(data.error || t("حدث خطأ", "Something went wrong"));
      setConnecting(false);
    }
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
    <div style={{ minHeight: "100vh", background: GRADIENT, color: "#fff", fontFamily: "Cairo, sans-serif", direction: rtl ? "rtl" : "ltr", padding: "0 0 80px" }}>

      <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.push("/ads")} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Back size={18} /> {t("رجوع", "Back")}
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{t("ربط صفحة فيسبوك", "Connect a Facebook Page")}</h1>
        <div style={{ marginInlineStart: "auto" }}><LangToggle /></div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px" }}>

        {success && (
          <div style={{ background: "rgba(34,197,94,0.15)", border: "1px solid #22c55e40", borderRadius: 12, padding: "14px 18px", marginBottom: 24, display: "flex", alignItems: "center", gap: 10, color: "#86efac" }}>
            <CheckCircle size={18} /> {success}
          </div>
        )}
        {error && (
          <div style={{ background: "rgba(239,68,68,0.15)", border: "1px solid #ef444440", borderRadius: 12, padding: "14px 18px", marginBottom: 24, display: "flex", alignItems: "center", gap: 10, color: "#fca5a5" }}>
            <XCircle size={18} /> {error}
          </div>
        )}

        {/* Connect button */}
        <div style={{ background: CARD_BG, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 28, marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <div style={{ width: 50, height: 50, borderRadius: 14, background: `${BLUE}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Globe size={26} color={BLUE} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{t("ربط عبر Meta", "Connect via Meta")}</div>
              <div style={{ color: "#94a3b8", fontSize: 13 }}>{t("صلاحيات رسمية — آمن ومحمي", "Official permissions — safe and secure")}</div>
            </div>
          </div>
          <ul style={{ margin: "0 0 20px", padding: "0 18px", color: "#94a3b8", fontSize: 13, lineHeight: 2.2 }}>
            <li>{t("نطلب فقط صلاحيات إدارة الإعلانات لصفحاتك", "We only request ad-management permissions for your Pages")}</li>
            <li>{t("لا نطلع على كلمة مرورك أو رسائلك الخاصة", "We never see your password or private messages")}</li>
            <li>{t("يمكنك إلغاء الربط في أي وقت", "You can disconnect at any time")}</li>
          </ul>
          <button onClick={connectMeta} disabled={connecting}
            style={{ width: "100%", background: `linear-gradient(135deg, ${BLUE}, #1565c0)`, border: "none", borderRadius: 12, padding: "14px 0", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: connecting ? 0.7 : 1 }}>
            {connecting ? <Loader2 size={18} className="spin" /> : <Plus size={18} />}
            {connecting ? t("جارٍ الاتصال...", "Connecting...") : t("ربط صفحة جديدة", "Connect a new Page")}
          </button>
        </div>

        {/* Pages list */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#cbd5e1" }}>
            {t("الصفحات المرتبطة", "Connected Pages")} ({pages.length})
          </h2>
          {selected.size > 0 && (
            <button onClick={deleteSelected} disabled={deleting}
              style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 10, padding: "8px 14px", color: "#fca5a5", cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              {deleting ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
              {t(`حذف المحدد (${selected.size})`, `Delete selected (${selected.size})`)}
            </button>
          )}
        </div>

        {pages.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search size={15} color="#64748b" style={{ position: "absolute", insetInlineStart: 12, top: "50%", transform: "translateY(-50%)" }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={t("ابحث في صفحاتك...", "Search your Pages...")}
                style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 14px", paddingInlineStart: 36, color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            </div>
            <button onClick={toggleSelectAll}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 14px", color: "#94a3b8", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
              {allFilteredSelected ? <CheckSquare size={15} color={BLUE} /> : <Square size={15} />}
              {t("تحديد الكل", "Select all")}
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>
            <Loader2 size={28} className="spin" />
          </div>
        ) : pages.length === 0 ? (
          <div style={{ background: CARD_BG, border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 32, textAlign: "center", color: "#64748b" }}>
            {t("لم تربط أي صفحة بعد — اضغط الزر أعلاه للبدء", "No Pages connected yet — tap the button above to start")}
          </div>
        ) : filteredPages.length === 0 ? (
          <div style={{ background: CARD_BG, border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 24, textAlign: "center", color: "#64748b" }}>
            {t("لا توجد صفحات مطابقة للبحث", "No Pages match your search")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filteredPages.map((page) => {
              const isSel = selected.has(page.id);
              return (
              <div key={page.id} onClick={() => toggleSelect(page.id)}
                style={{ background: isSel ? `${BLUE}18` : CARD_BG, border: `1px solid ${isSel ? `${BLUE}55` : "rgba(255,255,255,0.08)"}`, borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
                {isSel ? <CheckSquare size={20} color={BLUE} style={{ flexShrink: 0 }} /> : <Square size={20} color="#64748b" style={{ flexShrink: 0 }} />}
                {page.page_picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={page.page_picture} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: `${BLUE}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Globe size={20} color={BLUE} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{page.page_name}</div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>ID: {page.page_id}</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); deletePage(page.id); }}
                  style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "6px 10px", color: "#f87171", cursor: "pointer", flexShrink: 0 }}>
                  <Trash2 size={14} />
                </button>
              </div>
              );
            })}
          </div>
        )}

        {pages.length > 0 && (
          <button onClick={() => router.push("/ads/create")}
            style={{ marginTop: 32, width: "100%", background: `linear-gradient(135deg, ${BLUE}, #6b46c1)`, border: "none", borderRadius: 14, padding: "16px 0", color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer" }}>
            {t("التالي — إنشاء حملة إعلانية", "Next — create a campaign")}
          </button>
        )}
      </div>

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
