"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Loader2, Store, Package, CalendarDays, Plus, Trash2, X,
  Image as ImageIcon, Save, CheckCircle, Sparkles, ChevronDown, Bot,
  Copy, RefreshCw, Clock, Pencil, Search, CheckSquare, Square, CircleCheck, CircleX,
  Brain, Globe, DollarSign, Bell, AlertTriangle, AlertCircle, MessageSquareReply, ThumbsUp, Upload,
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
// Ready-made post-idea types the owner can pick from before generating.
const POST_IDEAS: [string, string][] = [
  ["تسليط الضوء على منتج", "Product highlight"],
  ["عرض خاص / خصم", "Special offer / discount"],
  ["باقة توفير", "Savings bundle"],
  ["نصيحة أو معلومة", "Tip / how-to"],
  ["سؤال وتفاعل", "Question / engagement"],
  ["وصل حديثاً", "New arrival"],
  ["الأكثر مبيعاً", "Best seller"],
  ["شهادة عميل", "Customer testimonial"],
  ["خلف الكواليس", "Behind the scenes"],
  ["مناسبة أو موسم", "Seasonal / occasion"],
  ["تذكير بالعنوان وأوقات العمل", "Location & hours reminder"],
  ["مقارنة بين منتجات", "Product comparison"],
  ["تشكيلة جديدة", "New collection"],
  ["نمط حياة", "Lifestyle"],
];

interface Plan { id: string; posts_per_day: number; duration_days: number; start_date?: string; status: string; summary?: string; }
interface ReplyConfig { enabled?: boolean; public_replies?: string[]; private_reply?: string; like?: boolean }
interface PlanPost {
  id: string; scheduled_for?: string; caption?: string; hashtags?: string; cta?: string;
  post_type?: string; image_url?: string; image_source?: string; image_prompt?: string; status?: string;
  boost?: boolean; boost_budget_usd?: number | null; boost_days?: number | null;
  reply_config?: ReplyConfig | null;
  video_url?: string | null;
  boost_targeting?: Targeting | null; boost_targeting_note?: string | null;
}
interface Targeting {
  ageMin?: number; ageMax?: number; gender?: string;
  cities?: { key: string; name: string }[]; interests?: { id: string; name: string }[];
  citiesFromOwner?: boolean; budgetUsd?: number; days?: number;
}
interface BotInfo { hasConfig: boolean; enabled: boolean; subscribed: boolean; aiEnabled: boolean; likeComments: boolean; activeTokenId: string | null; configId: string | null; tokens: { id: string; label: string }[] }

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
  const [pageSearch, setPageSearch] = useState("");
  const [loadingPages, setLoadingPages] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);
  const [tab, setTab] = useState<"brand" | "catalog" | "plan" | "alerts">("brand");
  const [alerts, setAlerts] = useState<{ id: string; severity: string; area: string; title: string; detail?: string; at?: string }[]>([]);
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null);

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
  // Multi-select for the catalog
  const [selectMode, setSelectMode] = useState(false);
  const [selectedProds, setSelectedProds] = useState<Set<string>>(new Set());

  // Plan
  const [postsPerDay, setPostsPerDay] = useState(3);
  const [durationDays, setDurationDays] = useState(7);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planPosts, setPlanPosts] = useState<PlanPost[]>([]);
  const [generating, setGenerating] = useState(false);
  const [planErr, setPlanErr] = useState("");
  const [selectedIdeas, setSelectedIdeas] = useState<Set<string>>(new Set());
  const [guidance, setGuidance] = useState("");
  // Plan post multi-select
  const [postSelectMode, setPostSelectMode] = useState(false);
  const [selectedPlanPosts, setSelectedPlanPosts] = useState<Set<string>>(new Set());
  // Bulk boost
  const [showBulkBoost, setShowBulkBoost] = useState(false);
  const [bbBudget, setBbBudget] = useState("5");
  const [bbDays, setBbDays] = useState("3");
  const [savingBoost, setSavingBoost] = useState(false);
  const [approving, setApproving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState("");
  const [editPost, setEditPost] = useState<PlanPost | null>(null);
  const [savingPost, setSavingPost] = useState(false);
  const [copiedId, setCopiedId] = useState("");
  // Employee "brain" / style memory
  const [brainStyle, setBrainStyle] = useState("");
  const [brainNotes, setBrainNotes] = useState("");
  const [showBrain, setShowBrain] = useState(false);
  const [savingBrain, setSavingBrain] = useState(false);
  const [brainSaved, setBrainSaved] = useState(false);
  // Web image search (in edit modal)
  const [showImgSearch, setShowImgSearch] = useState(false);
  const [imgQuery, setImgQuery] = useState("");
  const [imgResults, setImgResults] = useState<{ url: string; thumb: string; source?: string }[]>([]);
  const [imgPage, setImgPage] = useState(1);
  const [imgMore, setImgMore] = useState(false);
  const [imgTranslated, setImgTranslated] = useState("");
  // Catalog file import (every plan) + AI photo editing / video (top plan).
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [editImgPrompt, setEditImgPrompt] = useState("");
  const [editingImg, setEditingImg] = useState(false);
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoState, setVideoState] = useState<"" | "pending" | "done" | "failed">("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoMsg, setVideoMsg] = useState("");
  // Monthly allowance for the paid ("strong") AI.
  const [quota, setQuota] = useState<{
    unlimited: boolean; periodEnd: string;
    pack: { price_lyd: number; images: number; videos: number; available: boolean };
    images: { limit: number; used: number; extra: number; left: number };
    videos: { limit: number; used: number; extra: number; left: number };
  } | null>(null);
  const [topupQty, setTopupQty] = useState(1);
  const [upgrading, setUpgrading] = useState(false);
  const [quotaMsg, setQuotaMsg] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [targeting, setTargeting] = useState(false);
  const [targetCities, setTargetCities] = useState("");
  const [targetMsg, setTargetMsg] = useState("");
  const [imgSearching, setImgSearching] = useState(false);
  const [imgErr, setImgErr] = useState("");

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
    fetch(`/api/studio/plan?pageId=${encodeURIComponent(selectedPage)}`).then((r) => r.json()).then((d) => {
      setPlan(d.plan || null); setPlanPosts(d.posts || []);
      if (d.plan) { setPostsPerDay(d.plan.posts_per_day); setDurationDays(d.plan.duration_days); }
    }).catch(() => { setPlan(null); setPlanPosts([]); });
    fetch(`/api/studio/memory?pageId=${encodeURIComponent(selectedPage)}`).then((r) => r.json()).then((d) => {
      setBrainStyle(d.memory?.style || ""); setBrainNotes(d.memory?.notes || "");
    }).catch(() => {});
    fetch(`/api/studio/alerts?pageId=${encodeURIComponent(selectedPage)}`).then((r) => r.json()).then((d) => setAlerts(d.alerts || [])).catch(() => setAlerts([]));
    fetch(`/api/studio/bot-info?pageId=${encodeURIComponent(selectedPage)}`).then((r) => r.json()).then((d) => setBotInfo(d)).catch(() => setBotInfo(null));
    loadQuota();
  }, [selectedPage]);

  async function setActiveToken(tokenId: string) {
    setBotInfo((b) => (b ? { ...b, activeTokenId: tokenId } : b));
    await fetch("/api/studio/bot-info", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pageId: selectedPage, action: "set_token", tokenId }) });
  }

  async function saveBrain() {
    setSavingBrain(true); setBrainSaved(false);
    const r = await fetch("/api/studio/memory", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pageId: selectedPage, style: brainStyle, notes: brainNotes }) });
    setSavingBrain(false);
    if (r.ok) { setBrainSaved(true); setTimeout(() => setBrainSaved(false), 2200); }
  }

  // page 1 replaces the grid; later pages append, so "load more" keeps what is shown.
  async function searchImages(q: string, page = 1) {
    setImgErr(""); setImgSearching(true);
    if (page === 1) { setImgResults([]); setImgTranslated(""); }
    try {
      const r = await fetch(`/api/studio/images/search?q=${encodeURIComponent(q)}&page=${page}`);
      const d = await r.json();
      if (!r.ok) setImgErr(d.message || t("بحث الصور غير متاح", "Image search unavailable"));
      else {
        setImgResults((prev) => {
          const merged = page === 1 ? (d.images || []) : [...prev, ...(d.images || [])];
          const seen = new Set<string>();
          return merged.filter((x: { url: string }) => (seen.has(x.url) ? false : (seen.add(x.url), true)));
        });
        setImgPage(page);
        setImgMore(Boolean(d.hasMore));
        if (d.translated) setImgTranslated(String(d.translated));
      }
    } catch { setImgErr(t("تعذّر البحث", "Search failed")); }
    setImgSearching(false);
  }

  // Bulk catalog import from a CSV / text file — available on every plan.
  async function importCatalog(file: File, replace: boolean) {
    if (!selectedPage) return;
    setImporting(true); setImportMsg("");
    const fd = new FormData();
    fd.append("file", file); fd.append("pageId", selectedPage); fd.append("replace", String(replace));
    try {
      const r = await fetch("/api/studio/products/import", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) setImportMsg(d.message || d.error || t("تعذّر الاستيراد", "Import failed"));
      else {
        setImportMsg(t(`تم استيراد ${d.imported} منتج`, `Imported ${d.imported} products`));
        const pr = await fetch(`/api/studio/products?pageId=${encodeURIComponent(selectedPage)}`).then((x) => x.json()).catch(() => null);
        if (pr) setProducts(pr.products || []);
      }
    } catch { setImportMsg(t("تعذّر الاستيراد", "Import failed")); }
    setImporting(false);
  }

  // Redraw the post's current image from an instruction, keeping the real product.
  async function aiEditImage() {
    const src = editPost?.image_url;
    if (!src || !editImgPrompt.trim()) return;
    setEditingImg(true); setImgErr("");
    try {
      const r = await fetch("/api/studio/images/edit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: src, prompt: editImgPrompt.trim(), pageId: selectedPage }),
      });
      const d = await r.json();
      if (!r.ok) setImgErr(d.message || t("تعذّر التعديل", "Edit failed"));
      else { await savePost({ image_url: d.url, image_source: "ai_edit" }); setEditImgPrompt(""); }
    } catch { setImgErr(t("تعذّر التعديل", "Edit failed")); }
    setEditingImg(false);
  }

  // Video is queued and takes minutes, so submit then poll until it resolves.
  async function makeVideo() {
    if (!videoPrompt.trim()) return;
    setVideoState("pending"); setVideoMsg(""); setVideoUrl("");
    try {
      const r = await fetch("/api/studio/video", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: videoPrompt.trim(), imageUrl: editPost?.image_url, pageId: selectedPage }),
      });
      const d = await r.json();
      if (!r.ok) { setVideoState("failed"); setVideoMsg(d.message || t("تعذّر التوليد", "Generation failed")); return; }
      const id = d.requestId as string;
      for (let i = 0; i < 60; i++) {                       // ~5 min ceiling
        await new Promise((res) => setTimeout(res, 5000));
        const sr = await fetch(`/api/studio/video?requestId=${encodeURIComponent(id)}&pageId=${selectedPage}`);
        const sd = await sr.json();
        if (sd.state === "done") { setVideoState("done"); setVideoUrl(sd.url); loadQuota(); return; }
        if (sd.state === "failed") { setVideoState("failed"); setVideoMsg(sd.message || "failed"); loadQuota(); return; }
      }
      setVideoState("failed"); setVideoMsg(t("استغرق وقتاً أطول من المتوقع", "Timed out"));
    } catch { setVideoState("failed"); setVideoMsg(t("تعذّر التوليد", "Generation failed")); }
  }

  async function loadQuota() {
    const d = await fetch("/api/studio/quota").then((r) => r.json()).catch(() => null);
    if (d && !d.error) setQuota(d.quota);
  }

  // Spend part of the month's allowance on the posts the owner actually picked.
  async function upgradeSelected() {
    if (selectedPlanPosts.size === 0) return;
    setUpgrading(true); setQuotaMsg("");
    try {
      const r = await fetch("/api/studio/plan/upgrade-images", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postIds: [...selectedPlanPosts] }),
      });
      const d = await r.json();
      if (!r.ok) setQuotaMsg(d.message || t("تعذّرت الترقية", "Upgrade failed"));
      else {
        setQuota(d.quota);
        setQuotaMsg(t(
          `تم تحسين ${d.upgraded} صورة${d.skipped ? ` — ${d.skipped} تجاوزت حصة الشهر` : ""}`,
          `Upgraded ${d.upgraded}${d.skipped ? ` — ${d.skipped} beyond this month's allowance` : ""}`));
        setSelectedPlanPosts(new Set());
        const pl = await fetch(`/api/studio/plan?pageId=${encodeURIComponent(selectedPage)}`).then((x) => x.json()).catch(() => null);
        if (pl?.posts) setPlanPosts(pl.posts);
      }
    } catch { setQuotaMsg(t("تعذّرت الترقية", "Upgrade failed")); }
    setUpgrading(false);
  }

  // The owner's own clip, straight from their device — no AI, no allowance spent.
  async function uploadVideo(file: File) {
    setUploadingVideo(true);
    const fd = new FormData(); fd.append("file", file);
    try {
      const r = await fetch("/api/studio/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) setImgErr(d.error || t("تعذّر رفع الفيديو", "Video upload failed"));
      else await savePost({ video_url: d.url });
    } catch { setImgErr(t("تعذّر رفع الفيديو", "Video upload failed")); }
    setUploadingVideo(false);
  }

  // Let the AI read the post and decide the audience. Cities typed by the owner win.
  async function autoTarget() {
    if (!editPost) return;
    setTargeting(true); setTargetMsg("");
    const cities = targetCities.split(",").map((x) => x.trim()).filter(Boolean);
    try {
      const r = await fetch("/api/studio/plan/targeting", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: editPost.id, cities }),
      });
      const d = await r.json();
      if (!r.ok) setTargetMsg(d.error || t("تعذّر تحديد الاستهداف", "Targeting failed"));
      else setEditPost({ ...editPost, boost_targeting: d.targeting, boost_targeting_note: d.note });
    } catch { setTargetMsg(t("تعذّر تحديد الاستهداف", "Targeting failed")); }
    setTargeting(false);
  }

  async function buyTopup() {
    setQuotaMsg("");
    const r = await fetch("/api/studio/quota", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qty: topupQty }),
    });
    const d = await r.json();
    if (!r.ok) { setQuotaMsg(d.message || t("تعذّر الشراء", "Purchase failed")); return; }
    setQuota(d.quota);
    const parts = [
      d.addedImages ? t(`${d.addedImages} صورة`, `${d.addedImages} images`) : "",
      d.addedVideos ? t(`${d.addedVideos} فيديو`, `${d.addedVideos} videos`) : "",
    ].filter(Boolean).join(t(" و", " and "));
    setQuotaMsg(t(`تمت إضافة ${parts} — خُصم ${d.charged} د.ل`, `Added ${parts} — charged ${d.charged} LYD`));
  }

  async function generatePlan() {
    setPlanErr(""); setGenerating(true);
    try {
      const r = await fetch("/api/studio/plan/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pageId: selectedPage, postsPerDay, durationDays, types: Array.from(selectedIdeas), guidance }) });
      const d = await r.json();
      if (!r.ok) { setPlanErr(d.error || t("تعذّر التوليد", "Generation failed")); }
      else { setPlan(d.plan); setPlanPosts(d.posts || []); }
    } catch { setPlanErr(t("تعذّر التوليد", "Generation failed")); }
    setGenerating(false);
  }

  async function approvePlan() {
    if (!plan) return;
    setApproving(true);
    const r = await fetch("/api/studio/plan", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: plan.id, status: "approved" }) });
    const d = await r.json();
    setApproving(false);
    if (r.ok && d.plan) { setPlan(d.plan); setPlanPosts((ps) => ps.map((p) => (p.status === "draft" ? { ...p, status: "approved" } : p))); }
  }
  async function publishPlan() {
    if (!plan) return;
    if (!confirm(t("نشر وجدولة كل منشورات الخطة على فيسبوك؟", "Publish & schedule all plan posts to Facebook?"))) return;
    setPublishing(true); setPublishMsg("");
    const r = await fetch("/api/studio/plan/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId: plan.id }) });
    const d = await r.json();
    setPublishing(false);
    if (!r.ok) { setPublishMsg(d.error || t("تعذّر النشر", "Publish failed")); return; }
    setPlanPosts(d.posts || planPosts);
    setPublishMsg(t(`تم: ${d.published} منشوراً نُشر، ${d.scheduled} مجدول${d.failed ? `، ${d.failed} فشل` : ""}.`, `Done: ${d.published} published, ${d.scheduled} scheduled${d.failed ? `, ${d.failed} failed` : ""}.`));
  }
  async function discardPlan() {
    if (!plan || !confirm(t("حذف هذه الخطة كاملة؟", "Delete this entire plan?"))) return;
    await fetch(`/api/studio/plan?id=${plan.id}`, { method: "DELETE" });
    setPlan(null); setPlanPosts([]);
  }
  async function savePost(fields: Partial<PlanPost> & { regenerate?: boolean }) {
    if (!editPost) return;
    setSavingPost(true);
    const r = await fetch("/api/studio/plan/post", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editPost.id, ...fields }) });
    const d = await r.json();
    setSavingPost(false);
    if (r.ok && d.post) {
      setPlanPosts((ps) => ps.map((p) => (p.id === d.post.id ? d.post : p)));
      setEditPost(d.post);
      if (fields.regenerate === undefined && !("image_url" in fields)) setEditPost(null); // close on a full save
    }
  }
  async function deletePlanPost(id: string) {
    if (!confirm(t("حذف هذا المنشور من الخطة؟", "Remove this post from the plan?"))) return;
    await fetch(`/api/studio/plan/post?id=${id}`, { method: "DELETE" });
    setPlanPosts((ps) => ps.filter((p) => p.id !== id));
    setEditPost(null);
  }
  async function copyCaption(p: PlanPost) {
    const text = [p.caption, p.hashtags].filter(Boolean).join("\n\n");
    try { await navigator.clipboard.writeText(text); setCopiedId(p.id); setTimeout(() => setCopiedId(""), 1600); } catch { /* ignore */ }
  }
  function toggleSelPost(id: string) { setSelectedPlanPosts((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  async function bulkPostAction(action: "delete" | "approve") {
    const ids = Array.from(selectedPlanPosts);
    if (ids.length === 0) return;
    if (action === "delete") {
      if (!confirm(t(`حذف ${ids.length} منشوراً؟`, `Delete ${ids.length} posts?`))) return;
      await Promise.all(ids.map((id) => fetch(`/api/studio/plan/post?id=${id}`, { method: "DELETE" })));
      setPlanPosts((ps) => ps.filter((p) => !selectedPlanPosts.has(p.id)));
    } else {
      await Promise.all(ids.map((id) => fetch("/api/studio/plan/post", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "approved" }) })));
      setPlanPosts((ps) => ps.map((p) => (selectedPlanPosts.has(p.id) ? { ...p, status: "approved" } : p)));
    }
    setSelectedPlanPosts(new Set()); setPostSelectMode(false);
  }
  async function applyBulkBoost() {
    const ids = Array.from(selectedPlanPosts);
    const budget = Number(bbBudget) || 0, days = Number(bbDays) || 0;
    if (ids.length === 0 || budget < 1 || days < 1) return;
    setSavingBoost(true);
    await Promise.all(ids.map((id) => fetch("/api/studio/plan/post", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, boost: true, boost_budget_usd: budget, boost_days: days }) })));
    setPlanPosts((ps) => ps.map((p) => (selectedPlanPosts.has(p.id) ? { ...p, boost: true, boost_budget_usd: budget, boost_days: days } : p)));
    setSavingBoost(false); setShowBulkBoost(false); setSelectedPlanPosts(new Set()); setPostSelectMode(false);
  }

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

  function toggleSelectProd(id: string) {
    setSelectedProds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function selectAllProds() {
    setSelectedProds((s) => (s.size === products.length ? new Set() : new Set(products.map((p) => p.id))));
  }
  async function bulkDelete() {
    const ids = Array.from(selectedProds);
    if (ids.length === 0 || !confirm(t(`حذف ${ids.length} صنفاً؟`, `Delete ${ids.length} item(s)?`))) return;
    await fetch(`/api/studio/products?ids=${ids.join(",")}`, { method: "DELETE" });
    setProducts(products.filter((p) => !selectedProds.has(p.id)));
    setSelectedProds(new Set()); setSelectMode(false);
  }
  async function bulkAvailable(available: boolean) {
    const ids = Array.from(selectedProds);
    if (ids.length === 0) return;
    setProducts(products.map((p) => (selectedProds.has(p.id) ? { ...p, available } : p)));
    setSelectedProds(new Set()); setSelectMode(false);
    await fetch("/api/studio/products", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, available }) });
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
    { id: "brand" as const,   icon: Store,        label: t("المتجر", "Store") },
    { id: "catalog" as const, icon: Package,      label: t("الأصناف", "Catalog") },
    { id: "plan" as const,    icon: CalendarDays, label: t("الخطة", "Plan") },
    { id: "alerts" as const,  icon: Bell,         label: t("التنبيهات", "Alerts"), badge: alerts.length },
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
                <div style={{ position: "absolute", insetInline: 0, top: "calc(100% + 6px)", zIndex: 30, background: c.menuBg, border: `1px solid ${c.border}`, borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.28)", overflow: "hidden" }}>
                  {pages.length > 6 && (
                    <div style={{ position: "relative", padding: 8, borderBottom: `1px solid ${c.border}` }}>
                      <Search size={15} color={c.dim} style={{ position: "absolute", insetInlineStart: 18, top: "50%", transform: "translateY(-50%)" }} />
                      <input autoFocus value={pageSearch} onChange={(e) => setPageSearch(e.target.value)} placeholder={t("ابحث عن صفحة…", "Search a Page…")}
                        style={{ ...input, padding: "9px 14px", paddingInlineStart: 36 }} />
                    </div>
                  )}
                  <div style={{ maxHeight: 260, overflowY: "auto" }}>
                  {pages.filter((p) => p.page_name.toLowerCase().includes(pageSearch.trim().toLowerCase())).map((p) => (
                    <button key={p.id} type="button" onClick={() => { setSelectedPage(p.page_id); setPageMenu(false); setPageSearch(""); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: p.page_id === selectedPage ? PINK_BG : "transparent", border: "none", cursor: "pointer", color: p.page_id === selectedPage ? PINK : c.text, textAlign: rtl ? "right" : "left", fontSize: 14, fontFamily: "inherit" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={pagePic(p.page_id)} alt="" style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, objectFit: "cover" }} />
                      <span style={{ flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{p.page_name}</span>
                    </button>
                  ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 6, background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: 13, padding: 5 }}>
              {tabs.map((tb) => {
                const badge = (tb as { badge?: number }).badge || 0;
                return (
                <button key={tb.id} onClick={() => setTab(tb.id)} style={{ flex: 1, border: "none", cursor: "pointer", borderRadius: 9, padding: "9px 0", fontFamily: "inherit", fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, position: "relative", background: tab === tb.id ? G_HERO : "transparent", color: tab === tb.id ? "#fff" : c.muted }}>
                  <tb.icon size={15} /> {tb.label}
                  {badge > 0 && <span style={{ background: "#ef4444", color: "#fff", borderRadius: 100, minWidth: 16, height: 16, fontSize: 10, fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{badge}</span>}
                </button>
                );
              })}
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
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {products.length > 0 && (
                      <button onClick={() => { setSelectMode((v) => !v); setSelectedProds(new Set()); }} style={{ background: selectMode ? PINK_BG : c.inputBg, border: `1px solid ${selectMode ? PINK + "55" : c.border}`, borderRadius: 11, padding: "9px 13px", color: selectMode ? PINK : c.text, fontWeight: 800, cursor: "pointer", fontSize: 12.5, display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}><CheckSquare size={14} /> {selectMode ? t("إلغاء", "Cancel") : t("تحديد", "Select")}</button>
                    )}
                    <button onClick={() => { setBulkText(""); setBulkCategory(""); setShowBulk(true); }} style={{ background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: 11, padding: "9px 13px", color: c.text, fontWeight: 800, cursor: "pointer", fontSize: 12.5, display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}><Sparkles size={14} color={PINK} /> {t("قائمة سريعة", "Quick list")}</button>
                    {/* Bulk catalog import — CSV/text, any column order, AR or EN headers. */}
                    <label style={{ background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: 11, padding: "9px 13px", color: c.text, fontWeight: 800, cursor: importing ? "wait" : "pointer", fontSize: 12.5, display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", opacity: importing ? 0.6 : 1 }}>
                      {importing ? <Loader2 size={14} className="spin" /> : <Upload size={14} color={PINK} />}
                      {t("رفع ملف", "Upload file")}
                      <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" disabled={importing} style={{ display: "none" }}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) importCatalog(f, false); e.target.value = ""; }} />
                    </label>
                    {importMsg && <span style={{ fontSize: 12, color: c.muted, alignSelf: "center" }}>{importMsg}</span>}
                    <button onClick={openAdd} style={{ background: G_HERO, border: "none", borderRadius: 11, padding: "9px 15px", color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}><Plus size={15} /> {t("إضافة", "Add")}</button>
                  </div>
                </div>

                {/* Selection action bar */}
                {selectMode && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, padding: "10px 12px" }}>
                    <button onClick={selectAllProds} style={{ background: "none", border: "none", color: c.muted, cursor: "pointer", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {selectedProds.size === products.length ? <CheckSquare size={15} color={PINK} /> : <Square size={15} />} {t(`تحديد الكل (${selectedProds.size})`, `Select all (${selectedProds.size})`)}
                    </button>
                    <div style={{ marginInlineStart: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button onClick={() => bulkAvailable(true)} disabled={selectedProds.size === 0} style={{ background: "rgba(34,197,94,0.14)", border: "1px solid #22c55e55", borderRadius: 9, padding: "6px 11px", color: "#22c55e", fontWeight: 800, cursor: "pointer", fontSize: 12, fontFamily: "inherit", opacity: selectedProds.size === 0 ? 0.5 : 1, display: "inline-flex", alignItems: "center", gap: 5 }}><CircleCheck size={13} /> {t("متوفر", "In stock")}</button>
                      <button onClick={() => bulkAvailable(false)} disabled={selectedProds.size === 0} style={{ background: "rgba(154,164,178,0.15)", border: `1px solid ${c.border}`, borderRadius: 9, padding: "6px 11px", color: c.muted, fontWeight: 800, cursor: "pointer", fontSize: 12, fontFamily: "inherit", opacity: selectedProds.size === 0 ? 0.5 : 1, display: "inline-flex", alignItems: "center", gap: 5 }}><CircleX size={13} /> {t("نافد", "Out")}</button>
                      <button onClick={bulkDelete} disabled={selectedProds.size === 0} style={{ background: "rgba(239,68,68,0.14)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 9, padding: "6px 11px", color: "#ef4444", fontWeight: 800, cursor: "pointer", fontSize: 12, fontFamily: "inherit", opacity: selectedProds.size === 0 ? 0.5 : 1, display: "inline-flex", alignItems: "center", gap: 5 }}><Trash2 size={13} /> {t("حذف", "Delete")}</button>
                    </div>
                  </div>
                )}
                <div style={{ fontSize: 11.5, color: c.dim, lineHeight: 1.6, marginTop: -4 }}>
                  {t("الصور اختيارية ومرجعية فقط — الموظف يصمّم صوراً جديدة لكل منشور ويعيد نشر الأصناف بصيغ وصور مختلفة.", "Images are optional references only — the employee designs fresh visuals for each post and re-posts items with new formats.")}
                </div>
                {products.length === 0 ? (
                  <div style={{ ...card, textAlign: "center", color: c.muted, fontSize: 13.5, padding: 30 }}>{t("لا أصناف بعد. أضف منتجاتك (عطور، مكياج…) — أو الصق قائمة أسماء سريعة.", "No items yet. Add your products (perfumes, makeup…) — or paste a quick name list.")}</div>
                ) : products.map((p) => {
                  const avail = p.available !== false;
                  const sel = selectedProds.has(p.id);
                  return (
                  <div key={p.id} onClick={selectMode ? () => toggleSelectProd(p.id) : undefined} style={{ ...card, padding: 14, display: "flex", gap: 12, alignItems: "center", opacity: avail ? 1 : 0.65, cursor: selectMode ? "pointer" : "default", borderColor: sel ? `${PINK}88` : c.border, background: sel ? "rgba(214,64,159,0.06)" : c.surface }}>
                    {selectMode && (sel ? <CheckSquare size={20} color={PINK} style={{ flexShrink: 0 }} /> : <Square size={20} color={c.dim} style={{ flexShrink: 0 }} />)}
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
                    {!selectMode && <>
                      <button onClick={() => toggleAvailable(p)} title={avail ? t("متوفر", "In stock") : t("غير متوفر", "Out of stock")}
                        style={{ background: avail ? "rgba(34,197,94,0.14)" : "rgba(154,164,178,0.15)", border: `1px solid ${avail ? "#22c55e55" : c.border}`, borderRadius: 100, padding: "5px 11px", color: avail ? "#22c55e" : c.muted, cursor: "pointer", fontSize: 11, fontWeight: 800, flexShrink: 0, fontFamily: "inherit" }}>
                        {avail ? t("متوفر", "In") : t("نافد", "Out")}
                      </button>
                      <button onClick={() => openEdit(p)} style={{ background: PINK_BG, border: `1px solid ${PINK}44`, borderRadius: 9, padding: "7px 9px", color: PINK, cursor: "pointer", flexShrink: 0 }}><Pencil size={13} /></button>
                      <button onClick={() => deleteProduct(p.id)} style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 9, padding: "7px 9px", color: "#ef4444", cursor: "pointer", flexShrink: 0 }}><Trash2 size={14} /></button>
                    </>}
                  </div>
                  );
                })}
              </div>
            )}

            {/* Monthly allowance for the paid AI — what it is, what is left, how to extend it. */}
            {tab === "plan" && quota && (quota.unlimited || quota.images.limit > 0 || quota.videos.limit > 0) && (
              <div style={{ background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: 12, padding: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 9, display: "flex", alignItems: "center", gap: 6 }}>
                  <Sparkles size={13} color={PINK} /> {t("حصة الذكاء القوي هذا الشهر", "This month's strong-AI allowance")}
                </div>
                {quota.unlimited && (
                  <div style={{ fontSize: 12, color: "#a855f7", lineHeight: 1.8, marginBottom: 4 }}>
                    {t("حساب أدمن — بلا حدود. انتبه: توليدك يُحاسب على رصيد fal.ai الحقيقي مثل أي عميل.",
                       "Admin account — unlimited. Note: your own generations bill the real fal.ai balance.")}
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, opacity: quota.unlimited ? 0.55 : 1 }}>
                  {([["images", t("صور عالية الجودة", "High-quality images")], ["videos", t("فيديوهات", "Videos")]] as const).map(([k, label]) => {
                    const q = quota[k];
                    const total = q.limit + q.extra;
                    const pct = total > 0 ? Math.min(100, Math.round((q.used / total) * 100)) : 0;
                    return (
                      <div key={k}>
                        <div style={{ fontSize: 11.5, color: c.muted, marginBottom: 5 }}>{label}</div>
                        <div style={{ fontSize: 15, fontWeight: 900 }}>{quota.unlimited ? "∞" : <>{q.left}<span style={{ fontSize: 11, color: c.muted, fontWeight: 700 }}> / {total}</span></>}</div>
                        <div style={{ height: 5, borderRadius: 100, background: c.border, marginTop: 6, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: pct >= 100 ? "#ef4444" : G_HERO }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Buy more. Only appears for plans that sell a pack, and the pack
                    carries exactly what the buyer's own plan carries. */}
                {!quota.unlimited && quota.pack.available && (
                  <div style={{ marginTop: 12, borderTop: `1px solid ${c.border}`, paddingTop: 12 }}>
                    {quota.images.left === 0 && quota.videos.left === 0 && (
                      <div style={{ fontSize: 12, color: "#f59e0b", marginBottom: 9, lineHeight: 1.7 }}>
                        {t("انتهت حصتك لهذا الشهر. اشترِ كمية إضافية للمتابعة بالجودة العالية.",
                           "Your allowance for this month is used up. Buy more to keep generating at high quality.")}
                      </div>
                    )}
                    <div style={{ fontSize: 11.5, color: c.muted, marginBottom: 7 }}>
                      {t("شراء كمية إضافية", "Buy more")} — {t("الباقة الواحدة", "one pack")}: {quota.pack.images} {t("صورة", "images")}
                      {quota.pack.videos > 0 ? ` + ${quota.pack.videos} ${t("فيديو", "videos")}` : ""} · {quota.pack.price_lyd} {t("د.ل", "LYD")}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 0, border: `1px solid ${c.border}`, borderRadius: 10, overflow: "hidden" }}>
                        <button onClick={() => setTopupQty((q) => Math.max(1, q - 1))} style={{ background: c.surface, border: "none", padding: "8px 13px", color: c.text, cursor: "pointer", fontWeight: 900, fontSize: 15, fontFamily: "inherit" }}>−</button>
                        <div style={{ minWidth: 40, textAlign: "center", fontWeight: 900, fontSize: 15 }}>{topupQty}</div>
                        <button onClick={() => setTopupQty((q) => Math.min(10, q + 1))} style={{ background: c.surface, border: "none", padding: "8px 13px", color: c.text, cursor: "pointer", fontWeight: 900, fontSize: 15, fontFamily: "inherit" }}>+</button>
                      </div>
                      <div style={{ flex: 1, minWidth: 150, fontSize: 12.5, lineHeight: 1.7 }}>
                        <b style={{ color: PINK }}>{quota.pack.images * topupQty}</b> {t("صورة", "images")}
                        {quota.pack.videos > 0 && <> + <b style={{ color: PINK }}>{quota.pack.videos * topupQty}</b> {t("فيديو", "videos")}</>}
                        <div style={{ color: c.muted, fontSize: 11.5 }}>{t("تُضاف لهذا الشهر فقط", "Added to this month only")}</div>
                      </div>
                      <button onClick={buyTopup} style={{ background: G_HERO, border: "none", borderRadius: 11, padding: "10px 16px", color: "#fff", fontWeight: 900, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 7 }}>
                        <DollarSign size={15} /> {t("شراء بـ", "Buy for")} {quota.pack.price_lyd * topupQty} {t("د.ل", "LYD")}
                      </button>
                    </div>
                  </div>
                )}
                <div style={{ fontSize: 11, color: c.muted, marginTop: 9, lineHeight: 1.7 }}>
                  {t("تتجدّد مع تجديد الاشتراك. التوليد المجاني وصور الإنترنت والكتالوج بلا حدود.",
                     "Resets when your subscription renews. The free generator, web images and catalog photos stay unlimited.")}
                </div>
                {quotaMsg && <div style={{ fontSize: 12, color: PINK, marginTop: 8, lineHeight: 1.6 }}>{quotaMsg}</div>}
              </div>
            )}

            {/* PLAN TAB */}
            {tab === "plan" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Employee brain / your signature */}
                <div style={{ ...card, padding: 16 }}>
                  <button type="button" onClick={() => setShowBrain((v) => !v)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: rtl ? "right" : "left", padding: 0 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#6d28d9,#d6409f)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Brain size={17} color="#fff" /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 800 }}>{t("عقل الموظف — بصمتك الخاصة", "Employee brain — your signature")}</div>
                      <div style={{ fontSize: 11.5, color: c.dim, marginTop: 2 }}>{t("يتذكّر أسلوبك ولغتك ويطوّرها في كل خطة.", "Remembers your style & voice and refines it each plan.")}</div>
                    </div>
                    <ChevronDown size={16} color={c.dim} style={{ flexShrink: 0, transform: showBrain ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                  </button>
                  {showBrain && (
                    <div style={{ marginTop: 14 }}>
                      <Field muted={c.muted} label={t("أسلوبي ولغتي (يلتزم بها الموظف)", "My style & voice (the employee keeps to it)")}>
                        <textarea rows={2} style={{ ...input, resize: "vertical" }} value={brainStyle} onChange={(e) => setBrainStyle(e.target.value)} placeholder={t("مثال: لهجة ليبية ودودة، جُمل قصيرة، إيموجي معتدل، أركّز على الجودة والثقة", "e.g. Warm Libyan tone, short sentences, moderate emojis, focus on quality & trust")} />
                      </Field>
                      <Field muted={c.muted} label={t("ملاحظات متراكمة (تُضاف تلقائياً من توجيهاتك)", "Accumulated notes (auto-added from your guidance)")}>
                        <textarea rows={3} style={{ ...input, resize: "vertical" }} value={brainNotes} onChange={(e) => setBrainNotes(e.target.value)} placeholder={t("يتراكم هنا ما تطلبه مع الوقت…", "Your recurring preferences accumulate here…")} />
                      </Field>
                      <button onClick={saveBrain} disabled={savingBrain} style={{ background: brainSaved ? "#22c55e" : G_HERO, border: "none", borderRadius: 12, padding: "11px 20px", color: "#fff", fontWeight: 800, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 7 }}>
                        {savingBrain ? <Loader2 size={15} className="spin" /> : brainSaved ? <CheckCircle size={15} /> : <Save size={15} />} {brainSaved ? t("حُفظ", "Saved") : t("حفظ العقل", "Save brain")}
                      </button>
                    </div>
                  )}
                </div>

                {/* Generator controls */}
                <div style={card}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 15, marginBottom: 6 }}><Sparkles size={17} color={PINK} /> {plan ? t("توليد خطة جديدة", "Generate a new plan") : t("خطة النشر", "Content plan")}</div>
                  <p style={{ color: c.dim, fontSize: 12.5, margin: "0 0 14px", lineHeight: 1.7 }}>{t("حدّد عدد المنشورات اليومية والمدة، ويصمّم الموظف الخطة كاملة (نصوص + صور).", "Set posts per day and duration; the employee designs the full plan (captions + images).")}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Field muted={c.muted} label={t("منشورات يومياً", "Posts per day")}><input type="number" min={1} max={10} style={input} value={postsPerDay} onChange={(e) => setPostsPerDay(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} /></Field>
                    <Field muted={c.muted} label={t("عدد الأيام", "Number of days")}><input type="number" min={1} max={30} style={input} value={durationDays} onChange={(e) => setDurationDays(Math.max(1, Math.min(30, Number(e.target.value) || 7)))} /></Field>
                  </div>
                  <div style={{ fontSize: 12, color: c.muted, marginBottom: 12 }}>{t(`= ${Math.min(postsPerDay * durationDays, 40)} منشوراً`, `= ${Math.min(postsPerDay * durationDays, 40)} posts`)}{postsPerDay * durationDays > 40 ? t(" (الحد 40)", " (max 40)") : ""}</div>

                  {/* Ready-made idea types */}
                  <label style={{ fontSize: 12.5, color: c.muted, display: "block", marginBottom: 8, fontWeight: 600 }}>{t("أنواع المنشورات التي تريدها (اختر ما يناسبك — الكل افتراضياً)", "Post ideas you want (pick some — all by default)")}</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
                    {POST_IDEAS.map(([ar, en]) => {
                      const on = selectedIdeas.has(ar);
                      return (
                        <button key={ar} type="button" onClick={() => setSelectedIdeas((s) => { const n = new Set(s); n.has(ar) ? n.delete(ar) : n.add(ar); return n; })}
                          style={{ padding: "7px 12px", borderRadius: 100, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                            border: on ? `2px solid ${PINK}` : `1px solid ${c.border}`, background: on ? PINK_BG : c.inputBg, color: on ? PINK : c.muted }}>
                          {t(ar, en)}
                        </button>
                      );
                    })}
                  </div>

                  {/* Free guidance */}
                  <Field muted={c.muted} label={t("تحدّث عن الأفكار التي تريدها (اختياري)", "Describe the ideas you want (optional)")}>
                    <textarea rows={2} style={{ ...input, resize: "vertical" }} value={guidance} onChange={(e) => setGuidance(e.target.value)}
                      placeholder={t("مثال: ركّز على عروض نهاية الأسبوع، لهجة مرحة، اذكر التوصيل المجاني…", "e.g. Focus on weekend offers, playful tone, mention free delivery…")} />
                  </Field>

                  {planErr && <div style={{ color: "#ef4444", fontSize: 12.5, marginBottom: 10 }}>{planErr}</div>}
                  <button onClick={generatePlan} disabled={generating || products.length === 0} style={{ width: "100%", background: G_HERO, border: "none", borderRadius: 13, padding: "13px 0", color: "#fff", fontWeight: 900, fontSize: 15, cursor: "pointer", opacity: generating || products.length === 0 ? 0.65 : 1, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    {generating ? <Loader2 size={17} className="spin" /> : <Sparkles size={17} />} {generating ? t("يصمّم الموظف الخطة…", "The employee is designing…") : plan ? t("توليد خطة جديدة (يستبدل الحالية)", "Generate new (replaces current)") : t("توليد الخطة", "Generate plan")}
                  </button>
                  {products.length === 0 && <p style={{ fontSize: 11.5, color: c.dim, textAlign: "center", marginTop: 8 }}>{t("أضف أصنافاً في الكتالوج أولاً.", "Add catalog items first.")}</p>}
                </div>

                {/* Generated plan */}
                {plan && planPosts.length > 0 && (
                  <>
                    <div style={{ ...card, padding: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 14 }}>{t(`الخطة (${planPosts.length} منشوراً)`, `Plan (${planPosts.length} posts)`)} {plan.status === "approved" && <span style={{ color: "#22c55e", fontSize: 12 }}>· {t("معتمدة ✓", "Approved ✓")}</span>}</div>
                          {plan.summary && <div style={{ fontSize: 12, color: c.muted, marginTop: 3, lineHeight: 1.6 }}>{plan.summary}</div>}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => { setPostSelectMode((v) => !v); setSelectedPlanPosts(new Set()); }} style={{ background: postSelectMode ? PINK_BG : c.inputBg, border: `1px solid ${postSelectMode ? PINK + "55" : c.border}`, borderRadius: 10, padding: "8px 12px", color: postSelectMode ? PINK : c.text, cursor: "pointer", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 }}><CheckSquare size={13} /> {postSelectMode ? t("إلغاء", "Cancel") : t("تحديد", "Select")}</button>
                          <button onClick={discardPlan} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "8px 12px", color: "#ef4444", cursor: "pointer", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit" }}>{t("حذف الخطة", "Delete plan")}</button>
                        </div>
                      </div>
                      {postSelectMode && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${c.border}` }}>
                          <span style={{ fontSize: 12.5, color: c.muted, fontWeight: 700 }}>{t(`محدّد: ${selectedPlanPosts.size}`, `Selected: ${selectedPlanPosts.size}`)}</span>
                          <div style={{ marginInlineStart: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button onClick={() => setShowBulkBoost(true)} disabled={selectedPlanPosts.size === 0} style={{ background: PINK_BG, border: `1px solid ${PINK}55`, borderRadius: 9, padding: "6px 11px", color: PINK, fontWeight: 800, cursor: "pointer", fontSize: 12, fontFamily: "inherit", opacity: selectedPlanPosts.size === 0 ? 0.5 : 1, display: "inline-flex", alignItems: "center", gap: 5 }}><DollarSign size={13} /> {t("تمويل", "Boost")}</button>
                            <button onClick={() => bulkPostAction("approve")} disabled={selectedPlanPosts.size === 0} style={{ background: "rgba(34,197,94,0.14)", border: "1px solid #22c55e55", borderRadius: 9, padding: "6px 11px", color: "#22c55e", fontWeight: 800, cursor: "pointer", fontSize: 12, fontFamily: "inherit", opacity: selectedPlanPosts.size === 0 ? 0.5 : 1, display: "inline-flex", alignItems: "center", gap: 5 }}><CircleCheck size={13} /> {t("اعتماد", "Approve")}</button>
                            {/* Spend the month's paid-AI allowance on the selected posts only. */}
                            <button onClick={upgradeSelected} disabled={selectedPlanPosts.size === 0 || upgrading} style={{ background: "rgba(168,85,247,0.14)", border: "1px solid rgba(168,85,247,0.35)", borderRadius: 9, padding: "6px 11px", color: "#a855f7", fontWeight: 800, cursor: "pointer", fontSize: 12, fontFamily: "inherit", opacity: selectedPlanPosts.size === 0 || upgrading ? 0.5 : 1, display: "inline-flex", alignItems: "center", gap: 5 }}>
                              {upgrading ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />} {t("صور بجودة عالية", "High-quality images")}
                            </button>
                            <button onClick={() => bulkPostAction("delete")} disabled={selectedPlanPosts.size === 0} style={{ background: "rgba(239,68,68,0.14)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 9, padding: "6px 11px", color: "#ef4444", fontWeight: 800, cursor: "pointer", fontSize: 12, fontFamily: "inherit", opacity: selectedPlanPosts.size === 0 ? 0.5 : 1, display: "inline-flex", alignItems: "center", gap: 5 }}><Trash2 size={13} /> {t("حذف", "Delete")}</button>
                          </div>
                        </div>
                      )}
                      <div style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 11, padding: "10px 13px", fontSize: 12, color: "#3b82f6", marginTop: 12, lineHeight: 1.7, display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <Clock size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                        {t("النشر التلقائي يحتاج صلاحية فيسبوك (قيد الطلب). الآن: راجع وعدّل ووافق، وانسخ نص كل منشور وحمّل صورته لنشره بنفسك.", "Auto-publishing needs a Facebook permission (being requested). For now: review, edit, approve — copy each caption and download its image to post yourself.")}
                      </div>
                    </div>

                    {/* posts grouped by day */}
                    {Array.from(new Set(planPosts.map((p) => (p.scheduled_for || "").slice(0, 10)))).map((day) => (
                      <div key={day}>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: c.muted, margin: "4px 2px 8px", display: "flex", alignItems: "center", gap: 6 }}>
                          <CalendarDays size={14} color={PINK} /> {new Date(day).toLocaleDateString(rtl ? "ar-LY" : "en-GB", { weekday: "long", day: "numeric", month: "short" })}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {planPosts.filter((p) => (p.scheduled_for || "").slice(0, 10) === day).map((p) => (
                            <div key={p.id} onClick={postSelectMode ? () => toggleSelPost(p.id) : undefined} style={{ ...card, padding: 12, display: "flex", gap: 12, cursor: postSelectMode ? "pointer" : "default", borderColor: selectedPlanPosts.has(p.id) ? `${PINK}88` : c.border }}>
                              {postSelectMode && (selectedPlanPosts.has(p.id) ? <CheckSquare size={20} color={PINK} style={{ flexShrink: 0, alignSelf: "center" }} /> : <Square size={20} color={c.dim} style={{ flexShrink: 0, alignSelf: "center" }} />)}
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={p.image_url} alt="" style={{ width: 74, height: 74, borderRadius: 12, objectFit: "cover", flexShrink: 0, background: c.inputBg }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                                  {p.post_type && <span style={{ fontSize: 10.5, fontWeight: 800, borderRadius: 100, padding: "2px 8px", background: PINK_BG, color: PINK }}>{p.post_type}</span>}
                                  <span style={{ fontSize: 11, color: c.dim, display: "inline-flex", alignItems: "center", gap: 3 }}><Clock size={11} /> {p.scheduled_for ? new Date(p.scheduled_for).toLocaleTimeString(rtl ? "ar-LY" : "en-GB", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                                  {p.status === "approved" && <CheckCircle size={13} color="#22c55e" />}
                                  {p.status === "scheduled" && <span style={{ fontSize: 10.5, fontWeight: 800, borderRadius: 100, padding: "2px 8px", background: "rgba(59,130,246,0.14)", color: "#3b82f6" }}>{t("مجدول ✓", "Scheduled ✓")}</span>}
                                  {p.status === "published" && <span style={{ fontSize: 10.5, fontWeight: 800, borderRadius: 100, padding: "2px 8px", background: "rgba(34,197,94,0.16)", color: "#22c55e" }}>{t("منشور ✓", "Published ✓")}</span>}
                                  {p.status === "failed" && <span style={{ fontSize: 10.5, fontWeight: 800, borderRadius: 100, padding: "2px 8px", background: "rgba(239,68,68,0.14)", color: "#ef4444" }}>{t("فشل النشر", "Publish failed")}</span>}
                                  {p.boost && <span style={{ fontSize: 10.5, fontWeight: 800, borderRadius: 100, padding: "2px 8px", background: "rgba(240,180,41,0.16)", color: "#f0b429", display: "inline-flex", alignItems: "center", gap: 3 }}><DollarSign size={10} /> {t(`ممول $${p.boost_budget_usd}/يوم × ${p.boost_days}ي`, `Boost $${p.boost_budget_usd}/d × ${p.boost_days}d`)}</span>}
                                </div>
                                <div style={{ fontSize: 13, lineHeight: 1.6, color: c.text, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.caption}</div>
                                {!postSelectMode && <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                                  <button onClick={() => setEditPost(p)} style={{ background: PINK_BG, border: `1px solid ${PINK}44`, borderRadius: 9, padding: "6px 12px", color: PINK, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 }}><Pencil size={12} /> {t("تعديل", "Edit")}</button>
                                  <button onClick={() => copyCaption(p)} style={{ background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: 9, padding: "6px 12px", color: copiedId === p.id ? "#22c55e" : c.muted, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 }}>{copiedId === p.id ? <CheckCircle size={12} /> : <Copy size={12} />} {copiedId === p.id ? t("نُسخ", "Copied") : t("نسخ النص", "Copy")}</button>
                                  <a href={p.image_url} target="_blank" rel="noopener noreferrer" style={{ background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: 9, padding: "6px 12px", color: c.muted, textDecoration: "none", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}><ImageIcon size={12} /> {t("الصورة", "Image")}</a>
                                </div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {plan.status !== "approved" && plan.status !== "active" && (
                      <button onClick={approvePlan} disabled={approving} style={{ width: "100%", background: "#22c55e", border: "none", borderRadius: 14, padding: "15px 0", color: "#fff", fontWeight: 900, fontSize: 16, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: approving ? 0.7 : 1 }}>
                        {approving ? <Loader2 size={18} className="spin" /> : <CheckCircle size={18} />} {t("اعتماد الخطة كاملة", "Approve whole plan")}
                      </button>
                    )}

                    {/* Auto-publish */}
                    {(plan.status === "approved" || plan.status === "active") && (
                      <div style={{ ...card, padding: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 14.5, marginBottom: 6 }}><Bot size={17} color={PINK} /> {t("النشر التلقائي", "Auto-publish")}</div>
                        <p style={{ color: c.muted, fontSize: 12.5, margin: "0 0 12px", lineHeight: 1.7 }}>
                          {t("ينشر الموظف المنشورات المعتمدة ويجدولها على فيسبوك في أوقاتها. يتطلب صلاحية النشر من فيسبوك (قيد الطلب) — سيعمل فور اعتمادها.", "The employee publishes & schedules approved posts to Facebook at their times. Requires the Facebook publishing permission (being requested) — it works the moment it's approved.")}
                        </p>
                        {publishMsg && <div style={{ fontSize: 12.5, color: publishMsg.includes(t("فشل", "failed")) ? "#f59e0b" : "#22c55e", marginBottom: 10, lineHeight: 1.6 }}>{publishMsg}</div>}
                        <button onClick={publishPlan} disabled={publishing} style={{ width: "100%", background: G_HERO, border: "none", borderRadius: 13, padding: "14px 0", color: "#fff", fontWeight: 900, fontSize: 15, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: publishing ? 0.7 : 1 }}>
                          {publishing ? <Loader2 size={17} className="spin" /> : <CalendarDays size={17} />} {t("نشر وجدولة على فيسبوك", "Publish & schedule to Facebook")}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ALERTS TAB */}
            {tab === "alerts" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 13, color: c.muted, lineHeight: 1.7, marginBottom: 2 }}>{t("تنبيهات الأخطاء والمشاكل عبر الإعلانات، الموظف الذكي، وبوت الرد لهذه الصفحة.", "Error & issue alerts across Ads, the AI Employee, and the reply bot for this Page.")}</div>
                {alerts.length === 0 ? (
                  <div style={{ ...card, textAlign: "center", padding: 36 }}>
                    <CheckCircle size={40} color="#22c55e" style={{ marginBottom: 12 }} />
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{t("كل شيء على ما يرام", "All clear")}</div>
                    <div style={{ fontSize: 13, color: c.muted, marginTop: 4 }}>{t("لا توجد أخطاء أو تنبيهات حالياً.", "No errors or alerts right now.")}</div>
                  </div>
                ) : alerts.map((a) => {
                  const col = a.severity === "error" ? "#ef4444" : a.severity === "warning" ? "#f59e0b" : "#3b82f6";
                  const Icon = a.severity === "error" ? AlertCircle : AlertTriangle;
                  const areaLbl = a.area === "ads" ? t("الإعلانات", "Ads") : a.area === "bot" ? t("البوت", "Bot") : t("الموظف", "Employee");
                  return (
                    <div key={a.id} style={{ ...card, padding: 14, display: "flex", gap: 12, alignItems: "flex-start", borderColor: `${col}55` }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: `${col}1f`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={17} color={col} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 10.5, fontWeight: 800, borderRadius: 100, padding: "2px 8px", background: c.inputBg, color: c.muted }}>{areaLbl}</span>
                          <span style={{ fontWeight: 800, fontSize: 13.5, color: c.text }}>{a.title}</span>
                        </div>
                        {a.detail && <div style={{ fontSize: 12.5, color: c.muted, marginTop: 4, lineHeight: 1.6, wordBreak: "break-word" }}>{a.detail}</div>}
                        {a.area === "ads" && <button onClick={() => router.push("/ads/campaigns")} style={{ marginTop: 8, background: "none", border: "none", color: PINK, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", padding: 0 }}>{t("فتح حملاتي ←", "Open my campaigns →")}</button>}
                        {a.area === "bot" && <button onClick={() => router.push("/bot")} style={{ marginTop: 8, background: "none", border: "none", color: PINK, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", padding: 0 }}>{t("فتح البوت ←", "Open the bot →")}</button>}
                      </div>
                    </div>
                  );
                })}
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

      {/* Edit planned post modal */}
      {editPost && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setEditPost(null); }} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12, direction: rtl ? "rtl" : "ltr" }}>
          <div style={{ background: c.bg, color: c.text, width: "100%", maxWidth: 500, borderRadius: 22, padding: 20, fontFamily: "Cairo,sans-serif", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>{t("تعديل المنشور", "Edit post")}</div>
              <button onClick={() => setEditPost(null)} style={{ background: "none", border: "none", color: c.muted, cursor: "pointer" }}><X size={20} /></button>
            </div>
            {/* Image + controls */}
            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={editPost.image_url} alt="" style={{ width: 90, height: 90, borderRadius: 12, objectFit: "cover", flexShrink: 0, background: c.inputBg }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 7, justifyContent: "center" }}>
                <button onClick={() => savePost({ regenerate: true })} disabled={savingPost} style={{ background: PINK_BG, border: `1px solid ${PINK}44`, borderRadius: 9, padding: "7px 12px", color: PINK, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }}>{savingPost ? <Loader2 size={12} className="spin" /> : <RefreshCw size={12} />} {t("صورة جديدة بالذكاء", "New AI image")}</button>
                <label style={{ background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: 9, padding: "7px 12px", color: c.muted, cursor: "pointer", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {uploadingImg ? <Loader2 size={12} className="spin" /> : <ImageIcon size={12} />} {t("رفع صورة", "Upload image")}
                  <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setUploadingImg(true); const u = await uploadImage(f); setUploadingImg(false); if (u) savePost({ image_url: u, image_source: "upload" }); e.target.value = ""; }} />
                </label>
                <button onClick={() => { setShowImgSearch((v) => !v); if (!showImgSearch) { const q = editPost.image_prompt || ""; setImgQuery(q); if (q) searchImages(q); } }} style={{ background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: 9, padding: "7px 12px", color: c.muted, cursor: "pointer", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}><Globe size={12} /> {t("صور من الإنترنت", "Web images")}</button>
              </div>
            </div>
            {/* Web image search panel */}
            {showImgSearch && (
              <div style={{ background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: 12, padding: 12, marginBottom: 14 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <input value={imgQuery} onChange={(e) => setImgQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchImages(imgQuery)} placeholder={t("ابحث عن صورة (بالإنجليزية أفضل)…", "Search images (English works best)…")} style={{ ...input, background: c.bg }} />
                  <button onClick={() => searchImages(imgQuery)} disabled={imgSearching} style={{ background: G_HERO, border: "none", borderRadius: 10, padding: "0 14px", color: "#fff", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center" }}>{imgSearching ? <Loader2 size={16} className="spin" /> : <Search size={16} />}</button>
                </div>
                {imgErr && <div style={{ fontSize: 12, color: "#f59e0b", lineHeight: 1.6 }}>{imgErr}</div>}
                {imgTranslated && (
                  <div style={{ fontSize: 11, color: c.muted, marginBottom: 8 }}>
                    {t("بحثنا بالإنجليزية عن", "Searched in English for")}: <b>{imgTranslated}</b>
                  </div>
                )}
                {imgResults.length > 0 && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(80px,1fr))", gap: 8, maxHeight: 240, overflowY: "auto" }}>
                      {imgResults.map((im, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={im.thumb} alt="" onClick={() => { savePost({ image_url: im.url, image_source: "stock" }); setShowImgSearch(false); }} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 9, cursor: "pointer", border: `1px solid ${c.border}` }} />
                      ))}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 8 }}>
                      <span style={{ fontSize: 11, color: c.muted }}>{imgResults.length} {t("صورة", "images")}</span>
                      {imgMore && (
                        <button onClick={() => searchImages(imgQuery, imgPage + 1)} disabled={imgSearching}
                          style={{ background: "none", border: `1px solid ${c.border}`, borderRadius: 9, padding: "6px 12px", color: c.muted, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>
                          {imgSearching ? t("جارٍ…", "Loading…") : t("المزيد", "Load more")}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* AI photo editing — keeps the real product, redraws everything around it. */}
            {editPost?.image_url && (
              <div style={{ background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: 12, padding: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <Sparkles size={13} /> {t("تعديل الصورة بالذكاء الاصطناعي", "Edit image with AI")}
                  <span style={{ fontSize: 10, fontWeight: 700, color: c.muted }}>VIP</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={editImgPrompt} onChange={(e) => setEditImgPrompt(e.target.value)}
                    placeholder={t("مثال: خلفية بيضاء نظيفة وإضاءة استوديو", "e.g. clean white background, studio lighting")}
                    style={{ ...input, background: c.bg }} />
                  <button onClick={aiEditImage} disabled={editingImg || !editImgPrompt.trim()}
                    style={{ background: G_HERO, border: "none", borderRadius: 10, padding: "0 14px", color: "#fff", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", opacity: editingImg || !editImgPrompt.trim() ? 0.5 : 1 }}>
                    {editingImg ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: c.muted, marginTop: 7, lineHeight: 1.7 }}>
                  {t("يحتفظ بمنتجك الحقيقي ويعيد رسم ما حوله.", "Keeps your real product and redraws everything around it.")}
                </div>
              </div>
            )}

            {/* Video generation — queued, so the button polls until the clip is ready. */}
            <div style={{ background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: 12, padding: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Sparkles size={13} /> {t("توليد فيديو من وصف", "Generate video from a prompt")}
                <span style={{ fontSize: 10, fontWeight: 700, color: c.muted }}>VIP</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={videoPrompt} onChange={(e) => setVideoPrompt(e.target.value)}
                  placeholder={t("صف المشهد الذي تريده…", "Describe the scene you want…")}
                  style={{ ...input, background: c.bg }} />
                <button onClick={makeVideo} disabled={videoState === "pending" || !videoPrompt.trim()}
                  style={{ background: G_HERO, border: "none", borderRadius: 10, padding: "0 14px", color: "#fff", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", opacity: videoState === "pending" || !videoPrompt.trim() ? 0.5 : 1 }}>
                  {videoState === "pending" ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                </button>
              </div>
              {videoState === "pending" && <div style={{ fontSize: 11, color: c.muted, marginTop: 7 }}>{t("قد يستغرق دقيقتين إلى خمس…", "This can take two to five minutes…")}</div>}
              {videoState === "failed" && <div style={{ fontSize: 12, color: "#f59e0b", marginTop: 7, lineHeight: 1.6 }}>{videoMsg}</div>}
              {videoState === "done" && videoUrl && (
                <video src={videoUrl} controls style={{ width: "100%", borderRadius: 10, marginTop: 9 }} />
              )}
            </div>

            {/* The owner's own clip — free on every plan, published as a Page video. */}
            <div style={{ background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: 12, padding: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Upload size={13} color={PINK} /> {t("رفع فيديو من جهازك", "Upload a video from your device")}
              </div>
              {editPost?.video_url ? (
                <>
                  <video src={editPost.video_url} controls style={{ width: "100%", borderRadius: 10 }} />
                  <button onClick={() => savePost({ video_url: null })} style={{ marginTop: 8, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 9, padding: "6px 12px", color: "#ef4444", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                    {t("إزالة الفيديو", "Remove video")}
                  </button>
                </>
              ) : (
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: "9px 13px", color: c.text, fontWeight: 800, fontSize: 12.5, cursor: uploadingVideo ? "wait" : "pointer", opacity: uploadingVideo ? 0.6 : 1 }}>
                  {uploadingVideo ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
                  {t("اختر فيديو", "Choose a video")}
                  <input type="file" accept="video/mp4,video/quicktime,video/webm" disabled={uploadingVideo} style={{ display: "none" }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadVideo(f); e.target.value = ""; }} />
                </label>
              )}
              <div style={{ fontSize: 11, color: c.muted, marginTop: 7, lineHeight: 1.7 }}>
                {t("MP4 أو MOV أو WebM، حتى ٩٠ ميغابايت. عند وجود فيديو يُنشر بدل الصورة.",
                   "MP4, MOV or WebM up to 90 MB. When a video is set it is published instead of the image.")}
              </div>
            </div>
            <Field muted={c.muted} label={t("نص المنشور", "Caption")}><textarea rows={5} style={{ ...input, resize: "vertical", lineHeight: 1.8 }} value={editPost.caption || ""} onChange={(e) => setEditPost({ ...editPost, caption: e.target.value })} /></Field>
            <Field muted={c.muted} label={t("الهاشتاقات", "Hashtags")}><input style={input} value={editPost.hashtags || ""} onChange={(e) => setEditPost({ ...editPost, hashtags: e.target.value })} /></Field>
            <Field muted={c.muted} label={t("دعوة لإجراء", "Call to action")}><input style={input} value={editPost.cta || ""} onChange={(e) => setEditPost({ ...editPost, cta: e.target.value })} /></Field>
            <Field muted={c.muted} label={t("يوم ووقت النشر", "Publish day & time")}>
              <input type="datetime-local" style={{ ...input, colorScheme: light ? "light" : "dark" }}
                value={editPost.scheduled_for ? new Date(new Date(editPost.scheduled_for).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
                onChange={(e) => { const v = e.target.value; setEditPost({ ...editPost, scheduled_for: v ? new Date(v).toISOString() : editPost.scheduled_for }); }} />
            </Field>
            {/* Boost this post */}
            <div style={{ background: editPost.boost ? "rgba(240,180,41,0.08)" : c.inputBg, border: `1px solid ${editPost.boost ? "rgba(240,180,41,0.4)" : c.border}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <button type="button" onClick={() => setEditPost({ ...editPost, boost: !editPost.boost, boost_budget_usd: editPost.boost_budget_usd || 5, boost_days: editPost.boost_days || 3 })}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: rtl ? "right" : "left", padding: 0 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: editPost.boost ? "linear-gradient(135deg,#f0b429,#ff9d2f)" : c.surface, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><DollarSign size={15} color={editPost.boost ? "#1a1330" : c.muted} /></div>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 800, color: editPost.boost ? "#f0b429" : c.text }}>{t("تمويل هذا المنشور", "Boost this post")}</div>
                <div style={{ width: 40, height: 23, borderRadius: 100, background: editPost.boost ? "#f0b429" : c.border, position: "relative", flexShrink: 0 }}><div style={{ position: "absolute", top: 3, insetInlineStart: editPost.boost ? 20 : 3, width: 17, height: 17, borderRadius: "50%", background: "#fff" }} /></div>
              </button>
              {editPost.boost && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                  <div><label style={{ fontSize: 11.5, color: c.muted, display: "block", marginBottom: 5 }}>{t("الميزانية اليومية ($)", "Daily budget ($)")}</label><input type="number" min={1} style={input} value={editPost.boost_budget_usd ?? 5} onChange={(e) => setEditPost({ ...editPost, boost_budget_usd: Number(e.target.value) || 0 })} /></div>
                  <div><label style={{ fontSize: 11.5, color: c.muted, display: "block", marginBottom: 5 }}>{t("المدة (أيام)", "Days")}</label><input type="number" min={1} max={30} style={input} value={editPost.boost_days ?? 3} onChange={(e) => setEditPost({ ...editPost, boost_days: Number(e.target.value) || 0 })} /></div>
                </div>
              )}
              {/* Targeting: the AI reads the post and picks the audience. Cities stay
                  the owner's call, because they know their delivery range. */}
              {editPost.boost && (
                <div style={{ marginTop: 12, borderTop: `1px solid ${c.border}`, paddingTop: 12 }}>
                  <label style={{ fontSize: 11.5, color: c.muted, display: "block", marginBottom: 5 }}>
                    {t("المدن التي تريدها (اختياري — افصل بفاصلة)", "Cities you want (optional — comma separated)")}
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input style={input} value={targetCities} onChange={(e) => setTargetCities(e.target.value)}
                      placeholder={t("طرابلس، بنغازي — اتركه فارغاً ليختار الذكاء", "Tripoli, Benghazi — leave empty to let AI choose")} />
                    <button onClick={autoTarget} disabled={targeting}
                      style={{ background: G_HERO, border: "none", borderRadius: 10, padding: "0 14px", color: "#fff", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", opacity: targeting ? 0.6 : 1 }}>
                      {targeting ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                    </button>
                  </div>

                  {editPost.boost_targeting_note && (
                    <div style={{ marginTop: 10, background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 10, padding: 10 }}>
                      <div style={{ fontSize: 12, color: "#a855f7", fontWeight: 800, marginBottom: 5, display: "flex", alignItems: "center", gap: 5 }}>
                        <Sparkles size={12} /> {t("اختار الذكاء الاصطناعي هذا الاستهداف", "The AI chose this targeting")}
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.8, color: c.text }}>{editPost.boost_targeting_note}</div>
                      {editPost.boost_targeting && (
                        <div style={{ fontSize: 11, color: c.muted, marginTop: 7, lineHeight: 1.8 }}>
                          {t("العمر", "Age")}: {editPost.boost_targeting.ageMin}–{editPost.boost_targeting.ageMax}
                          {" · "}{t("الجنس", "Gender")}: {editPost.boost_targeting.gender === "female" ? t("إناث", "Women") : editPost.boost_targeting.gender === "male" ? t("ذكور", "Men") : t("الجميع", "All")}
                          <br />
                          {t("المدن", "Cities")}: {(editPost.boost_targeting.cities || []).map((x) => x.name).join("، ") || t("كل ليبيا", "All Libya")}
                          {editPost.boost_targeting.citiesFromOwner ? ` (${t("اخترتها أنت", "your choice")})` : ""}
                          <br />
                          {t("الاهتمامات", "Interests")}: {(editPost.boost_targeting.interests || []).map((x) => x.name).join("، ") || "—"}
                        </div>
                      )}
                    </div>
                  )}
                  {targetMsg && <div style={{ fontSize: 12, color: "#f59e0b", marginTop: 8, lineHeight: 1.6 }}>{targetMsg}</div>}
                </div>
              )}
            </div>
            {/* Auto-reply settings for this post */}
            {(() => {
              const rc: ReplyConfig = editPost.reply_config || { enabled: true };
              const on = rc.enabled !== false;
              const setRC = (patch: Partial<ReplyConfig>) => setEditPost({ ...editPost, reply_config: { ...rc, ...patch } });
              return (
                <div style={{ background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
                  <button type="button" onClick={() => setRC({ enabled: !on })} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: rtl ? "right" : "left", padding: 0 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: on ? "linear-gradient(135deg,#16a34a,#4ade80)" : c.surface, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><MessageSquareReply size={15} color={on ? "#fff" : c.muted} /></div>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 800, color: on ? "#16a34a" : c.text }}>{t("الرد الآلي على هذا المنشور", "Auto-reply on this post")}</div>
                    <div style={{ width: 40, height: 23, borderRadius: 100, background: on ? "#16a34a" : c.border, position: "relative", flexShrink: 0 }}><div style={{ position: "absolute", top: 3, insetInlineStart: on ? 20 : 3, width: 17, height: 17, borderRadius: "50%", background: "#fff" }} /></div>
                  </button>
                  {!botInfo?.subscribed && (
                    <div style={{ marginTop: 10, fontSize: 12, color: "#f59e0b", lineHeight: 1.6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ flex: 1, minWidth: 140 }}>{t("بوت الرد غير مفعّل لهذه الصفحة.", "The reply bot isn't active for this Page.")}</span>
                      <button onClick={() => router.push("/bot")} style={{ background: G_HERO, border: "none", borderRadius: 9, padding: "6px 12px", color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{t("تفعيل البوت", "Set up bot")}</button>
                    </div>
                  )}
                  {on && (
                    <div style={{ marginTop: 12 }}>
                      <Field muted={c.muted} label={t("ردود عامة (تعليق) — رد في كل سطر، يُختار عشوائياً", "Public replies (comment) — one per line, chosen at random")}>
                        <textarea rows={2} style={{ ...input, background: c.bg, resize: "vertical" }} value={(rc.public_replies || []).join("\n")} onChange={(e) => setRC({ public_replies: e.target.value.split("\n") })} placeholder={t("شكراً لتفاعلك 🌸\nراسلناك على الخاص ✅", "Thanks! 🌸\nWe messaged you privately ✅")} />
                      </Field>
                      <Field muted={c.muted} label={t("رسالة خاصة (Messenger)", "Private message (Messenger)")}>
                        <textarea rows={2} style={{ ...input, background: c.bg, resize: "vertical" }} value={rc.private_reply || ""} onChange={(e) => setRC({ private_reply: e.target.value })} placeholder={t("أهلاً! سعر المنتج ... والتوصيل متاح 🚚", "Hi! The price is … and we deliver 🚚")} />
                      </Field>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                        <span style={{ fontSize: 12.5, color: c.muted, display: "inline-flex", alignItems: "center", gap: 6 }}><ThumbsUp size={13} /> {t("إعجاب تلقائي بالتعليق", "Auto-like the comment")}</span>
                        <button type="button" onClick={() => setRC({ like: !(rc.like ?? botInfo?.likeComments ?? false) })} style={{ width: 40, height: 23, borderRadius: 100, background: (rc.like ?? botInfo?.likeComments) ? "#16a34a" : c.border, position: "relative", border: "none", cursor: "pointer", flexShrink: 0 }}><div style={{ position: "absolute", top: 3, insetInlineStart: (rc.like ?? botInfo?.likeComments) ? 20 : 3, width: 17, height: 17, borderRadius: "50%", background: "#fff" }} /></button>
                      </div>
                      {/* AI status */}
                      <div style={{ fontSize: 12, color: c.dim, marginBottom: 10, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        {botInfo?.aiEnabled ? <span style={{ color: "#16a34a", fontWeight: 700 }}>✓ {t("ردود الذكاء الاصطناعي مفعّلة (للأسئلة غير المتوقعة، بالأسعار من الكتالوج)", "AI replies on (for unusual questions, prices from your catalog)")}</span>
                          : <span>{t("ردود الذكاء الاصطناعي معطّلة.", "AI replies are off.")} <button onClick={() => router.push("/bot")} style={{ background: "none", border: "none", color: PINK, cursor: "pointer", fontWeight: 700, fontFamily: "inherit", padding: 0 }}>{t("تفعيلها", "Enable")}</button></span>}
                      </div>
                      {/* Linked account switcher */}
                      {botInfo && botInfo.tokens.length > 0 && (
                        <div>
                          <label style={{ fontSize: 11.5, color: c.muted, display: "block", marginBottom: 5 }}>{t("الحساب المربوط للرد (بدّله إذا حدث حظر)", "Linked reply account (switch if blocked)")}</label>
                          <select value={botInfo.activeTokenId || ""} onChange={(e) => setActiveToken(e.target.value)} style={{ ...input, background: c.bg }}>
                            {botInfo.tokens.map((tk) => <option key={tk.id} value={tk.id}>{tk.label}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button onClick={() => savePost({ caption: editPost.caption, hashtags: editPost.hashtags, cta: editPost.cta, scheduled_for: editPost.scheduled_for, boost: editPost.boost, boost_budget_usd: editPost.boost_budget_usd, boost_days: editPost.boost_days, reply_config: editPost.reply_config })} disabled={savingPost} style={{ flex: 1, background: G_HERO, border: "none", borderRadius: 13, padding: "13px 0", color: "#fff", fontWeight: 900, fontSize: 15, cursor: "pointer", opacity: savingPost ? 0.7 : 1, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {savingPost ? <Loader2 size={16} className="spin" /> : <Save size={16} />} {t("حفظ", "Save")}
              </button>
              <button onClick={() => deletePlanPost(editPost.id)} style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 13, padding: "13px 16px", color: "#ef4444", cursor: "pointer", fontFamily: "inherit" }}><Trash2 size={16} /></button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk boost modal */}
      {showBulkBoost && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowBulkBoost(false); }} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12, direction: rtl ? "rtl" : "ltr" }}>
          <div style={{ background: c.bg, color: c.text, width: "100%", maxWidth: 440, borderRadius: 22, padding: 20, fontFamily: "Cairo,sans-serif" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontWeight: 900, fontSize: 16, display: "inline-flex", alignItems: "center", gap: 8 }}><DollarSign size={18} color="#f0b429" /> {t(`تمويل ${selectedPlanPosts.size} منشوراً`, `Boost ${selectedPlanPosts.size} posts`)}</div>
              <button onClick={() => setShowBulkBoost(false)} style={{ background: "none", border: "none", color: c.muted, cursor: "pointer" }}><X size={20} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
              <Field muted={c.muted} label={t("الميزانية اليومية ($)", "Daily budget ($)")}><input type="number" min={1} style={input} value={bbBudget} onChange={(e) => setBbBudget(e.target.value)} /></Field>
              <Field muted={c.muted} label={t("المدة (أيام)", "Days")}><input type="number" min={1} max={30} style={input} value={bbDays} onChange={(e) => setBbDays(e.target.value)} /></Field>
            </div>
            <p style={{ fontSize: 11.5, color: c.dim, lineHeight: 1.7, margin: "0 0 12px" }}>
              {t("تُحفظ خطة التمويل على هذه المنشورات، ويُنفّذها الموظف تلقائياً بمجرد نشر المنشور (عند تفعيل النشر التلقائي). يمكنك أيضاً تمويلها يدوياً الآن من واجهة الإعلانات بعد نشرها.", "The boost plan is saved on these posts and runs automatically once the post is published (when auto-publish is enabled). You can also boost manually now from the Ads section after publishing.")}
            </p>
            <button onClick={applyBulkBoost} disabled={savingBoost} style={{ width: "100%", background: "linear-gradient(135deg,#f0b429,#ff9d2f)", border: "none", borderRadius: 13, padding: "13px 0", color: "#1a1330", fontWeight: 900, fontSize: 15, cursor: "pointer", opacity: savingBoost ? 0.7 : 1, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {savingBoost ? <Loader2 size={16} className="spin" /> : <DollarSign size={16} />} {t("تفعيل التمويل", "Set boost")}
            </button>
          </div>
        </div>
      )}

      <AdsBottomNav />
      <style>{`@keyframes spin-anim{to{transform:rotate(360deg)}}.spin{animation:spin-anim 1s linear infinite}`}</style>
    </div>
  );
}
