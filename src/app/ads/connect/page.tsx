"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Globe, CheckCircle, XCircle, Trash2, Plus, ArrowLeft, Loader2 } from "lucide-react";

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
  const [pages, setPages]     = useState<ConnectedPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const s = searchParams.get("success");
    const e = searchParams.get("error");
    if (s === "1") setSuccess("تم ربط الصفحات بنجاح!");
    if (e === "cancelled")    setError("تم إلغاء الربط");
    if (e === "no_pages")     setError("لم نجد صفحات متاحة في حسابك");
    if (e === "oauth_failed") setError("فشل الربط — تأكد من صلاحيات التطبيق");
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
      setError(data.error || "حدث خطأ");
      setConnecting(false);
    }
  }

  async function deletePage(id: string) {
    if (!confirm("هل تريد إلغاء ربط هذه الصفحة؟")) return;
    await fetch(`/api/promo/pages?id=${id}`, { method: "DELETE" });
    setPages((p) => p.filter((x) => x.id !== id));
  }

  return (
    <div style={{ minHeight: "100vh", background: GRADIENT, color: "#fff", fontFamily: "Cairo, sans-serif", direction: "rtl", padding: "0 0 80px" }}>

      <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.push("/ads")} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <ArrowLeft size={18} /> رجوع
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>ربط صفحة فيسبوك</h1>
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
              <div style={{ fontWeight: 700, fontSize: 16 }}>ربط عبر Meta</div>
              <div style={{ color: "#94a3b8", fontSize: 13 }}>صلاحيات رسمية — آمن ومحمي</div>
            </div>
          </div>
          <ul style={{ margin: "0 0 20px", padding: "0 18px", color: "#94a3b8", fontSize: 13, lineHeight: 2.2 }}>
            <li>نطلب فقط صلاحيات إدارة الإعلانات لصفحاتك</li>
            <li>لا نطلع على كلمة مرورك أو رسائلك الخاصة</li>
            <li>يمكنك إلغاء الربط في أي وقت</li>
          </ul>
          <button onClick={connectMeta} disabled={connecting}
            style={{ width: "100%", background: `linear-gradient(135deg, ${BLUE}, #1565c0)`, border: "none", borderRadius: 12, padding: "14px 0", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: connecting ? 0.7 : 1 }}>
            {connecting ? <Loader2 size={18} className="spin" /> : <Plus size={18} />}
            {connecting ? "جارٍ الاتصال..." : "ربط صفحة جديدة"}
          </button>
        </div>

        {/* Pages list */}
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: "#cbd5e1" }}>
          الصفحات المرتبطة ({pages.length})
        </h2>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>
            <Loader2 size={28} className="spin" />
          </div>
        ) : pages.length === 0 ? (
          <div style={{ background: CARD_BG, border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 32, textAlign: "center", color: "#64748b" }}>
            لم تربط أي صفحة بعد — اضغط الزر أعلاه للبدء
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {pages.map((page) => (
              <div key={page.id} style={{ background: CARD_BG, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
                {page.page_picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={page.page_picture} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: `${BLUE}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Globe size={20} color={BLUE} />
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{page.page_name}</div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>ID: {page.page_id}</div>
                </div>
                <CheckCircle size={18} color="#22c55e" />
                <button onClick={() => deletePage(page.id)}
                  style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "6px 10px", color: "#f87171", cursor: "pointer" }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {pages.length > 0 && (
          <button onClick={() => router.push("/ads/create")}
            style={{ marginTop: 32, width: "100%", background: `linear-gradient(135deg, ${BLUE}, #6b46c1)`, border: "none", borderRadius: 14, padding: "16px 0", color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer" }}>
            التالي — إنشاء حملة إعلانية
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
