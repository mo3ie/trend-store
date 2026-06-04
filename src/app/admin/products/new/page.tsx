"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, ArrowRight, Save } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const categories = ["هواتف", "لابتوبات", "بلايستيشن", "إكسسوارات"];

export default function NewProduct() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    setImages((prev) => [...prev, ...files]);
    setPreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name || !price || !quantity) {
      setError("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    setSaving(true);

    // رفع الصور
    const imageUrls: string[] = [];
    for (const file of images) {
      const fileName = `${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("product-images").upload(`public/${fileName}`, file);
      if (uploadError) { setError("فشل رفع الصورة"); setSaving(false); return; }
      const { data } = supabase.storage.from("product-images").getPublicUrl(`public/${fileName}`);
      imageUrls.push(data.publicUrl);
    }

    // حفظ المنتج
    const { error: insertError } = await supabase.from("products").insert({
      name,
      description,
      price: parseFloat(price),
      quantity: parseInt(quantity),
      category,
      image_url: imageUrls[0] || null,
      images: imageUrls,
    });

    if (insertError) {
      setError("فشل حفظ المنتج: " + insertError.message);
      setSaving(false);
      return;
    }

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
          <p className="text-gray-500 text-sm">أضف بيانات المنتج وصوره</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <div className="bg-[#0f1320] border border-purple-500/20 rounded-2xl p-6 space-y-4">

          {/* Name */}
          <div>
            <label className="text-gray-400 text-sm mb-1.5 block">اسم المنتج *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: iPhone 15 Pro" className="input-field" required />
          </div>

          {/* Description */}
          <div>
            <label className="text-gray-400 text-sm mb-1.5 block">الوصف</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="وصف المنتج..." rows={3} className="input-field resize-none" />
          </div>

          {/* Price + Quantity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-sm mb-1.5 block">السعر ($) *</label>
              <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className="input-field" required />
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-1.5 block">الكمية *</label>
              <input type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" className="input-field" required />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-gray-400 text-sm mb-1.5 block">التصنيف *</label>
            <div className="flex gap-2 flex-wrap">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    category === cat
                      ? "bg-purple-600 text-white shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                      : "bg-black/30 border border-purple-500/20 text-gray-400 hover:text-white"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Images */}
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
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">⚠️ {error}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-500 hover:shadow-[0_0_24px_rgba(168,85,247,0.5)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save size={17} /> حفظ المنتج</>}
        </button>
      </form>

      <style>{`.input-field { width: 100%; padding: 10px 14px; border-radius: 12px; background: rgba(0,0,0,0.4); border: 1px solid rgba(168,85,247,0.2); color: white; font-size: 14px; outline: none; transition: border-color 0.2s; } .input-field:focus { border-color: rgba(168,85,247,0.6); }`}</style>
    </div>
  );
}
