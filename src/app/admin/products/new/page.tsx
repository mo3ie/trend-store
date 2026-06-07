"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, ArrowRight, Save, Plus, Trash2 } from "lucide-react";

const categories = ["هواتف", "لابتوبات", "بلايستيشن", "إكسسوارات"];

type Variant = { name: string; options: string[] };

export default function NewProduct() {
  const router = useRouter();
  const [name,        setName]        = useState("");
  const [description, setDescription] = useState("");
  const [price,       setPrice]       = useState("");
  const [stock,       setStock]       = useState("");
  const [category,    setCategory]    = useState(categories[0]);
  const [images,      setImages]      = useState<File[]>([]);
  const [previews,    setPreviews]    = useState<string[]>([]);
  const [variants,    setVariants]    = useState<Variant[]>([]);
  const [varInput,    setVarInput]    = useState("");   // new variant group name
  const [optInputs,   setOptInputs]   = useState<Record<number, string>>({});
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

  function handleImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    setImages(prev => [...prev, ...files]);
    setPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
  }
  function removeImage(i: number) {
    setImages(prev => prev.filter((_, j) => j !== i));
    setPreviews(prev => prev.filter((_, j) => j !== i));
  }

  function addVariantGroup() {
    const n = varInput.trim();
    if (!n) return;
    if (variants.some(v => v.name === n)) return;
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

    const imageUrls: string[] = [];
    for (const file of images) {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok || !d.url) { setError("فشل رفع الصورة: " + (d.error || "خطأ")); setSaving(false); return; }
      imageUrls.push(d.url);
    }

    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, description,
        price: parseFloat(price),
        stock: parseInt(stock),
        category,
        image_url: imageUrls[0] || null,
        images: imageUrls,
        variants: variants.length > 0 ? variants : [],
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError("فشل حفظ المنتج: " + (data.error || "خطأ")); setSaving(false); return; }
    router.push("/admin/products");
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 transition-colors">
          <ArrowRight size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">إضافة منتج جديد</h1>
          <p className="text-gray-500 text-sm">أضف بيانات المنتج وصوره وخياراته</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5">

        {/* ─── Basic Info ─── */}
        <div className="bg-[#0f1320] border border-purple-500/20 rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-gray-400 text-sm mb-1.5 block">اسم المنتج *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="مثال: iPhone 15 Pro" className="input-field" required />
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-1.5 block">الوصف</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="وصف المنتج..." rows={3} className="input-field resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-sm mb-1.5 block">السعر (د.ل) *</label>
              <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" className="input-field" required />
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-1.5 block">الكمية *</label>
              <input type="number" min="0" value={stock} onChange={e => setStock(e.target.value)} placeholder="0" className="input-field" required />
            </div>
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-1.5 block">التصنيف *</label>
            <div className="flex gap-2 flex-wrap">
              {categories.map(cat => (
                <button key={cat} type="button" onClick={() => setCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${category === cat ? "bg-purple-600 text-white shadow-[0_0_12px_rgba(168,85,247,0.4)]" : "bg-black/30 border border-purple-500/20 text-gray-400 hover:text-white"}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Images ─── */}
        <div className="bg-[#0f1320] border border-purple-500/20 rounded-2xl p-6">
          <label className="text-gray-400 text-sm mb-3 block">الصور</label>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-purple-500/30 rounded-xl p-6 cursor-pointer hover:border-purple-500/60 transition-colors">
            <Upload size={24} className="text-purple-400 mb-2" />
            <span className="text-sm text-gray-400">اضغط لرفع الصور</span>
            <span className="text-xs text-gray-600 mt-0.5">PNG, JPG حتى 5MB</span>
            <input type="file" accept="image/*" multiple onChange={handleImages} className="hidden" />
          </label>
          {previews.length > 0 && (
            <div className="grid grid-cols-4 gap-3 mt-4">
              {previews.map((src, i) => (
                <div key={i} className="relative group">
                  <img src={src} className="w-full aspect-square object-cover rounded-xl border border-white/10" />
                  <button type="button" onClick={() => removeImage(i)} className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── Variants ─── */}
        <div className="bg-[#0f1320] border border-purple-500/20 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white text-sm">خيارات المنتج</h3>
              <p className="text-gray-500 text-xs mt-0.5">مثال: اللون، الذاكرة، المقاس...</p>
            </div>
            <span className="text-xs text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-lg">{variants.length} مجموعة</span>
          </div>

          {/* Add variant group */}
          <div className="flex gap-2">
            <input
              type="text"
              value={varInput}
              onChange={e => setVarInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addVariantGroup())}
              placeholder="اسم الخيار (مثل: اللون)"
              className="input-field flex-1"
            />
            <button type="button" onClick={addVariantGroup} className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors flex items-center gap-1.5 shrink-0">
              <Plus size={15} /> إضافة
            </button>
          </div>

          {/* Variant groups */}
          {variants.map((variant, gi) => (
            <div key={gi} className="border border-purple-500/20 rounded-xl p-4 space-y-3 bg-black/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                  <span className="font-semibold text-white text-sm">{variant.name}</span>
                  <span className="text-xs text-gray-500">({variant.options.length} خيار)</span>
                </div>
                <button type="button" onClick={() => removeVariantGroup(gi)} className="text-red-400 hover:text-red-300 p-1 rounded-lg hover:bg-red-500/10 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Options */}
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

              {/* Add option */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={optInputs[gi] || ""}
                  onChange={e => setOptInputs(prev => ({ ...prev, [gi]: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addOption(gi))}
                  placeholder={`أضف خياراً لـ "${variant.name}"`}
                  className="input-field flex-1 text-sm"
                />
                <button type="button" onClick={() => addOption(gi)} className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-colors">
                  <Plus size={14} />
                </button>
              </div>
            </div>
          ))}

          {variants.length === 0 && (
            <p className="text-gray-600 text-sm text-center py-3">لا توجد خيارات — المنتج بدون variants</p>
          )}
        </div>

        {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">⚠️ {error}</p>}

        <button type="submit" disabled={saving}
          className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-500 hover:shadow-[0_0_24px_rgba(168,85,247,0.5)] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save size={17} /> حفظ المنتج</>}
        </button>
      </form>

      <style>{`.input-field { width: 100%; padding: 10px 14px; border-radius: 12px; background: rgba(0,0,0,0.4); border: 1px solid rgba(168,85,247,0.2); color: white; font-size: 14px; outline: none; transition: border-color 0.2s; } .input-field:focus { border-color: rgba(168,85,247,0.6); }`}</style>
    </div>
  );
}
