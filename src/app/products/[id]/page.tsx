"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowRight,
  ShoppingCart,
  Package,
  Bell,
  User,
  ChevronLeft,
  ChevronRight,
  Tag,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";

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

export default function ProductView() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { addItem, count } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then((r) => r.json())
      .then((data) => { setProduct(data?.error ? null : data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  function handleAddToCart() {
    if (!product) return;
    addItem({ id: product.id, name: product.name, price: product.price, image_url: product.image_url, stock: product.stock });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  const images = product?.images?.length
    ? product.images
    : product?.image_url
    ? [product.image_url]
    : [];

  const inStock = (product?.stock ?? 0) > 0;

  return (
    <div className="flex flex-col bg-[#0b0f1a] text-white min-h-screen">

      {/* ─── HEADER ─── */}
      <header className="flex items-center gap-4 px-6 py-3.5 border-b border-purple-500/20 sticky top-0 bg-[#0b0f1a]/90 backdrop-blur-md z-40">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-purple-400 transition-colors shrink-0"
        >
          <ArrowRight size={22} />
        </button>

        <a href="/" className="text-xl font-black tracking-widest bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          TREND
        </a>

        <div className="flex-1">
          <input
            placeholder="ابحث عن منتج..."
            className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-purple-500/20 text-sm focus:outline-none focus:border-purple-500/50 transition-colors placeholder:text-gray-500"
          />
        </div>

        <div className="flex items-center gap-3 text-gray-400 shrink-0">
          <button className="relative hover:text-purple-400 transition-colors">
            <Bell size={20} />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full" />
          </button>
          <a href="/cart" className="relative hover:text-purple-400 transition-colors">
            <ShoppingCart size={20} />
            {count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-purple-500 rounded-full text-[10px] font-black text-white flex items-center justify-center">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </a>
          {user ? (
            <a href="/account" className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-sm font-black">
              {(user.user_metadata?.full_name?.[0] || user.email?.[0] || "؟").toUpperCase()}
            </a>
          ) : (
            <a href="/login" className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-gray-300 hover:text-purple-300 transition-all">
              <User size={16} />
              <span className="text-sm">دخول</span>
            </a>
          )}
        </div>
      </header>

      {/* ─── CONTENT ─── */}
      <div className="flex-1 p-6 max-w-4xl mx-auto w-full">

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <span className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : !product ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-gray-500">
            <Package size={48} className="text-purple-500/30" />
            <p>المنتج غير موجود</p>
            <button onClick={() => router.back()} className="text-purple-400 hover:underline text-sm">العودة للمتجر</button>
          </div>
        ) : (
          <>
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-6">
              <a href="/" className="hover:text-purple-400 transition-colors">الرئيسية</a>
              <ChevronLeft size={12} />
              <span className="text-gray-400">{product.category}</span>
              <ChevronLeft size={12} />
              <span className="text-white truncate max-w-[200px]">{product.name}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

              {/* ─── IMAGES ─── */}
              <div className="space-y-3">
                <div className="relative bg-[#0f1320] border border-purple-500/20 rounded-2xl overflow-hidden aspect-square">
                  {images.length > 0 ? (
                    <img
                      src={images[activeImage]}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-purple-400/40 gap-3">
                      <Package size={64} />
                      <span className="text-sm">لا توجد صورة</span>
                    </div>
                  )}

                  {images.length > 1 && (
                    <>
                      <button
                        onClick={() => setActiveImage((p) => (p - 1 + images.length) % images.length)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        onClick={() => setActiveImage((p) => (p + 1) % images.length)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </>
                  )}
                </div>

                {images.length > 1 && (
                  <div className="grid grid-cols-5 gap-2">
                    {images.map((src, i) => (
                      <button key={i} onClick={() => setActiveImage(i)}>
                        <img
                          src={src}
                          className={`w-full aspect-square object-cover rounded-xl border-2 transition-all ${
                            activeImage === i
                              ? "border-purple-500 opacity-100"
                              : "border-white/10 opacity-50 hover:opacity-80"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ─── INFO ─── */}
              <div className="space-y-5">
                {/* Category */}
                <div className="flex items-center gap-2">
                  <Tag size={13} className="text-purple-400" />
                  <span className="text-xs text-purple-400 font-medium">{product.category}</span>
                </div>

                {/* Name */}
                <h1 className="text-2xl font-black text-white leading-tight">{product.name}</h1>

                {/* Price */}
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-black bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                    {product.price}
                  </span>
                  <span className="text-gray-400 text-lg mb-1">دينار</span>
                </div>

                {/* Stock */}
                <div className={`flex items-center gap-2 text-sm font-medium ${inStock ? "text-green-400" : "text-red-400"}`}>
                  {inStock ? <CheckCircle size={16} /> : <XCircle size={16} />}
                  {inStock
                    ? product.stock < 5
                      ? `متبقي ${product.stock} فقط`
                      : "متوفر في المخزن"
                    : "نفد من المخزن"}
                </div>

                {/* Description */}
                {product.description && (
                  <div className="bg-[#0f1320] border border-purple-500/15 rounded-2xl p-4">
                    <p className="text-gray-400 text-xs font-medium mb-2">وصف المنتج</p>
                    <p className="text-gray-300 text-sm leading-relaxed">{product.description}</p>
                  </div>
                )}

                {/* CTA */}
                <div className="space-y-3 pt-2">
                  <button
                    onClick={handleAddToCart}
                    disabled={!inStock}
                    className={`w-full py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all ${
                      inStock
                        ? added
                          ? "bg-green-600 shadow-[0_0_20px_rgba(34,197,94,0.4)]"
                          : "bg-gradient-to-r from-purple-600 to-blue-500 hover:shadow-[0_0_24px_rgba(168,85,247,0.5)]"
                        : "bg-gray-700 opacity-50 cursor-not-allowed"
                    }`}
                  >
                    {added ? (
                      <><CheckCircle size={18} /> تمت الإضافة!</>
                    ) : (
                      <><ShoppingCart size={18} /> أضف إلى السلة</>
                    )}
                  </button>

                  <a
                    href={`https://wa.me/2180945798033?text=${encodeURIComponent(`مرحبا، أريد الاستفسار عن: ${product.name}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 rounded-2xl font-bold text-white bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 hover:border-green-500/60 flex items-center justify-center gap-2 transition-all text-sm"
                  >
                    <span className="text-base">💬</span> استفسر عبر واتساب
                  </a>
                </div>

                {/* Meta */}
                <div className="border-t border-purple-500/15 pt-4 space-y-2 text-xs text-gray-500">
                  <div className="flex justify-between">
                    <span>التصنيف</span>
                    <span className="text-gray-300">{product.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>الحالة</span>
                    <span className={inStock ? "text-green-400" : "text-red-400"}>
                      {inStock ? "متوفر" : "غير متوفر"}
                    </span>
                  </div>
                  {product.created_at && (
                    <div className="flex justify-between">
                      <span>تاريخ الإضافة</span>
                      <span className="text-gray-300">
                        {new Date(product.created_at).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
