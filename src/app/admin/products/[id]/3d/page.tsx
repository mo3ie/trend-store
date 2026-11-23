"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowRight, Upload, Film, Images, Wand2, Box, Save, Trash2, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const Spin360 = dynamic(() => import("@/components/three/Spin360"), { ssr: false });
const Model3D = dynamic(() => import("@/components/three/Model3D"), { ssr: false });

type Product = { id: string; name: string; image_url?: string; images?: string[]; spin_images?: string[]; model_url?: string | null };

/* ── Image processing (all in the browser) ─────────────────────── */

const MAX = 900;

function toCanvas(src: CanvasImageSource, w: number, h: number) {
  const k = Math.min(1, MAX / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext("2d", { willReadFrequently: true })!.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/**
 * Background removal for products shot on a plain backdrop: the backdrop
 * colour is read from the image border, then a flood fill from the edges
 * clears every connected pixel close to it, with a soft feathered edge.
 */
function removeBackground(c: HTMLCanvasElement, tol: number) {
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const { width: w, height: h } = c;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const border: number[][] = [];
  for (let x = 0; x < w; x += 4) { border.push([x, 0], [x, h - 1]); }
  for (let y = 0; y < h; y += 4) { border.push([0, y], [w - 1, y]); }
  const cols = border.map(([x, y]) => { const i = (y * w + x) * 4; return [d[i], d[i + 1], d[i + 2]]; });
  const med = [0, 1, 2].map((k) => { const v = cols.map((c) => c[k]).sort((a, b) => a - b); return v[v.length >> 1]; });
  const dist = (i: number) => Math.hypot(d[i] - med[0], d[i + 1] - med[1], d[i + 2] - med[2]);

  const bg = new Uint8Array(w * h);
  const stack: number[] = [];
  for (const [x, y] of border) { const p = y * w + x; if (dist(p * 4) < tol) { bg[p] = 1; stack.push(p); } }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w, y = (p / w) | 0;
    const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
    for (const q of nb) if (q >= 0 && !bg[q] && dist(q * 4) < tol) { bg[q] = 1; stack.push(q); }
  }
  for (let p = 0; p < w * h; p++) {
    if (bg[p]) { d[p * 4 + 3] = 0; continue; }
    // Feather: foreground pixels touching the background fade by colour closeness.
    const x = p % w, y = (p / w) | 0;
    const edge = (x > 0 && bg[p - 1]) || (x < w - 1 && bg[p + 1]) || (y > 0 && bg[p - w]) || (y < h - 1 && bg[p + w]);
    if (edge) d[p * 4 + 3] = Math.min(255, Math.round((dist(p * 4) / (tol * 1.8)) * 255));
  }
  ctx.putImageData(img, 0, 0);
}

const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/webp", 0.86));

async function framesFromVideo(file: File, n: number, onP: (p: number) => void): Promise<HTMLCanvasElement[]> {
  const v = document.createElement("video");
  v.muted = true; v.playsInline = true; v.src = URL.createObjectURL(file);
  await new Promise((r, j) => { v.onloadedmetadata = r; v.onerror = j; });
  const out: HTMLCanvasElement[] = [];
  for (let i = 0; i < n; i++) {
    v.currentTime = (v.duration * i) / n;
    await new Promise((r) => { v.onseeked = r; });
    out.push(toCanvas(v, v.videoWidth, v.videoHeight));
    onP((i + 1) / n);
  }
  URL.revokeObjectURL(v.src);
  return out;
}

async function framesFromImages(files: File[]): Promise<HTMLCanvasElement[]> {
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const out: HTMLCanvasElement[] = [];
  for (const f of sorted) {
    const bmp = await createImageBitmap(f);
    out.push(toCanvas(bmp, bmp.width, bmp.height));
  }
  return out;
}

async function uploadDirect(blob: Blob, name: string): Promise<string> {
  const r = await fetch("/api/upload/signed", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
  const s = await r.json();
  if (!r.ok) throw new Error(s.error || "upload");
  const { error } = await supabase.storage.from("products").uploadToSignedUrl(s.path, s.token, blob);
  if (error) throw new Error(error.message);
  return s.publicUrl as string;
}

/* ── Page ─────────────────────────────────────────────────────── */

export default function Product3DStudio() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<Product | null>(null);
  const [frames, setFrames] = useState<string[]>([]);
  const [model, setModel] = useState<string | null>(null);
  const [nFrames, setNFrames] = useState(36);
  const [tol, setTol] = useState(42);
  const [cutBg, setCutBg] = useState(true);
  const [busy, setBusy] = useState("");
  const [prog, setProg] = useState(0);
  const [msg, setMsg] = useState("");
  const [aiState, setAiState] = useState<{ status: string; progress?: number } | null>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const glbRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/products/${id}`).then((r) => r.json()).then((d) => {
      setP(d); setFrames(d.spin_images || []); setModel(d.model_url || null);
    });
  }, [id]);

  const processFrames = async (canvases: HTMLCanvasElement[]) => {
    const urls: string[] = [];
    for (let i = 0; i < canvases.length; i++) {
      setBusy(`معالجة وصورة ${i + 1} من ${canvases.length}…`);
      if (cutBg) removeBackground(canvases[i], tol);
      urls.push(await uploadDirect(await toBlob(canvases[i]), `spin-${id}-${String(i).padStart(2, "0")}.webp`));
      setProg((i + 1) / canvases.length);
    }
    setFrames(urls);
    setMsg("✅ جاهز — راجع الدوران ثم اضغط حفظ");
  };

  const fromVideo = async (f?: File) => {
    if (!f) return;
    setMsg(""); setProg(0);
    try {
      setBusy("استخراج الإطارات من الفيديو…");
      const c = await framesFromVideo(f, nFrames, setProg);
      setProg(0);
      await processFrames(c);
    } catch (e) { setMsg("❌ " + (e instanceof Error ? e.message : "فشل")); }
    setBusy("");
  };
  const fromImages = async (fs?: FileList | null) => {
    if (!fs?.length) return;
    setMsg(""); setProg(0);
    try { setBusy("قراءة الصور…"); await processFrames(await framesFromImages(Array.from(fs).slice(0, 72))); }
    catch (e) { setMsg("❌ " + (e instanceof Error ? e.message : "فشل")); }
    setBusy("");
  };
  const uploadGlb = async (f?: File) => {
    if (!f) return;
    if (!/\.glb$/i.test(f.name)) { setMsg("❌ الملف لازم يكون .glb"); return; }
    setBusy("رفع النموذج…");
    try { setModel(await uploadDirect(f, f.name)); setMsg("✅ النموذج مرفوع — اضغط حفظ"); }
    catch (e) { setMsg("❌ " + (e instanceof Error ? e.message : "فشل")); }
    setBusy("");
  };

  const save = async () => {
    setBusy("حفظ…");
    const r = await fetch(`/api/products/${id}/media`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ spin_images: frames, model_url: model }) });
    const d = await r.json();
    setMsg(r.ok ? "✅ تم الحفظ — المنتج يظهر الآن بالعرض الجديد في المتجر" : "❌ " + (d.error || "فشل الحفظ"));
    setBusy("");
  };

  const startAi = async () => {
    const img = p?.images?.[0] || p?.image_url;
    if (!img) { setMsg("❌ المنتج بدون صورة"); return; }
    setMsg("");
    const r = await fetch(`/api/products/${id}/model`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ imageUrl: img }) });
    const d = await r.json();
    if (!r.ok) { setMsg("❌ " + d.error); return; }
    setAiState({ status: "PENDING", progress: 0 });
  };
  useEffect(() => {
    if (!aiState || ["SUCCEEDED", "FAILED", "CANCELED", "ERROR", "NONE"].includes(aiState.status)) return;
    const t = setTimeout(async () => {
      const r = await fetch(`/api/products/${id}/model`);
      const d = await r.json();
      setAiState({ status: d.status, progress: d.progress });
      if (d.status === "SUCCEEDED") { setModel(d.model_url); setMsg("✅ النموذج ثلاثي الأبعاد جاهز ومحفوظ"); }
      if (d.status === "FAILED" || d.status === "ERROR") setMsg("❌ فشل التوليد — جرّب صورة أوضح بخلفية بسيطة");
    }, 5000);
    return () => clearTimeout(t);
  }, [aiState, id]);

  if (!p) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div dir="rtl" className="p-6 max-w-5xl mx-auto space-y-6 text-[var(--text)]">
      <div className="flex items-center gap-3">
        <a href={`/admin/products/${id}`} className="text-[var(--muted)]"><ArrowRight size={20} /></a>
        <h1 className="text-xl font-bold flex-1">استوديو 3D — {p.name}</h1>
        <button onClick={save} disabled={!!busy} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-500 text-white font-bold disabled:opacity-50"><Save size={17} /> حفظ</button>
      </div>
      {(busy || msg) && (
        <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3 text-sm">
          {busy ? <span className="flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> {busy}</span> : msg}
          {busy && prog > 0 && <div className="h-1.5 rounded bg-white/10 mt-2"><div className="h-full rounded bg-purple-500" style={{ width: `${prog * 100}%` }} /></div>}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* 360 */}
        <section className="rounded-2xl border border-purple-500/20 bg-[var(--surface)] p-5 space-y-4">
          <h2 className="font-bold flex items-center gap-2"><Images size={18} /> عرض 360°</h2>
          <p className="text-sm text-[var(--muted)] leading-7">صوّر المنتج وهو يدور على قاعدة دوّارة (أو دوّر حوله) بخلفية سادة بيضاء/رمادية. ارفع <b>فيديو</b> (10–20 ثانية للفة كاملة) أو <b>صور مرتبة</b> (24–36 صورة). الخلفية تنقص تلقائياً.</p>
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-2">عدد الإطارات
              <select value={nFrames} onChange={(e) => setNFrames(Number(e.target.value))} className="bg-black/20 rounded-lg px-2 py-1">{[24, 36, 48, 72].map((n) => <option key={n}>{n}</option>)}</select>
            </label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={cutBg} onChange={(e) => setCutBg(e.target.checked)} /> قص الخلفية</label>
            {cutBg && <label className="flex items-center gap-2">الحساسية <input type="range" min={15} max={90} value={tol} onChange={(e) => setTol(Number(e.target.value))} /> {tol}</label>}
          </div>
          <div className="flex gap-3">
            <button disabled={!!busy} onClick={() => vidRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-purple-500/30 hover:bg-purple-500/10"><Film size={17} /> من فيديو</button>
            <button disabled={!!busy} onClick={() => imgRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-purple-500/30 hover:bg-purple-500/10"><Upload size={17} /> من صور</button>
          </div>
          <input ref={vidRef} type="file" accept="video/*" hidden onChange={(e) => fromVideo(e.target.files?.[0])} />
          <input ref={imgRef} type="file" accept="image/*" multiple hidden onChange={(e) => fromImages(e.target.files)} />
          <div className="aspect-square rounded-2xl bg-white overflow-hidden">
            {frames.length ? <Spin360 frames={frames} alt={p.name} /> : <div className="h-full grid place-items-center text-gray-400 text-sm">لا يوجد عرض 360 بعد</div>}
          </div>
          {frames.length > 0 && <button onClick={() => setFrames([])} className="text-sm text-red-400 flex items-center gap-1"><Trash2 size={14} /> حذف عرض 360</button>}
        </section>

        {/* 3D */}
        <section className="rounded-2xl border border-purple-500/20 bg-[var(--surface)] p-5 space-y-4">
          <h2 className="font-bold flex items-center gap-2"><Box size={18} /> مجسّم ثلاثي الأبعاد + AR</h2>
          <p className="text-sm text-[var(--muted)] leading-7">الزبون يدوّره ويقرّب، ويقدر يشوفه <b>في مكانه</b> بالواقع المعزز (آيفون وأندرويد). ارفع ملف <b>.glb</b>، أو ولّده بالذكاء الاصطناعي من صورة المنتج.</p>
          <div className="flex gap-3">
            <button disabled={!!busy} onClick={() => glbRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-purple-500/30 hover:bg-purple-500/10"><Upload size={17} /> رفع .glb</button>
            <button disabled={!!busy || (!!aiState && !["SUCCEEDED", "FAILED", "ERROR", "NONE"].includes(aiState.status))} onClick={startAi} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold disabled:opacity-50"><Wand2 size={17} /> توليد بالذكاء</button>
          </div>
          <input ref={glbRef} type="file" accept=".glb,model/gltf-binary" hidden onChange={(e) => uploadGlb(e.target.files?.[0])} />
          {aiState && !["SUCCEEDED", "FAILED", "ERROR", "NONE"].includes(aiState.status) && (
            <p className="text-sm flex items-center gap-2"><Sparkles size={15} className="text-cyan-400" /> جاري التوليد… {aiState.progress ?? 0}% (يأخذ 2–5 دقائق)</p>
          )}
          <div className="aspect-square rounded-2xl bg-gradient-to-b from-white to-slate-200 overflow-hidden relative">
            {model ? <Model3D src={model} poster={p.image_url} alt={p.name} /> : <div className="h-full grid place-items-center text-gray-400 text-sm">لا يوجد مجسّم بعد</div>}
          </div>
          {model && <button onClick={() => setModel(null)} className="text-sm text-red-400 flex items-center gap-1"><Trash2 size={14} /> إزالة المجسّم</button>}
        </section>
      </div>
    </div>
  );
}
