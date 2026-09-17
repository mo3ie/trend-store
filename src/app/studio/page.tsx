"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Loader2, Store, Package, CalendarDays, Plus, Trash2, X,
  Image as ImageIcon, Save, CheckCircle, Sparkles, ChevronDown, Bot,
} from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useTheme } from "@/hooks/useTheme";
import LangToggle from "@/components/LangToggle";
import AdsBottomNav from "@/components/AdsBottomNav";

const G_HERO = "linear-gradient(140deg,#6d28d9 0%,#d6409f 55%,#ff7a59 100%)";
const PINK    = "#d6409f";
const PINK_BG = "rgba(214,64,159,0.12)";

interface Page { id: string; page_id: string; page_name: string; }
interface Product { id: string; category?: string; name: string; price_text?: string; description?: string; images?: string[]; active?: boolean; available?: boolean; }
interface Brand {
  brand_name?: string; phones?: string[]; addresses?: string[]; links?: string[];
  hours?: string; tone?: string; logo_url?: string; extra?: string;
}

// Module-scope so inputs keep focus across re-renders (an inline component would remount).
function Field({ label, muted, children }: { label: string; muted: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 12.5, color: muted, display: "block", marginBottom: 6, fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  );
}

export default function StudioPage() {
  const router = useRouter();
  const { t, rtl } = useLang();
  const { light } = useTheme();
  const Back = rtl ? ArrowLeft : ArrowRight;

  const c = light ? {
    bg: "#fbf7ff", text: "#1e1330", muted: "#6b5b78", dim: "#8b7d97",
    surface: "#ffffff", border: "rgba(120,60,160,0.14)", inputBg: "#f4eefb", menuBg: "#ffffff",
  } : {
    bg: "#100a18", text: "#f6eefb", muted: "#a394b0", dim: "#7a6d88",
    surface: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.10)", inputBg: "rgba(255,255,255,0.06)", menuBg: "#1a1226",
  };
  const input: React.CSSProperties = {
    width: "100%", minWidth: 0, background: c.inputBg, border: `1px solid ${c.border}`,
    borderRadius: 11, padding: "11px 13px", color: c.text, fontSize: 14, outline: "none",
    boxSizing: "border-box", fontFamily: "inherit",
  };
  const card: React.CSSProperties = { background: c.surface, border: `2px solid ${c.border}`, borderRadius: 18, padding: 20 };
  const pagePic = (id: string) => `https://graph.facebook.com/${id}/picture?type=square&width=80&height=80`;

  const [pages, setPages] = useState<Page[]>([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [pageMenu, setPageMenu] = useState(false);
  const [loadingPages, setLoadingPages] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);
  const [tab, setTab] = useState<"brand" | "catalog" | "plan">("brand");

  // Brand
  const [brand, setBrand] = useState<Brand>({});
  const [phonesText, setPhonesText] = useState("");     // raw multiline (fixes Enter/newline)
  const [addressesText, setAddressesText] = useState("");
  const [linksText, setLinksText] = useState("");
  const [savingBrand, setSavingBrand] = useState(false);
  const [brandSaved, setBrandSaved] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Catalog
  const [products, setProducts] = useState<Product[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string>("");
  const [draft, setDraft] = useState<Omit<Product, "id">>({ name: "", available: true });
  const [savingProd, setSavingProd] = useState(false);
  const [prodAdded, setProdAdded] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  // Bulk quick-add
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");
  const [savingBulk, setSavingBulk] = useState(false);

  // Plan controls (generation lands next batch)
  const [postsPerDay, setPostsPerDay] = useState(3);
  const [durationDays, setDurationDays] = useState(7);

  useEffect(() => {
    fetch("/api/promo/pages").then((r) => {
      if (r.status === 401) { setNotAuthed(true); setLoadingPages(false); return null; }
      return r.json();
    }).then((d) => {
      if (!d) return;
      const p = d.pages || [];
      setPages(p);
      if (p.length > 0) setSelectedPage(p[0].page_id);
      setLoadingPages(false);
    }).catch(() => setLoadingPages(false));
  }, []);

  useEffect(() => {
    if (!selectedPage) return;
    fetch(`/api/studio/brand?pageId=${encodeURIComponent(selectedPage)}`).then((r) => r.json()).then((d) => {
      const br = d.brand || {};
      setBrand(br);
      setPhonesText((br.phones || []).join("\n"));
      setAddressesText((br.addresses || []).join("\n"));
      setLinksText((br.links || []).join("\n"));
    }).catch(() => setBrand({}));
    fetch(`/api/studio/products?pageId=${encodeURIComponent(selectedPage)}`).then((r) => r.json()).then((d) => setProducts(d.products || [])).catch(() => setProducts([]));
  }, [selectedPage]);

  async function uploadImage(file: File): Promise<string | null> {
    const fd = new FormData(); fd.append("file", file);
    const r = await fetch("/api/promo/upload", { method: "POST", body: fd });
    const d = await r.json();
    return r.ok && d.url ? d.url : null;
  }

  const fromLines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

  async function saveBrand() {
    setSavingBrand(true); setBrandSaved(false);
    const body = { pageId: selectedPage, ...brand, phones: fromLines(phonesText), addresses: fromLines(addressesText), links: fromLines(linksText) };
    const r = await fetch("/api/studio/brand", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSavingBrand(false);
    if (r.ok) { setBrandSaved(true); setTimeout(() => setBrandSaved(false), 2500); }
  }

  function openAdd() { setEditingId(""); setDraft({ name: "", available: true }); setProdAdded(false); setShowAdd(true); }
  function openEdit(p: Product) { setEditingId(p.id); setDraft({ name: p.name, category: p.category, price_text: p.price_text, description: p.description, images: p.images || [], available: p.available !== false }); setProdAdded(false); setShowAdd(true); }

  async function saveProduct(keepOpen: boolean) {
    if (!draft.name.trim()) return;
    setSavingProd(true);
    if (editingId) {
      const r = await fetch("/api/studio/products", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingId, ...draft }) });
      const d = await r.json();
      setSavingProd(false);
      if (r.ok && d.product) { setProducts(products.map((p) => (p.id === editingId ? d.product : p))); setShowAdd(false); }
      return;
    }
    const r = await fetch("/api/studio/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pageId: selectedPage, ...draft }) });
    const d = await r.json();
    setSavingProd(false);
    if (r.ok && d.product) {
      setProducts((cur) => [d.product, ...cur]);
      if (keepOpen) { setDraft({ name: "", available: true }); setProdAdded(true); setTimeout(() => setProdAdded(false), 1800); }
      else setShowAdd(false);
    }
  }

  async function addBulk() {
    const items = fromLines(bulkText).map((line) => {
      // "name - price" or "name" (Arabic dash or hyphen)
      const m = line.split(/\s[-–—]\s|\s-\s/);
      const name = (m[0] || line).trim();
      const price_text = m.length > 1 ? line.slice(name.length).replace(/^[\s-–—]+/, "").trim() : undefined;
      return { name, price_text, category: bulkCategory.trim() || undefined };
    }).filter((x) => x.name);
    if (items.length === 0) return;
    setSavingBulk(true);
    const r = await fetch("/api/studio/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pageId: selectedPage, items }) });
    const d = await r.json();
    setSavingBulk(false);
    if (r.ok && d.products) { setProducts([...(d.products as Product[]), ...products]); setShowBulk(false); setBulkText(""); setBulkCategory(""); }
  }

  async function deleteProduct(id: string) {
    if (!confirm(t("حذف هذا الصنف؟", "Delete this item?"))) return;
    await fetch(`/api/studio/products?id=${id}`, { method: "DELETE" });
    setProducts(products.filter((p) => p.id !== id));
  }

  async function toggleAvailable(p: Product) {
    const next = !(p.available !== false);
    setProducts(products.map((x) => (x.id === p.id ? { ...x, available: next } : x)));
    await fetch("/api/studio/products", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, available: next }) });
  }

  if (loadingPages) {
    return <div style={{ minHeight: "100vh", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 size={30} color={PINK} className="spin" /><style>{`@keyframes spin-anim{to{transform:rotate(360deg)}}.spin{animation:spin-anim 1s linear infinite}`}</style></div>;
  }

  if (notAuthed) {
    return (
      <div style={{ minHeight: "100vh", background: c.bg, color: c.text, fontFamily: "Cairo,sans-serif", direction: rtl ? "rtl" : "ltr", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ ...card, textAlign: "center", maxWidth: 380 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: G_HERO, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}><Bot size={26} color="#fff" /></div>
          <div style={{ fontWeight: 900, fontSize: 17, marginBottom: 8 }}>{t("لم تسجّل الدخول", "You're not logged in")}</div>
          <p style={{ color: c.muted, fontSize: 13.5, lineHeight: 1.8, margin: "0 0 18px" }}>{t("سجّل الدخول لاستخدام الموظف الذكي لإدارة محتوى صفحتك.", "Sign in to use the AI Employee to manage your Page content.")}</p>
          <button onClick={() => router.push(`/login?next=${encodeURIComponent("/studio")}`)} style={{ width: "100%", background: G_HERO, border: "none", borderRadius: 14, padding: "13px 0", color: "#fff", fontWeight: 900, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>{t("تسجيل الدخول", "Sign in")}</button>
        </div>
      </div>
    );
  }

  const selPage = pages.find((p) => p.page_id === selectedPage);
  const tabs = [
    { id: "brand" as const,   icon: Store,        label: t("بيانات المتجر", "Store info") },
    { id: "catalog" as const, icon: Package,      label: t("الأصناف", "Catalog") },
    { id: "plan" as const,    icon: CalendarDays, label: t("خطة النشر", "Content plan") },
  ];

  return (
    <div style={{ minHeight: "100vh", background: c.bg, color: c.text, fontFamily: "Cairo,sans-serif", direction: rtl ? "rtl" : "ltr", paddingBottom: 90, overflowX: "hidden", transition: "background .2s,color .2s" }}>
      {/* Header */}
      <div style={{ padding: "16px 18px", maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.push("/facebook")} style={{ background: "none", border: "none", color: c.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}><Back size={18} /> {t("رجوع", "Back")}</button>
          <div style={{ marginInlineStart: "auto" }}><LangToggle /></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: G_HERO, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Bot size={24} color="#fff" /></div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>{t("الموظف الذكي", "AI Employee")}</h1>
            <div style={{ fontSize: 12.5, color: c.muted }}>{t("ينشر لك يوميّاً كموظف تسويق حقيقي", "Posts daily for you like a real marketing employee")}</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "8px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
        {pages.length === 0 ? (
          <div style={{ ...card, textAlign: "center", padding: 34 }}>
            <p style={{ color: c.muted, fontSize: 14, marginBottom: 18 }}>{t("اربط صفحة فيسبوك أولاً ليعمل الموظف الذكي عليها.", "Connect a Facebook Page first for the AI Employee to work on.")}</p>
            <button onClick={() => router.push("/ads/connect")} style={{ background: G_HERO, border: "none", borderRadius: 13, padding: "12px 26px", color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>{t("ربط صفحة", "Connect a Page")}</button>
          </div>
        ) : (
          <>
            {/* Page selector */}
            <div style={{ position: "relative" }}>
              <button type="button" onClick={() => setPageMenu((o) => !o)} style={{ ...input, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, cursor: "pointer", textAlign: rtl ? "right" : "left" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 9, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                  {selPage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pagePic(selPage.page_id)} alt="" style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, objectFit: "cover" }} />
                  )}
                  {selPage ? selPage.page_name : t("اختر صفحة", "Choose a Page")}
                </span>
                <ChevronDown size={16} color={c.dim} style={{ flexShrink: 0, transform: pageMenu ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
              </button>
              {pageMenu && (
                <div style={{ position: "absolute", insetInline: 0, top: "calc(100% + 6px)", zIndex: 30, background: c.menuBg, border: `1px solid ${c.border}`, borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.28)", maxHeight: 300, overflowY: "auto" }}>
                  {pages.map((p) => (
                    <button key={p.id} type="button" onClick={() => { setSelectedPage(p.page_id); setPageMenu(false); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: p.page_id === selectedPage ? PINK_BG : "transparent", border: "none", cursor: "pointer", color: p.page_id === selectedPage ? PINK : c.text, textAlign: rtl ? "right" : "left", fontSize: 14, fontFamily: "inherit" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={pagePic(p.page_id)} alt="" style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, objectFit: "cover" }} />
                      <span style={{ flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{p.page_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 6, background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: 13, padding: 5 }}>
              {tabs.map((tb) => (
                <button key={tb.id} onClick={() => setTab(tb.id)} style={{ flex: 1, border: "none", cursor: "pointer", borderRadius: 9, padding: "9px 0", fontFamily: "inherit", fontWeight: 800, fontSize: 12.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: tab === tb.id ? G_HERO : "transparent", color: tab === tb.id ? "#fff" : c.muted }}>
                  <tb.icon size={15} /> {tb.label}
                </button>
              ))}
            </div>

            {/* BRAND TAB */}
            {tab === "brand" && (
              <div style={card}>
                <p style={{ color: c.dim, fontSize: 12.5, margin: "0 0 16px", lineHeight: 1.7 }}>
                  {t("أخبر الموظف عن متجرك — يستعمل هذه البيانات في كتابة المنشورات والردود.", "Tell the employee about your store — it uses this to write your posts and replies.")}
                </p>
                {/* Logo */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                  {brand.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={brand.logo_url} alt="" style={{ width: 60, height: 60, borderRadius: 14, objectFit: "cover", border: `1px solid ${c.border}` }} />
                  ) : (
                    <div style={{ width: 60, height: 60, borderRadius: 14, background: c.inputBg, border: `1px dashed ${c.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}><ImageIcon size={22} color={c.dim} /></div>
                  )}
                  <div>
                    <label style={{ fontSize: 13, color: PINK, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {uploadingLogo ? <Loader2 size={14} className="spin" /> : <ImageIcon size={14} />} {t("شعار المتجر", "Store logo")}
                      <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setUploadingLogo(true); const u = await uploadImage(f); setUploadingLogo(false); if (u) setBrand({ ...brand, logo_url: u }); e.target.value = ""; }} />
                    </label>
                    <div style={{ fontSize: 11, color: c.dim, marginTop: 3, lineHeight: 1.5 }}>{t("يُستخدم على تصاميم المنشورات فقط — لا يغيّر شعار صفحتك في فيسبوك.", "Used on post designs only — it does NOT change your Facebook Page logo.")}</div>
                  </div>
                </div>
                <Field muted={c.muted} label={t("اسم المتجر", "Store name")}><input style={input} value={brand.brand_name || ""} onChange={(e) => setBrand({ ...brand, brand_name: e.target.value })} placeholder={t("مثال: متجر لمسة أنوثة", "e.g. Lamsa Beauty")} /></Field>
                <Field muted={c.muted} label={t("نبرة العلامة / وصف المتجر", "Brand voice / description")}><textarea rows={2} style={{ ...input, resize: "vertical" }} value={brand.tone || ""} onChange={(e) => setBrand({ ...brand, tone: e.target.value })} placeholder={t("مثال: متجر مستلزمات زينة نسائية راقٍ، لهجة ودودة وأنيقة", "e.g. Elegant women's beauty shop, warm & classy tone")} /></Field>
                <Field muted={c.muted} label={t("أرقام الهاتف (رقم في كل سطر)", "Phone numbers (one per line)")}><textarea rows={3} style={{ ...input, resize: "vertical" }} value={phonesText} onChange={(e) => setPhonesText(e.target.value)} placeholder={"091xxxxxxx\n092xxxxxxx"} /></Field>
                <Field muted={c.muted} label={t("العناوين (عنوان في كل سطر)", "Addresses (one per line)")}><textarea rows={3} style={{ ...input, resize: "vertical" }} value={addressesText} onChange={(e) => setAddressesText(e.target.value)} placeholder={t("طرابلس - شارع...", "Tripoli - ...")} /></Field>
                <Field muted={c.muted} label={t("روابط (صفحات/موقع، رابط في كل سطر)", "Links (pages/site, one per line)")}><textarea rows={3} style={{ ...input, resize: "vertical" }} value={linksText} onChange={(e) => setLinksText(e.target.value)} placeholder={"https://facebook.com/...\nhttps://instagram.com/..."} /></Field>
                <Field muted={c.muted} label={t("أوقات العمل", "Working hours")}><input style={input} value={brand.hours || ""} onChange={(e) => setBrand({ ...brand, hours: e.target.value })} placeholder={t("يومياً 10ص - 11م", "Daily 10am - 11pm")} /></Field>
                <Field muted={c.muted} label={t("معلومات إضافية (اختياري)", "Extra info (optional)")}><textarea rows={2} style={{ ...input, resize: "vertical" }} value={brand.extra || ""} onChange={(e) => setBrand({ ...brand, extra: e.target.value })} placeholder={t("توصيل، عروض دائمة، إلخ", "Delivery, standing offers, etc.")} /></Field>

                <button onClick={saveBrand} disabled={savingBrand} style={{ width: "100%", marginTop: 8, background: brandSaved ? "#22c55e" : G_HERO, border: "none", borderRadius: 13, padding: "13px 0", color: "#fff", fontWeight: 900, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit" }}>
                  {savingBrand ? <Loader2 size={17} className="spin" /> : brandSaved ? <CheckCircle size={17} /> : <Save size={17} />}
                  {brandSaved ? t("تم الحفظ", "Saved") : t("حفظ بيانات المتجر", "Save store info")}
                </button>
              </div>
            )}

            {/* CATALOG TAB */}
            {tab === "catalog" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{t(`الأصناف (${products.length})`, `Catalog (${products.length})`)}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { setBulkText(""); setBulkCategory(""); setShowBulk(true); }} style={{ background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: 11, padding: "9px 13px", color: c.text, fontWeight: 800, cursor: "pointer", fontSize: 12.5, display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}><Sparkles size={14} color={PINK} /> {t("قائمة سريعة", "Quick list")}</button>
                    <button onClick={openAdd} style={{ background: G_HERO, border: "none", borderRadius: 11, padding: "9px 15px", color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}><Plus size={15} /> {t("إضافة صنف", "Add item")}</button>
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: c.dim, lineHeight: 1.6, marginTop: -4 }}>
                  {t("الصور اختيارية ومرجعية فقط — الموظف يصمّم صوراً جديدة لكل منشور ويعيد نشر الأصناف بصيغ وصور مختلفة.", "Images are optional references only — the employee designs fresh visuals for each post and re-posts items with new formats.")}
                </div>
                {products.length === 0 ? (
                  <div style={{ ...card, textAlign: "center", color: c.muted, fontSize: 13.5, padding: 30 }}>{t("لا أصناف بعد. أضف منتجاتك (عطور، مكياج…) — أو الصق قائمة أسماء سريعة.", "No items yet. Add your products (perfumes, makeup…) — or paste a quick name list.")}</div>
                ) : products.map((p) => {
                  const avail = p.available !== false;
                  return (
                  <div key={p.id} style={{ ...card, padding: 14, display: "flex", gap: 12, alignItems: "center", opacity: avail ? 1 : 0.65 }}>
                    {p.images && p.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0]} alt="" style={{ width: 52, height: 52, borderRadius: 11, objectFit: "cover", flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 52, height: 52, borderRadius: 11, background: c.inputBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Package size={20} color={c.dim} /></div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: c.dim, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{[p.category, p.price_text].filter(Boolean).join(" · ") || t("بدون سعر", "no price")}</div>
                    </div>
                    {/* availability toggle */}
                    <button onClick={() => toggleAvailable(p)} title={avail ? t("متوفر", "In stock") : t("غير متوفر", "Out of stock")}
                      style={{ background: avail ? "rgba(34,197,94,0.14)" : "rgba(154,164,178,0.15)", border: `1px solid ${avail ? "#22c55e55" : c.border}`, borderRadius: 100, padding: "5px 11px", color: avail ? "#22c55e" : c.muted, cursor: "pointer", fontSize: 11, fontWeight: 800, flexShrink: 0, fontFamily: "inherit" }}>
                      {avail ? t("متوفر", "In") : t("نافد", "Out")}
                    </button>
                    <button onClick={() => openEdit(p)} style={{ background: PINK_BG, border: `1px solid ${PINK}44`, borderRadius: 9, padding: "7px 9px", color: PINK, cursor: "pointer", flexShrink: 0 }}><Save size={13} /></button>
                    <button onClick={() => deleteProduct(p.id)} style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 9, padding: "7px 9px", color: "#ef4444", cursor: "pointer", flexShrink: 0 }}><Trash2 size={14} /></button>
                  </div>
                  );
                })}
              </div>
            )}

            {/* PLAN TAB (generation lands next) */}
            {tab === "plan" && (
              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 15, marginBottom: 6 }}><Sparkles size={17} color={PINK} /> {t("خطة النشر الأسبوعية", "Weekly content plan")}</div>
                <p style={{ color: c.dim, fontSize: 12.5, margin: "0 0 16px", lineHeight: 1.7 }}>{t("حدّد كم منشوراً يومياً وكم يوماً، وسيصمّم الموظف خطة كاملة (نصوص + صور) تراجعها وتوافق عليها.", "Set posts per day and how many days; the employee will draft a full plan (captions + images) for you to review & approve.")}</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field muted={c.muted} label={t("منشورات يومياً", "Posts per day")}><input type="number" min={1} max={10} style={input} value={postsPerDay} onChange={(e) => setPostsPerDay(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} /></Field>
                  <Field muted={c.muted} label={t("عدد الأيام", "Number of days")}><input type="number" min={1} max={30} style={input} value={durationDays} onChange={(e) => setDurationDays(Math.max(1, Math.min(30, Number(e.target.value) || 7)))} /></Field>
                </div>
                <div style={{ background: PINK_BG, border: `1px solid ${PINK}44`, borderRadius: 12, padding: 14, fontSize: 12.5, color: c.muted, lineHeight: 1.7, marginTop: 6 }}>
                  {t(`سيصمّم الموظف ${postsPerDay * durationDays} منشوراً على مدى ${durationDays} أيام.`, `The employee will design ${postsPerDay * durationDays} posts over ${durationDays} days.`)}
                </div>
                <button disabled style={{ width: "100%", marginTop: 14, background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: 13, padding: "13px 0", color: c.dim, fontWeight: 800, fontSize: 14, cursor: "not-allowed", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Sparkles size={16} /> {t("توليد الخطة — قريباً جداً", "Generate plan — coming very soon")}
                </button>
                <p style={{ fontSize: 11.5, color: c.dim, textAlign: "center", marginTop: 8 }}>{t("أكمل بيانات المتجر والأصناف أولاً؛ توليد الخطة بالذكاء في الدفعة القادمة.", "Fill store info & catalog first; AI plan generation ships in the next batch.")}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add product modal */}
      {showAdd && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12, direction: rtl ? "rtl" : "ltr" }}>
          <div style={{ background: c.bg, color: c.text, width: "100%", maxWidth: 480, borderRadius: 22, padding: 20, fontFamily: "Cairo,sans-serif", maxHeight: "88vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>{editingId ? t("تعديل الصنف", "Edit item") : t("صنف جديد", "New item")}</div>
              <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", color: c.muted, cursor: "pointer" }}><X size={20} /></button>
            </div>
            <Field muted={c.muted} label={t("اسم الصنف", "Item name")}><input autoFocus style={input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={t("مثال: عطر فلورا", "e.g. Flora perfume")} /></Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field muted={c.muted} label={t("القسم", "Category")}><input style={input} value={draft.category || ""} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder={t("عطور", "Perfumes")} /></Field>
              <Field muted={c.muted} label={t("السعر", "Price")}><input style={input} value={draft.price_text || ""} onChange={(e) => setDraft({ ...draft, price_text: e.target.value })} placeholder={t("50 د.ل", "50 LYD")} /></Field>
            </div>
            {/* Availability */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {([[true, t("متوفر", "In stock")], [false, t("غير متوفر", "Out of stock")]] as const).map(([v, lbl]) => {
                const on = (draft.available !== false) === v;
                return (
                  <button key={String(v)} type="button" onClick={() => setDraft({ ...draft, available: v })}
                    style={{ flex: 1, padding: "10px 0", borderRadius: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 13,
                      border: on ? `2px solid ${v ? "#22c55e" : "#ef4444"}` : `1px solid ${c.border}`,
                      background: on ? (v ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.1)") : "transparent",
                      color: on ? (v ? "#22c55e" : "#ef4444") : c.muted }}>{lbl}</button>
                );
              })}
            </div>
            <Field muted={c.muted} label={t("وصف (اختياري)", "Description (optional)")}><textarea rows={2} style={{ ...input, resize: "vertical" }} value={draft.description || ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
            <Field muted={c.muted} label={t("صور مرجعية (اختياري)", "Reference images (optional)")}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(draft.images || []).map((u, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover", border: `1px solid ${c.border}` }} />
                    <button onClick={() => setDraft({ ...draft, images: (draft.images || []).filter((_, j) => j !== i) })} style={{ position: "absolute", top: -6, insetInlineEnd: -6, background: "#ef4444", border: "none", borderRadius: "50%", width: 20, height: 20, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={12} /></button>
                  </div>
                ))}
                <label style={{ width: 64, height: 64, borderRadius: 10, border: `1.5px dashed ${c.border}`, background: c.inputBg, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  {uploadingImg ? <Loader2 size={18} className="spin" color={c.dim} /> : <Plus size={20} color={c.dim} />}
                  <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setUploadingImg(true); const u = await uploadImage(f); setUploadingImg(false); if (u) setDraft((d) => ({ ...d, images: [...(d.images || []), u] })); e.target.value = ""; }} />
                </label>
              </div>
            </Field>
            {prodAdded && <div style={{ textAlign: "center", color: "#22c55e", fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>✓ {t("تمت الإضافة — أضف التالي", "Added — add the next")}</div>}
            {editingId ? (
              <button onClick={() => saveProduct(false)} disabled={savingProd || !draft.name.trim()} style={{ width: "100%", marginTop: 6, background: G_HERO, border: "none", borderRadius: 13, padding: "13px 0", color: "#fff", fontWeight: 900, fontSize: 15, cursor: "pointer", opacity: savingProd || !draft.name.trim() ? 0.6 : 1, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {savingProd ? <Loader2 size={17} className="spin" /> : <Save size={17} />} {t("حفظ التعديل", "Save changes")}
              </button>
            ) : (
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button onClick={() => saveProduct(true)} disabled={savingProd || !draft.name.trim()} style={{ flex: 1, background: G_HERO, border: "none", borderRadius: 13, padding: "13px 0", color: "#fff", fontWeight: 900, fontSize: 14, cursor: "pointer", opacity: savingProd || !draft.name.trim() ? 0.6 : 1, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                  {savingProd ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} {t("إضافة والتالي", "Add & next")}
                </button>
                <button onClick={() => saveProduct(false)} disabled={savingProd || !draft.name.trim()} style={{ background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: 13, padding: "13px 18px", color: c.text, fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: savingProd || !draft.name.trim() ? 0.6 : 1, fontFamily: "inherit", whiteSpace: "nowrap" }}>
                  {t("إضافة وإغلاق", "Add & close")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bulk quick-add modal */}
      {showBulk && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowBulk(false); }} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12, direction: rtl ? "rtl" : "ltr" }}>
          <div style={{ background: c.bg, color: c.text, width: "100%", maxWidth: 480, borderRadius: 22, padding: 20, fontFamily: "Cairo,sans-serif", maxHeight: "88vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>{t("قائمة سريعة بالأصناف", "Quick item list")}</div>
              <button onClick={() => setShowBulk(false)} style={{ background: "none", border: "none", color: c.muted, cursor: "pointer" }}><X size={20} /></button>
            </div>
            <p style={{ color: c.dim, fontSize: 12, lineHeight: 1.7, margin: "0 0 12px" }}>
              {t("ضع كل صنف في سطر. يمكنك كتابة الاسم فقط، أو «الاسم - السعر». والموظف الذكي يصنّف كل اسم لاحقاً.", "One item per line. Just the name, or “name - price”. The AI employee classifies each name later.")}
            </p>
            <Field muted={c.muted} label={t("القسم لكل هذه القائمة (اختياري)", "Category for this whole list (optional)")}>
              <input style={input} value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)} placeholder={t("مثال: عطور", "e.g. Perfumes")} />
            </Field>
            <Field muted={c.muted} label={t("الأصناف", "Items")}>
              <textarea rows={8} style={{ ...input, resize: "vertical", lineHeight: 1.9 }} value={bulkText} onChange={(e) => setBulkText(e.target.value)}
                placeholder={t("عطر فلورا - 120 د.ل\nمسكارا لوريال - 45 د.ل\nأحمر شفاه مات", "Flora perfume - 120\nLoreal mascara - 45\nMatte lipstick")} />
            </Field>
            <div style={{ fontSize: 11.5, color: c.dim, marginBottom: 10 }}>{t(`${fromLines(bulkText).length} صنف`, `${fromLines(bulkText).length} items`)}</div>
            <button onClick={addBulk} disabled={savingBulk || fromLines(bulkText).length === 0} style={{ width: "100%", background: G_HERO, border: "none", borderRadius: 13, padding: "13px 0", color: "#fff", fontWeight: 900, fontSize: 15, cursor: "pointer", opacity: savingBulk || fromLines(bulkText).length === 0 ? 0.6 : 1, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {savingBulk ? <Loader2 size={17} className="spin" /> : <Plus size={17} />} {t("إضافة القائمة", "Add list")}
            </button>
          </div>
        </div>
      )}

      <AdsBottomNav />
      <style>{`@keyframes spin-anim{to{transform:rotate(360deg)}}.spin{animation:spin-anim 1s linear infinite}`}</style>
    </div>
  );
}
