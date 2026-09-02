"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowRight, ShoppingCart, Package, User,
  ChevronLeft, ChevronRight, Tag, CheckCircle, XCircle, Heart,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useLang } from "@/hooks/useLang";
import NotificationBell from "@/components/NotificationBell";
import LangToggle from "@/components/LangToggle";

type Variant = { name: string; options: string[] };
type Product = {
  id: string; name: string; description?: string; price: number; stock: number;
  category: string; image_url?: string; images?: string[]; created_at?: string; variants?: Variant[];
};

export default function ProductView() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { addItem, count } = useCart();
  const { t, rtl } = useLang();
  // Owner sees true stock (quantities / sold-out); customers only ever see "available".
  const isOwner = user?.email === "mo3iemohamed@gmail.com";

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [added, setAdded] = useState(false);
  const [selectedVars, setSelectedVars] = useState<Record<string, string>>({});
  const [isFav, setIsFav] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then((r) => r.json())
      .then((data) => { setProduct(data?.error ? null : data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;
    fetch("/api/favorites").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setIsFav(data.some((f: { product_id: string }) => f.product_id === id));
    });
  }, [user, id]);

  async function toggleFavorite() {
    if (!user) { router.push("/login"); return; }
    setFavLoading(true);
    await fetch("/api/favorites", {
      method: isFav ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: id }),
    });
    setIsFav(!isFav);
    setFavLoading(false);
  }

  function handleAddToCart() {
    if (!product) return;
    for (const v of product.variants || []) {
      if (!selectedVars[v.name]) { alert(`${t("يرجى اختيار", "Please choose")} ${v.name}`); return; }
    }
    addItem({
      id: product.id, name: product.name, price: product.price, image_url: product.image_url,
      // Customers never see stock limits, so the cart doesn't cap them; the owner keeps real caps.
      stock: isOwner ? product.stock : Math.max(product.stock, 999),
      variants: Object.keys(selectedVars).length > 0 ? selectedVars : undefined,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  const images = product?.images?.length ? product.images : product?.image_url ? [product.image_url] : [];
  const inStock = (product?.stock ?? 0) > 0;
  // Customers can always add to cart (they never see "sold out"); the owner is gated by real stock.
  const canAdd = isOwner ? inStock : true;

  return (
    <div className="flex flex-col bg-[var(--bg)] text-[var(--text)] min-h-screen" dir={rtl ? "rtl" : "ltr"}>

      <header className="flex items-center gap-4 px-6 py-3.5 border-b border-purple-500/20 sticky top-0 bg-[var(--glass)] backdrop-blur-md z-40">
        <button onClick={() => router.back()} className="text-[var(--muted)] hover:text-purple-400 transition-colors shrink-0">
          <ArrowRight size={22} className={rtl ? "" : "rotate-180"} />
        </button>
        <a href="/" className="text-xl font-black tracking-widest bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent shrink-0">TREND</a>
        <div className="flex-1 hidden sm:block">
          <input onClick={() => router.push("/products")} readOnly placeholder={t("ابحث عن منتج...", "Search products...")} className="w-full px-4 py-2.5 rounded-xl bg-[var(--input)] border border-purple-500/20 text-sm focus:outline-none cursor-pointer placeholder:text-[var(--muted-2)]" />
        </div>
        <div className="flex items-center gap-3 text-[var(--muted)] shrink-0">
          <LangToggle />
          <button onClick={toggleFavorite} disabled={favLoading} className={`relative hover:text-purple-400 transition-colors ${isFav ? "text-red-400" : ""}`} title={isFav ? t("إزالة من المفضلة", "Remove from favorites") : t("إضافة للمفضلة", "Add to favorites")}>
            <Heart size={20} className={isFav ? "fill-current" : ""} />
          </button>
          {user && <NotificationBell />}
          <a href="/cart" className="relative hover:text-purple-400 transition-colors">
            <ShoppingCart size={20} />
            {count > 0 && <span className="absolute -top-1.5 -end-1.5 w-4 h-4 bg-purple-500 rounded-full text-[10px] font-black text-white flex items-center justify-center">{count > 9 ? "9+" : count}</span>}
          </a>
          {user ? (
            <a href="/account" className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-sm font-black text-white">
              {(user.user_metadata?.full_name?.[0] || user.email?.[0] || "?").toUpperCase()}
            </a>
          ) : (
            <a href="/login" className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-[var(--muted)] hover:text-purple-300 transition-all">
              <User size={16} /><span className="text-sm">{t("دخول", "Sign in")}</span>
            </a>
          )}
        </div>
      </header>

      <div className="flex-1 p-4 md:p-6 max-w-4xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center h-64"><span className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" /></div>
        ) : !product ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-[var(--muted-2)]">
            <Package size={48} className="text-purple-500/30" />
            <p>{t("المنتج غير موجود", "Product not found")}</p>
            <button onClick={() => router.push("/products")} className="text-purple-400 hover:underline text-sm">{t("العودة للمتجر", "Back to store")}</button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-xs text-[var(--muted-2)] mb-5">
              <a href="/" className="hover:text-purple-400 transition-colors">{t("الرئيسية", "Home")}</a>
              <ChevronLeft size={12} className={rtl ? "" : "rotate-180"} />
              <span className="text-[var(--muted)]">{product.category}</span>
              <ChevronLeft size={12} className={rtl ? "" : "rotate-180"} />
              <span className="text-[var(--text)] truncate max-w-[200px]">{product.name}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              <div className="space-y-3">
                <div className="relative bg-[var(--surface)] border border-purple-500/20 rounded-2xl overflow-hidden aspect-square">
                  {images.length > 0 ? (
                    <img src={images[activeImage]} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-purple-400/40 gap-3"><Package size={64} /><span className="text-sm">{t("لا توجد صورة", "No image")}</span></div>
                  )}
                  {images.length > 1 && (
                    <>
                      <button onClick={() => setActiveImage((p) => (p - 1 + images.length) % images.length)} className="absolute start-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors"><ChevronLeft size={16} /></button>
                      <button onClick={() => setActiveImage((p) => (p + 1) % images.length)} className="absolute end-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors"><ChevronRight size={16} /></button>
                    </>
                  )}
                </div>
                {images.length > 1 && (
                  <div className="grid grid-cols-5 gap-2">
                    {images.map((src, i) => (
                      <button key={i} onClick={() => setActiveImage(i)}>
                        <img src={src} className={`w-full aspect-square object-cover rounded-xl border-2 transition-all ${activeImage === i ? "border-purple-500 opacity-100" : "border-[var(--border)] opacity-50 hover:opacity-80"}`} />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-5">
                <div className="flex items-center gap-2"><Tag size={13} className="text-purple-400" /><span className="text-xs text-purple-400 font-medium">{product.category}</span></div>
                <h1 className="text-2xl font-black text-[var(--text)] leading-tight">{product.name}</h1>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-black bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">{product.price}</span>
                  <span className="text-[var(--muted)] text-lg mb-1">{t("دينار", "LYD")}</span>
                </div>
                <div className={`flex items-center gap-2 text-sm font-medium ${!isOwner || inStock ? "text-green-400" : "text-red-400"}`}>
                  {!isOwner || inStock ? <CheckCircle size={16} /> : <XCircle size={16} />}
                  {!isOwner
                    ? t("متوفر", "Available")
                    : inStock
                      ? (product.stock < 5 ? `${t("متبقي", "Only")} ${product.stock} ${t("فقط", "left")}` : t("متوفر في المخزن", "In stock"))
                      : t("نفذ من المخزن", "Sold out")}
                </div>
                {product.description && (
                  <div className="bg-[var(--surface)] border border-purple-500/15 rounded-2xl p-4">
                    <p className="text-[var(--muted)] text-xs font-medium mb-2">{t("وصف المنتج", "Description")}</p>
                    <p className="text-[var(--muted)] text-sm leading-relaxed">{product.description}</p>
                  </div>
                )}

                {product.variants && product.variants.length > 0 && (
                  <div className="space-y-4">
                    {product.variants.map((variant) => (
                      <div key={variant.name}>
                        <label className="text-[var(--muted)] text-xs font-medium mb-2 flex items-center gap-1.5">
                          {variant.name}
                          {selectedVars[variant.name] && <span className="text-purple-400 font-bold">: {selectedVars[variant.name]}</span>}
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {variant.options.map((option) => {
                            const isSelected = selectedVars[variant.name] === option;
                            return (
                              <button key={option} onClick={() => setSelectedVars((prev) => ({ ...prev, [variant.name]: option }))}
                                className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${isSelected ? "border-purple-500 bg-purple-500/20 text-[var(--text)] shadow-[0_0_12px_rgba(168,85,247,0.4)]" : "border-[var(--border)] bg-white/5 text-[var(--muted)] hover:border-purple-500/40 hover:text-[var(--text)]"}`}>
                                {option}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-3 pt-2">
                  <button onClick={handleAddToCart} disabled={!canAdd}
                    className={`w-full py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all ${canAdd ? (added ? "bg-green-600 shadow-[0_0_20px_rgba(34,197,94,0.4)]" : "bg-gradient-to-r from-purple-600 to-blue-500 hover:shadow-[0_0_24px_rgba(168,85,247,0.5)]") : "bg-gray-700 opacity-50 cursor-not-allowed"}`}>
                    {added ? <><CheckCircle size={18} /> {t("تمت الإضافة!", "Added!")}</> : <><ShoppingCart size={18} /> {t("أضف إلى السلة", "Add to cart")}</>}
                  </button>
                  <a href={`https://wa.me/2180945798033?text=${encodeURIComponent(`${t("مرحبا، أريد الاستفسار عن:", "Hello, I'd like to ask about:")} ${product.name}`)}`} target="_blank" rel="noopener noreferrer"
                    className="w-full py-3 rounded-2xl font-bold text-[var(--text)] bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 hover:border-green-500/60 flex items-center justify-center gap-2 transition-all text-sm">
                    <span className="text-base">💬</span> {t("استفسر عبر واتساب", "Ask on WhatsApp")}
                  </a>
                </div>

                <div className="border-t border-purple-500/15 pt-4 space-y-2 text-xs text-[var(--muted-2)]">
                  <div className="flex justify-between"><span>{t("التصنيف", "Category")}</span><span className="text-[var(--muted)]">{product.category}</span></div>
                  <div className="flex justify-between"><span>{t("الحالة", "Status")}</span><span className={!isOwner || inStock ? "text-green-400" : "text-red-400"}>{!isOwner || inStock ? t("متوفر", "Available") : t("نفذ", "Sold out")}</span></div>
                  {product.created_at && (
                    <div className="flex justify-between"><span>{t("تاريخ الإضافة", "Added on")}</span><span className="text-[var(--muted)]">{new Date(product.created_at).toLocaleDateString(rtl ? "ar-EG" : "en-GB", { year: "numeric", month: "long", day: "numeric" })}</span></div>
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
