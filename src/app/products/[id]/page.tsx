"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createPortal } from "react-dom";
import {
  ArrowRight, ShoppingCart, Package, User,
  ChevronLeft, ChevronRight, Tag, CheckCircle, XCircle, Heart, Image as ImageIcon, Rotate3d, Box,
} from "lucide-react";
import dynamic from "next/dynamic";
const Spin360 = dynamic(() => import("@/components/three/Spin360"), { ssr: false });
const Model3D = dynamic(() => import("@/components/three/Model3D"), { ssr: false });
const FloatingProduct = dynamic(() => import("@/components/three/FloatingProduct"), { ssr: false });
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useLang } from "@/hooks/useLang";
import NotificationBell from "@/components/NotificationBell";
import LangToggle from "@/components/LangToggle";

type Variant = { name: string; options: string[] };
type Product = {
  id: string; name: string; description?: string; price: number; stock: number;
  category: string; image_url?: string; images?: string[]; created_at?: string; variants?: Variant[];
  spin_images?: string[]; model_url?: string | null;
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
  const [view, setView] = useState<"photo" | "spin" | "model">("photo");
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

  // Lead with the most impressive view the product has.
  useEffect(() => {
    if (product?.spin_images?.length) setView("spin");
    else if (product?.model_url) setView("model");
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const images = product?.images?.length ? product.images : product?.image_url ? [product.image_url] : [];
  const inStock = (product?.stock ?? 0) > 0;
  // Customers can always add to cart (they never see "sold out"); the owner is gated by real stock.
  const canAdd = isOwner ? inStock : true;

  return (
    <div className="flex flex-col bg-[var(--bg)] text-[var(--text)] min-h-screen" dir={rtl ? "rtl" : "ltr"}>

      <header className="gp-top flex items-center gap-4 px-6 py-3.5 border-b border-purple-500/20 sticky top-0 bg-[var(--glass)] backdrop-blur-md z-40">
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

      <div className="gp-wrap flex-1 w-full">
        {loading ? (
          <div className="flex items-center justify-center h-64"><span className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" /></div>
        ) : !product ? (
          <div className="gp-panel flex flex-col items-center justify-center h-64 gap-4 text-[var(--muted-2)]">
            <Package size={48} className="text-purple-500/30" />
            <p>{t("المنتج غير موجود", "Product not found")}</p>
            <button onClick={() => router.push("/products")} className="gp-btn gp-btn-ghost text-sm">{t("العودة للمتجر", "Back to store")}</button>
          </div>
        ) : (
          <>
            <nav className="gp-crumbs">
              <a href="/">{t("الرئيسية", "Home")}</a>
              <ChevronLeft size={12} className={rtl ? "" : "rotate-180"} />
              <a href={`/products?category=${encodeURIComponent(product.category)}`}>{product.category}</a>
              <ChevronLeft size={12} className={rtl ? "" : "rotate-180"} />
              <span className="truncate max-w-[220px]">{product.name}</span>
            </nav>

            <div className="gp-pdp">
              {/* Stage: the product on a white plate floating in a glass frame */}
              <section className="gp-stage">
                <div className="gp-plate">
                  {view === "spin" && product.spin_images?.length ? (
                    <Spin360 frames={product.spin_images} alt={product.name} />
                  ) : view === "model" && product.model_url ? (
                    <Model3D src={product.model_url} poster={images[0]} alt={product.name} />
                  ) : images.length > 0 ? (
                    <FloatingProduct key={activeImage} src={images[activeImage]} alt={product.name} />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[#8aa0ad] gap-3"><Package size={64} /><span className="text-sm">{t("لا توجد صورة", "No image")}</span></div>
                  )}
                  {view === "photo" && images.length > 1 && (
                    <>
                      <button aria-label="السابق" onClick={() => setActiveImage((p) => (p - 1 + images.length) % images.length)} className="gp-arrow start-3"><ChevronLeft size={18} /></button>
                      <button aria-label="التالي" onClick={() => setActiveImage((p) => (p + 1) % images.length)} className="gp-arrow end-3"><ChevronRight size={18} /></button>
                    </>
                  )}
                  <button onClick={toggleFavorite} disabled={favLoading} className={`gp-fav ${isFav ? "on" : ""}`} aria-label={isFav ? t("إزالة من المفضلة", "Remove from favorites") : t("إضافة للمفضلة", "Add to favorites")}>
                    <Heart size={18} className={isFav ? "fill-current" : ""} />
                  </button>
                </div>
                {(!!product.spin_images?.length || !!product.model_url) && (
                  <div className="gp-modes" role="tablist">
                    <button className={view === "photo" ? "on" : ""} onClick={() => setView("photo")}><ImageIcon size={14} /> {t("الصور", "Photos")}</button>
                    {!!product.spin_images?.length && <button className={view === "spin" ? "on" : ""} onClick={() => setView("spin")}><Rotate3d size={14} /> 360°</button>}
                    {!!product.model_url && <button className={view === "model" ? "on" : ""} onClick={() => setView("model")}><Box size={14} /> 3D · AR</button>}
                  </div>
                )}
                {view === "photo" && images.length > 1 && (
                  <div className="gp-thumbs">
                    {images.map((src, i) => (
                      <button key={i} onClick={() => setActiveImage(i)} className={activeImage === i ? "on" : ""} aria-label={`${i + 1}`}>
                        <img src={src} alt="" />
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {/* Info */}
              <section className="gp-panel gp-info">
                <span className="gp-chip"><Tag size={12} />{product.category}</span>
                <h1 className="gp-title">{product.name}</h1>
                <div className="gp-price">
                  <b>{product.price}</b><span>{t("دينار", "LYD")}</span>
                </div>
                <div className="gp-stock ok"><CheckCircle size={15} />{t("متوفر", "Available")}</div>

                {product.variants && product.variants.length > 0 && (
                  <div className="space-y-4">
                    {product.variants.map((variant) => (
                      <div key={variant.name}>
                        <p className="gp-label">
                          {variant.name}
                          {selectedVars[variant.name] && <b>: {selectedVars[variant.name]}</b>}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {variant.options.map((option) => (
                            <button key={option} onClick={() => setSelectedVars((prev) => ({ ...prev, [variant.name]: option }))}
                              className={`gp-opt ${selectedVars[variant.name] === option ? "on" : ""}`}>
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="gp-actions">
                  <button onClick={handleAddToCart} disabled={!canAdd} className={`gp-btn gp-btn-main ${added ? "done" : ""}`}>
                    {added ? <><CheckCircle size={18} /> {t("تمت الإضافة!", "Added!")}</> : <><ShoppingCart size={18} /> {t("أضف إلى السلة", "Add to cart")}</>}
                  </button>
                  <a href={`https://wa.me/2180945798033?text=${encodeURIComponent(`${t("مرحبا، أريد الاستفسار عن:", "Hello, I'd like to ask about:")} ${product.name}`)}`} target="_blank" rel="noopener noreferrer" className="gp-btn gp-btn-ghost">
                    <span className="text-base">💬</span> {t("استفسر عبر واتساب", "Ask on WhatsApp")}
                  </a>
                </div>

                {product.description && (
                  <div className="gp-desc">
                    <p className="gp-label">{t("وصف المنتج", "Description")}</p>
                    <p>{product.description}</p>
                  </div>
                )}

                <dl className="gp-specs">
                  <div><dt>{t("التصنيف", "Category")}</dt><dd>{product.category}</dd></div>
                  <div><dt>{t("الحالة", "Status")}</dt><dd className="ok">{t("متوفر", "Available")}</dd></div>
                  {product.created_at && (
                    <div><dt>{t("تاريخ الإضافة", "Added on")}</dt><dd>{new Date(product.created_at).toLocaleDateString(rtl ? "ar-EG" : "en-GB", { year: "numeric", month: "long", day: "numeric" })}</dd></div>
                  )}
                </dl>
              </section>
            </div>

            {/* Phone: price + add button stay reachable above the bottom bar.
                Portalled to <body>: the page-transition wrapper animates a transform,
                which would otherwise trap this fixed bar inside the page. (Only renders
                after the client fetch, so there is no server render to mismatch.) */}
            {createPortal(<div className="gp-buybar">
              <div className="gp-buybar-price"><b>{product.price}</b><span>{t("دينار", "LYD")}</span></div>
              <button onClick={handleAddToCart} disabled={!canAdd} className={`gp-btn gp-btn-main ${added ? "done" : ""}`}>
                {added ? <><CheckCircle size={17} /> {t("تمت", "Added")}</> : <><ShoppingCart size={17} /> {t("أضف للسلة", "Add")}</>}
              </button>
            </div>, document.body)}
          </>
        )}
      </div>
    </div>
  );
}
