"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowRight, Pencil, Trash2, Package } from "lucide-react";

type Product = {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  category: string;
  image_url?: string;
  images?: string[];
  created_at?: string;
};

export default function ViewProduct() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then((r) => r.json())
      .then((data) => { setProduct(data); setLoading(false); })
      .catch(() => { setError("فشل تحميل بيانات المنتج"); setLoading(false); });
  }, [id]);

  async function handleDelete() {
    if (!confirm("هل أنت متأكد من حذف هذا المنتج؟")) return;
    setDeleting(true);
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/products");
    else { setDeleting(false); setError("فشل حذف المنتج"); }
  }

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-64">
      <span className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  if (error || !product) return (
    <div className="p-6 text-red-400">{error || "المنتج غير موجود"}</div>
  );

  const images = product.images?.length ? product.images : product.image_url ? [product.image_url] : [];

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 transition-colors">
            <ArrowRight size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold">تفاصيل المنتج</h1>
            <p className="text-gray-500 text-sm">عرض بيانات المنتج الكاملة</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/admin/products/${id}/edit`)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-sm font-medium transition-colors"
          >
            <Pencil size={15} /> تعديل
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium transition-colors disabled:opacity-40"
          >
            {deleting ? <span className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" /> : <Trash2 size={15} />}
            حذف
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Images */}
        <div className="bg-[#0f1320] border border-purple-500/20 rounded-2xl p-4 space-y-3">
          {images.length > 0 ? (
            <>
              <img
                src={images[activeImage]}
                alt={product.name}
                className="w-full aspect-square object-cover rounded-xl border border-white/10"
              />
              {images.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {images.map((src, i) => (
                    <button key={i} type="button" onClick={() => setActiveImage(i)}>
                      <img
                        src={src}
                        className={`w-full aspect-square object-cover rounded-lg border transition-all ${
                          activeImage === i ? "border-purple-500 opacity-100" : "border-white/10 opacity-50 hover:opacity-80"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="w-full aspect-square rounded-xl bg-purple-500/10 border border-purple-500/20 flex flex-col items-center justify-center text-purple-400 gap-2">
              <Package size={40} />
              <span className="text-sm">لا توجد صور</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-4">
          <div className="bg-[#0f1320] border border-purple-500/20 rounded-2xl p-5 space-y-4">
            <div>
              <p className="text-gray-500 text-xs mb-1">اسم المنتج</p>
              <p className="text-white font-bold text-xl">{product.name}</p>
            </div>

            {product.description && (
              <div>
                <p className="text-gray-500 text-xs mb-1">الوصف</p>
                <p className="text-gray-300 text-sm leading-relaxed">{product.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-black/30 rounded-xl p-3">
                <p className="text-gray-500 text-xs mb-1">السعر</p>
                <p className="text-white font-bold text-lg">{product.price} $</p>
              </div>
              <div className="bg-black/30 rounded-xl p-3">
                <p className="text-gray-500 text-xs mb-1">الكمية</p>
                <p className={`font-bold text-lg ${product.stock === 0 ? "text-red-400" : product.stock < 5 ? "text-yellow-400" : "text-green-400"}`}>
                  {product.stock}
                </p>
              </div>
            </div>

            <div>
              <p className="text-gray-500 text-xs mb-1">التصنيف</p>
              <span className="px-3 py-1 rounded-full bg-purple-500/15 text-purple-400 text-sm">
                {product.category}
              </span>
            </div>

            {product.created_at && (
              <div>
                <p className="text-gray-500 text-xs mb-1">تاريخ الإضافة</p>
                <p className="text-gray-400 text-sm">
                  {new Date(product.created_at).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>
            )}
          </div>

          <div className="bg-[#0f1320] border border-purple-500/20 rounded-2xl p-4">
            <p className="text-gray-500 text-xs mb-1">ID</p>
            <p className="text-gray-500 text-xs font-mono break-all">{product.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
