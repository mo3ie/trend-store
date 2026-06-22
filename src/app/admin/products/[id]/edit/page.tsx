"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Upload, X, ArrowRight, Save, Plus, Trash2 } from "lucide-react";

const categories = ["هواتف", "لابتوبات", "بلايستيشن", "إكسسوارات"];

type Variant = { name: string; options: string[] };

export default function EditProduct() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [name,           setName]           = useState("");
  const [description,    setDescription]    = useState("");
  const [price,          setPrice]          = useState("");
  const [stock,          setStock]          = useState("");
  const [category,       setCategory]       = useState(categories[0]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newFiles,       setNewFiles]       = useState<File[]>([]);
  const [newPreviews,    setNewPreviews]    = useState<string[]>([]);
  const [variants,       setVariants]       = useState<Variant[]>([]);
  const [varInput,       setVarInput]       = useState("");
  const [optInputs,      setOptInputs]      = useState<Record<number, string>>({});
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState("");

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data?.error) { setError("فشل تحميل بيانات المنتج"); setLoading(false); return; }
        setName(data.name || "");
        setDescription(data.description || "");
        setPrice(String(data.price ?? ""));
        setStock(String(data.stock ?? ""));
        setCategory(data.category || categories[0]);
        setExistingImages(data.images?.length ? data.images : data.image_url ? [data.image_url] : []);
        setVariants(Array.isArray(data.variants) ? data.variants : []);
        setLoading(false);
      })
      .catch(() => { setError("فشل تحميل بيانات المنتج"); setLoading(false); });
  }, [id]);

  function handleNewImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    setNewFiles(prev => [...prev, ...files]);
    setNewPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
  }
  function removeExisting(i: number) { setExistingImages(prev => prev.filter((_, j) => j !== i)); }
  function removeNew(i: number) {
    setNewFiles(prev => prev.filter((_, j) => j !== i));
    setNewPreviews(prev => prev.filter((_, j) => j !== i));
  }

  function addVariantGroup() {
    const n = varInput.trim();
    if (!n || variants.some(v => v.name === n)) return;
    setVariants(prev => [...prev, { name: n, options: [] }]);
    setVarInput("");
  }
  function removeVariantGroup(i: number) {
    setVariants(prev => prev.filter((_, j) => j !== i));
    setOptInputs(prev => { const c = { ...prev }; delete c[i]; return c; });
  }
  function addOption(gi: number) {
    const val = (optInputs[gi] || "").trim();
    if (!val) return;
    setVariants(prev => prev.map((v, i) => i === gi ? { ...v, options: [...v.options, val] } : v));
    setOptInputs(prev => ({ ...prev, [gi]: "" }));
  }
  function removeOption(gi: number, oi: number) {
    setVariants(prev => prev.map((v, i) => i === gi ? { ...v, options: v.options.filter((_, j) => j !== oi) } : v));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name || !price || !stock) { setError("يرجى ملء جميع الحقول المطلوبة"); return; }
    setSaving(true);

    const uploadedUrls: string[] = [];
    for (const file of newFiles) {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok || !d.url) { setError("فشل رفع الصورة: " + (d.error || "خطأ")); setSaving(false); return; }
      uploadedUrls.push(d.url);
    }

    const allImages = [...existingImages, ...uploadedUrls];

    const res = await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, description,
        price: parseFloat(price),
        stock: parseInt(stock),
        category,
        image_url: allImages[0] || null,
        images: allImages,
        variants: variants.length > 0 ? variants : [],
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError("فشل تحديث المنتج: " + (data.error || "خطأ")); setSaving(false); return; }
    router.push("/admin/products");
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <span className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[var(--muted)] transition-colors">
          <ArrowRight size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">تعديل المنتج</h1>
          <p className="text-[var(--muted-2)] text-sm">عدّل بيانات المنتج وصوره وخياراته</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5">

        {/* ─── Basic Info ─── */}
        <div className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-[var(--muted)] text-sm mb-1.5 block">اسم المنتج *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="مثال: iPhone 15 Pro" className="input-field" required />
          </div>
          <div>
            <label className="text-[var(--muted)] text-sm mb-1.5 block">الوصف</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="وصف المنتج..." rows={3} className="input-field resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[var(--muted)] text-sm mb-1.5 block">السعر (د.ل) *</label>
              <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" className="input-field" required />
            </div>
            <div>
              <label className="text-[var(--muted)] text-sm mb-1.5 block">الكمية *</label>
              <input type="number" min="0" value={stock} onChange={e => setStock(e.target.value)} placeholder="0" className="input-field" required />
            </div>
          </div>
          <div>
            <label className="text-[var(--muted)] text-sm mb-1.5 block">التصنيف *</label>
            <div className="flex gap-2 flex-wrap">
              {categories.map(cat => (
                <button key={cat} type="button" onClick={() => setCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${category === cat ? "bg-purple-600 text-[var(--text)] shadow-[0_0_12px_rgba(168,85,247,0.4)]" : "bg-[var(--input)] border border-purple-500/20 text-[var(--muted)] hover:text-[var(--text)]"}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Images ─── */}
        <div className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl p-6">
          <label className="text-[var(--muted)] text-sm mb-3 block">الصور</label>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-purple-500/30 rounded-xl p-6 cursor-pointer hover:border-purple-500/60 transition-colors">
            <Upload size={24} className="text-purple-400 mb-2" />
            <span className="text-sm text-[var(--muted)]">اضغط لإضافة صور</span>
            <span className="text-xs text-[var(--muted-2)] mt-0.5">PNG, JPG حتى 5MB</span>
            <input type="file" accept="image/*" multiple onChange={handleNewImages} className="hidden" />
          </label>
          {(existingImages.length > 0 || newPreviews.length > 0) && (
            <div className="grid grid-cols-4 gap-3 mt-4">
              {existingImages.map((src, i) => (
                <div key={`ex-${i}`} className="relative group">
                  <img src={src} className="w-full aspect-square object-cover rounded-xl border border-[var(--border)]" />
                  <button type="button" onClick={() => removeExisting(i)} className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                </div>
              ))}
              {newPreviews.map((src, i) => (
                <div key={`new-${i}`} className="relative group">
                  <img src={src} className="w-full aspect-square object-cover rounded-xl border border-purple-500/30" />
                  <button type="button" onClick={() => removeNew(i)} className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── Variants ─── */}
        <div className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-[var(--text)] text-sm">خيارات المنتج</h3>
              <p className="text-[var(--muted-2)] text-xs mt-0.5">مثال: اللون، الذاكرة، المقاس...</p>
            </div>
            <span className="text-xs text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-lg">{variants.length} مجموعة</span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={varInput}
              onChange={e => setVarInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addVariantGroup())}
              placeholder="اسم الخيار (مثل: اللون)"
              className="input-field flex-1"
            />
            <button type="button" onClick={addVariantGroup} className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-[var(--text)] text-sm font-medium transition-colors flex items-center gap-1.5 shrink-0">
              <Plus size={15} /> إضافة
            </button>
          </div>

          {variants.map((variant, gi) => (
            <div key={gi} className="border border-purple-500/20 rounded-xl p-4 space-y-3 bg-black/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                  <span className="font-semibold text-[var(--text)] text-sm">{variant.name}</span>
                  <span className="text-xs text-[var(--muted-2)]">({variant.options.length} خيار)</span>
                </div>
                <button type="button" onClick={() => removeVariantGroup(gi)} className="text-red-400 hover:text-red-300 p-1 rounded-lg hover:bg-red-500/10 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
              {variant.options.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {variant.options.map((opt, oi) => (
                    <span key={oi} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 text-sm">
                      {opt}
                      <button type="button" onClick={() => removeOption(gi, oi)} className="text-purple-400/60 hover:text-red-400 transition-colors">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={optInputs[gi] || ""}
                  onChange={e => setOptInputs(prev => ({ ...prev, [gi]: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addOption(gi))}
                  placeholder={`أضف خياراً لـ "${variant.name}"`}
                  className="input-field flex-1 text-sm"
                />
                <button type="button" onClick={() => addOption(gi)} className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] transition-colors">
                  <Plus size={14} />
                </button>
              </div>
            </div>
          ))}

          {variants.length === 0 && (
            <p className="text-[var(--muted-2)] text-sm text-center py-3">لا توجد خيارات — أضف خيارات للمنتج (اختياري)</p>
          )}
        </div>

        {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">⚠️ {error}</p>}

        <button type="submit" disabled={saving}
          className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-500 hover:shadow-[0_0_24px_rgba(168,85,247,0.5)] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save size={17} /> حفظ التعديلات</>}
        </button>
      </form>

      <style>{`.input-field { width: 100%; padding: 10px 14px; border-radius: 12px; background: rgba(0,0,0,0.4); border: 1px solid rgba(168,85,247,0.2); color: white; font-size: 14px; outline: none; transition: border-color 0.2s; } .input-field:focus { border-color: rgba(168,85,247,0.6); }`}</style>
    </div>
  );
}
