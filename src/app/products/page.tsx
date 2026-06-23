"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, ShoppingCart, Bell, User, Package, SlidersHorizontal, ArrowRight,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useLang } from "@/hooks/useLang";
import LangToggle from "@/components/LangToggle";

type Product = {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  category: string;
  image_url?: string;
};

// value = the Arabic category stored in the DB (used for filtering); en = label only.
const categories = [
  { value: "الكل", en: "All" },
  { value: "هواتف", en: "Phones" },
  { value: "لابتوبات", en: "Laptops" },
  { value: "بلايستيشن", en: "PlayStation" },
  { value: "إكسسوارات", en: "Accessories" },
];

export default function ProductsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { count } = useCart();
  const { t, rtl } = useLang();

  const sortOptions = [
    { label: t("الأحدث", "Newest"), value: "newest" },
    { label: t("السعر: الأقل", "Price: low"), value: "price_asc" },
    { label: t("السعر: الأعلى", "Price: high"), value: "price_desc" },
  ];

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("الكل");
  const [sort, setSort] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeCategory !== "الكل") params.set("category", activeCategory);
    if (search) params.set("search", search);

    const res = await fetch(`/api/products?${params}`);
    const data = await res.json();
    setProducts(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [activeCategory, search]);

  useEffect(() => {
    const tm = setTimeout(fetchProducts, 300);
    return () => clearTimeout(tm);
  }, [fetchProducts]);

  const sorted = [...products].sort((a, b) => {
    if (sort === "price_asc") return a.price - b.price;
    if (sort === "price_desc") return b.price - a.price;
    return 0;
  });

  return (
    <div className="flex flex-col bg-[var(--bg)] text-[var(--text)] min-h-screen" dir={rtl ? "rtl" : "ltr"}>

      <header className="flex items-center gap-4 px-6 py-3.5 border-b border-purple-500/20 sticky top-0 bg-[var(--glass)] backdrop-blur-md z-40">
        <button onClick={() => router.push("/")} className="text-[var(--muted)] hover:text-purple-400 transition-colors shrink-0">
          <ArrowRight size={22} className={rtl ? "" : "rotate-180"} />
        </button>
        <a href="/" className="text-xl font-black tracking-widest bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent shrink-0">TREND</a>

        <div className="flex-1 relative">
          <Search size={15} className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--muted-2)] pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("ابحث عن منتج...", "Search products...")}
            className="w-full pe-9 ps-4 py-2.5 rounded-xl bg-[var(--input)] border border-purple-500/20 text-sm focus:outline-none focus:border-purple-500/50 transition-colors placeholder:text-[var(--muted-2)]"
          />
        </div>

        <div className="flex items-center gap-3 text-[var(--muted)] shrink-0">
          <LangToggle />
          <a href="/cart" className="relative hover:text-purple-400 transition-colors">
            <ShoppingCart size={20} />
            {count > 0 && (
              <span className="absolute -top-1.5 -end-1.5 w-4 h-4 bg-purple-500 rounded-full text-[10px] font-black text-white flex items-center justify-center">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </a>
          {user ? (
            <a href="/account" className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-sm font-black text-white">
              {(user.user_metadata?.full_name?.[0] || user.email?.[0] || "?").toUpperCase()}
            </a>
          ) : (
            <a href="/login" className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-[var(--muted)] hover:text-purple-300 transition-all">
              <User size={16} />
              <span className="text-sm">{t("دخول", "Sign in")}</span>
            </a>
          )}
        </div>
      </header>

      <div className="p-6 space-y-5 max-w-6xl mx-auto w-full">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">{t("متجر الإلكترونيات", "Electronics Store")}</h1>
            <p className="text-[var(--muted-2)] text-sm mt-0.5">
              {loading ? t("جاري التحميل...", "Loading...") : `${sorted.length} ${t("منتج", "products")}`}
            </p>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
              showFilters ? "bg-purple-600/20 border-purple-500/50 text-purple-300" : "bg-white/5 border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            <SlidersHorizontal size={15} />
            {t("تصفية", "Filters")}
          </button>
        </div>

        <div className={`space-y-3 overflow-hidden transition-all duration-300 ${showFilters ? "max-h-40" : "max-h-12"}`}>
          <div className="flex gap-2 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeCategory === cat.value ? "bg-purple-600 text-white shadow-[0_0_12px_rgba(168,85,247,0.4)]" : "bg-[var(--surface)] border border-purple-500/20 text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                {t(cat.value, cat.en)}
              </button>
            ))}
          </div>

          {showFilters && (
            <div className="flex items-center gap-2">
              <span className="text-[var(--muted-2)] text-xs">{t("ترتيب:", "Sort:")}</span>
              {sortOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSort(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    sort === opt.value ? "bg-blue-600/30 border border-blue-500/50 text-blue-300" : "bg-white/5 border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-[var(--surface)] border border-purple-500/10 rounded-2xl overflow-hidden animate-pulse">
                <div className="aspect-square bg-white/5" />
                <div className="p-3 space-y-2"><div className="h-3 bg-white/5 rounded w-3/4" /><div className="h-3 bg-white/5 rounded w-1/2" /></div>
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-[var(--muted-2)]">
            <Package size={56} className="text-purple-500/20" />
            <p className="text-lg font-medium">{t("لا توجد منتجات", "No products")}</p>
            {(search || activeCategory !== "الكل") && (
              <button onClick={() => { setSearch(""); setActiveCategory("الكل"); }} className="text-purple-400 hover:underline text-sm">
                {t("مسح الفلاتر", "Clear filters")}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {sorted.map((product) => (
              <a key={product.id} href={`/products/${product.id}`} className="group bg-[var(--surface)] border border-purple-500/20 rounded-2xl overflow-hidden hover:border-purple-500/50 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)] transition-all">
                <div className="aspect-square bg-[var(--input)] overflow-hidden">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-purple-400/20"><Package size={40} /></div>
                  )}
                </div>
                <div className="p-3 space-y-1.5">
                  <span className="text-xs text-purple-400/70">{product.category}</span>
                  <p className="text-sm font-semibold text-[var(--text)] leading-tight line-clamp-2">{product.name}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="font-black text-base bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">{product.price} {t("د", "LYD")}</span>
                    <span className={`text-xs font-medium ${product.stock === 0 ? "text-red-400" : product.stock < 5 ? "text-yellow-400" : "text-green-400"}`}>
                      {product.stock === 0 ? t("نفد", "Out") : product.stock < 5 ? `${product.stock} ${t("متبقي", "left")}` : t("متوفر", "In stock")}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
