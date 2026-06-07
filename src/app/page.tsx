"use client";

import { useState, useRef, useEffect } from "react";
import {
  Home as HomeIcon,
  ShoppingCart,
  Wrench,
  Laptop,
  Gamepad2,
  Globe,
  Smartphone,
  Megaphone,
  Package,
  Heart,
  Wallet,
  Settings,
  Menu,
  User,
  Clock,
  Headphones,
  MapPin,
  Phone,
  LogOut,
  ChevronDown,
  ArrowLeft,
  Search,
  X,
} from "lucide-react";

type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  image_url?: string;
};
import HeroSlider from "@/components/HeroSlider";
import NotificationBell from "@/components/NotificationBell";
import WalletModal from "@/components/WalletModal";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";

const categories = [
  { title: "هواتف",           sub: "PHONES",          icon: Smartphone,  href: "/products?category=هواتف"      },
  { title: "لابتوبات",        sub: "LAPTOPS",         icon: Laptop,      href: "/products?category=لابتوبات"   },
  { title: "بلايستيشن",      sub: "PLAYSTATION",     icon: Gamepad2,    href: "/products?category=بلايستيشن"  },
  { title: "خدمات إلكترونية", sub: "E-SERVICES",      icon: Globe,       href: "/products"                     },
  { title: "طلب من المواقع", sub: "ONLINE SHOPPING", icon: ShoppingCart, href: "https://order.trendstore-ly.com" },
  { title: "إعلانات",         sub: "MARKETING",       icon: Megaphone,   href: "/products"                     },
];

const services = [
  { title: "صيانة الأجهزة",  desc: "إصلاح احترافي لجميع الأجهزة الإلكترونية",    icon: Wrench      },
  { title: "خدمات رقمية",   desc: "اشتراكات وخدمات رقمية متنوعة بأفضل الأسعار", icon: Globe       },
  { title: "إكسسوارات",      desc: "ملحقات أصلية لجميع أنواع الأجهزة",            icon: Headphones  },
  { title: "بيع الأجهزة",   desc: "أحدث الأجهزة الإلكترونية بضمان رسمي",        icon: Smartphone  },
];

const navTop = [
  { label: "الرئيسية",          icon: HomeIcon,    href: undefined },
  { label: "طلب شي ان",         icon: ShoppingCart, href: "https://order.trendstore-ly.com" },
  { label: "متجر الإلكترونيات", icon: Smartphone,  href: "/products" },
  { label: "الصيانة",           icon: Wrench,      href: undefined },
  { label: "خدمات رقمية",      icon: Megaphone,   href: undefined },
];

const navBottom = [
  { label: "تتبع طلبك", icon: Package,  href: "/orders"              },
  { label: "المفضلة",   icon: Heart,    href: undefined               },
  { label: "محفظتي",    icon: Wallet,   href: undefined               },
  { label: "الإعدادات", icon: Settings, href: "/account?tab=settings" },
];

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [desktopSearch, setDesktopSearch] = useState("");
  const [walletOpen, setWalletOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, signOut } = useAuth();
  const { count } = useCart();

  useEffect(() => {
    fetch("/api/products?limit=100")
      .then((r) => r.json())
      .then((data) => setAllProducts(Array.isArray(data) ? data : []));
  }, []);

  const activeQuery = desktopSearch || searchQuery;
  const products = activeQuery.trim()
    ? allProducts.filter(p =>
        p.name.toLowerCase().includes(activeQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(activeQuery.toLowerCase())
      )
    : allProducts.slice(0, 8);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ─── shared content blocks ───────────────────────────────────────────────

  const CategoriesGrid = ({ cols }: { cols: string }) => (
    <div className={`grid ${cols} gap-4`}>
      {categories.map((cat, i) => {
        const Icon = cat.icon;
        const isExternal = cat.href.startsWith("http");
        return (
          <a
            key={i}
            href={cat.href}
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noopener noreferrer" : undefined}
            className="category-card"
          >
            <Icon size={32} className="icon gradient-icon" />
            <h3>{cat.title}</h3>
            <p>{cat.sub}</p>
          </a>
        );
      })}
    </div>
  );

  const ProductsGrid = ({ cols }: { cols: string }) => (
    <div className={`grid ${cols} gap-4`}>
      {products.map((product) => (
        <a
          key={product.id}
          href={`/products/${product.id}`}
          className="group bg-[#0f1320] border border-purple-500/20 rounded-2xl overflow-hidden hover:border-purple-500/50 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)] transition-all"
        >
          <div className="aspect-square bg-black/30 overflow-hidden">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-purple-400/20">
                <Package size={36} />
              </div>
            )}
          </div>
          <div className="p-3 space-y-1.5">
            <span className="text-xs text-purple-400/70">{product.category}</span>
            <p className="text-sm font-semibold text-white leading-tight line-clamp-2">{product.name}</p>
            <div className="flex items-center justify-between pt-1">
              <span className="font-black text-base bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                {product.price} د
              </span>
              <span className={`text-xs font-medium ${product.stock === 0 ? "text-red-400" : product.stock < 5 ? "text-yellow-400" : "text-green-400"}`}>
                {product.stock === 0 ? "نفد" : product.stock < 5 ? `${product.stock} متبقي` : "متوفر"}
              </span>
            </div>
          </div>
        </a>
      ))}
    </div>
  );

  // =========================================================================
  // DESKTOP LAYOUT — unchanged, pixel-perfect
  // =========================================================================
  const DesktopLayout = () => (
    <div className="hidden md:flex bg-[#0b0f1a] text-white min-h-screen">

      {/* ═══════════════════════════════ SIDEBAR ═══════════════════════════════ */}
      <div
        className={`${
          sidebarOpen ? "w-64 px-6" : "w-[70px] px-3"
        } flex flex-col py-6 border-r border-purple-500/20 min-h-screen shrink-0 transition-all duration-300 overflow-hidden`}
      >
          <div className={`mb-8 ${!sidebarOpen ? "text-center" : ""}`}>
            <h1 className="text-2xl font-black tracking-widest bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent leading-tight">
              {sidebarOpen ? "TREND" : "T"}
            </h1>
            {sidebarOpen && (
              <p className="text-xs text-gray-500 mt-0.5">ترند للإلكترونيات</p>
            )}
          </div>

          <nav className="space-y-1 flex-1">
            {navTop.map(({ label, icon: Icon, href }, i) => {
              const cls = `flex items-center py-2.5 rounded-xl text-gray-300 hover:text-purple-300 hover:bg-purple-500/10 cursor-pointer transition-all ${sidebarOpen ? "gap-3 px-3" : "justify-center px-0"}`;
              if (href) {
                const isExternal = href.startsWith("http");
                return (
                  <a key={i} href={href} target={isExternal ? "_blank" : undefined} rel={isExternal ? "noopener noreferrer" : undefined} title={!sidebarOpen ? label : undefined} className={cls}>
                    <Icon size={18} className="shrink-0" />
                    {sidebarOpen && <span className="text-sm">{label}</span>}
                  </a>
                );
              }
              return (
                <div key={i} title={!sidebarOpen ? label : undefined} className={cls}>
                  <Icon size={18} className="shrink-0" />
                  {sidebarOpen && <span className="text-sm">{label}</span>}
                </div>
              );
            })}

            <div className="border-t border-purple-500/15 my-4" />

            {navBottom.map(({ label, icon: Icon, href }, i) => {
              const cls = `flex items-center py-2.5 rounded-xl text-gray-300 hover:text-purple-300 hover:bg-purple-500/10 cursor-pointer transition-all ${sidebarOpen ? "gap-3 px-3" : "justify-center px-0"}`;
              if (label === "محفظتي") return (
                <button key={i} onClick={() => user ? setWalletOpen(true) : (window.location.href="/login")} title={!sidebarOpen ? label : undefined} className={cls}>
                  <Icon size={18} className="shrink-0" />
                  {sidebarOpen && <span className="text-sm">{label}</span>}
                </button>
              );
              if (href) return (
                <a key={i} href={href} title={!sidebarOpen ? label : undefined} className={cls}>
                  <Icon size={18} className="shrink-0" />
                  {sidebarOpen && <span className="text-sm">{label}</span>}
                </a>
              );
              return (
                <div key={i} title={!sidebarOpen ? label : undefined} className={cls}>
                  <Icon size={18} className="shrink-0" />
                  {sidebarOpen && <span className="text-sm">{label}</span>}
                </div>
              );
            })}
          </nav>

          {sidebarOpen && (
            <div className="mt-6 p-4 rounded-2xl bg-purple-900/25 border border-purple-500/30">
              <div className="flex items-center gap-2 mb-1.5">
                <Clock size={15} className="text-purple-400" />
                <span className="text-sm font-bold text-purple-300">دعم 24/7</span>
              </div>
              <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                فريقنا جاهز لمساعدتك في أي وقت
              </p>
              <button className="w-full py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-purple-600 to-blue-500 text-white transition-all hover:shadow-[0_0_18px_rgba(168,85,247,0.55)]">
                تواصل معنا
              </button>
            </div>
          )}
      </div>

      {/* ═══════════════════════════════ MAIN ═══════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0">

        <header className="flex items-center gap-4 px-6 py-3.5 border-b border-purple-500/20 sticky top-0 bg-[#0b0f1a]/90 backdrop-blur-md z-40">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-purple-400 transition-colors shrink-0">
            <Menu size={22} />
          </button>

          {user ? (
            <div className="relative shrink-0" ref={dropdownRef}>
              <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-gray-300 hover:text-purple-300 transition-all">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xs font-black">
                  {(user.user_metadata?.full_name?.[0] || user.email?.[0] || "؟").toUpperCase()}
                </div>
                <span className="text-sm font-medium max-w-[80px] truncate">
                  {user.user_metadata?.full_name?.split(" ")[0] || user.email?.split("@")[0]}
                </span>
                <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {dropdownOpen && (
                <div className="absolute top-full mt-2 right-0 w-44 bg-[#0f1320] border border-purple-500/30 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] overflow-hidden z-50">
                  {[
                    { label: "حسابي",    icon: User,    href: "/account"  },
                    { label: "طلباتي",   icon: Package, href: "/account?tab=shein" },
                    { label: "المفضلة",  icon: Heart,   href: "/account?tab=favorites" },
                  ].map(({ label, icon: Icon, href }) => (
                    <a key={label} href={href} className="flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-purple-300 hover:bg-purple-500/10 transition-colors">
                      <Icon size={15} />
                      {label}
                    </a>
                  ))}
                  <div className="border-t border-purple-500/15" />
                  <button onClick={signOut} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                    <LogOut size={15} />
                    تسجيل الخروج
                  </button>
                </div>
              )}
            </div>
          ) : (
            <a href="/login" className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-gray-300 hover:text-purple-300 transition-all shrink-0">
              <User size={18} />
              <span className="text-sm font-medium">تسجيل الدخول</span>
            </a>
          )}

          <div className="flex items-center gap-3 text-gray-400 shrink-0">
            {user && <NotificationBell />}
            <a href="/cart" className="relative hover:text-purple-400 transition-colors">
              <ShoppingCart size={20} />
              {count > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-purple-500 rounded-full text-[10px] font-black text-white flex items-center justify-center">
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </a>
          </div>

          <div className="flex-1 relative">
            <div className="relative">
              <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <input
                value={desktopSearch}
                onChange={(e) => setDesktopSearch(e.target.value)}
                placeholder="ابحث عن منتج أو تصنيف..."
                className="w-full px-4 py-2.5 pr-9 rounded-xl bg-black/40 border border-purple-500/20 text-sm focus:outline-none focus:border-purple-500/50 transition-colors placeholder:text-gray-500"
              />
              {desktopSearch && (
                <button onClick={() => setDesktopSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                  <X size={14} />
                </button>
              )}
            </div>
            {desktopSearch && products.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[#0f1320] border border-purple-500/30 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
                {products.slice(0, 8).map(p => (
                  <a key={p.id} href={`/products/${p.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-purple-500/10 transition-colors border-b border-white/5 last:border-b-0">
                    {p.image_url
                      ? <img src={p.image_url} alt="" className="w-9 h-9 rounded-lg object-cover" />
                      : <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center"><Package size={14} className="text-purple-400/40" /></div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{p.name}</p>
                      <p className="text-xs text-purple-400">{p.price} د</p>
                    </div>
                  </a>
                ))}
                {products.length > 8 && (
                  <a href={`/products?search=${encodeURIComponent(desktopSearch)}`}
                    className="block px-4 py-2.5 text-xs text-purple-400 hover:text-purple-300 text-center hover:bg-purple-500/10 transition-colors">
                    عرض كل النتائج ({products.length}) →
                  </a>
                )}
              </div>
            )}
            {desktopSearch && products.length === 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[#0f1320] border border-purple-500/30 rounded-xl shadow-2xl px-4 py-3 text-gray-500 text-sm text-center">
                لا توجد نتائج لـ "{desktopSearch}"
              </div>
            )}
          </div>
        </header>

        <div className="p-6 space-y-6 overflow-y-auto">
          <HeroSlider />
          <CategoriesGrid cols="grid-cols-2 md:grid-cols-3 lg:grid-cols-6" />

          {(products.length > 0 || desktopSearch) && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">
                  {desktopSearch ? `نتائج البحث عن "${desktopSearch}"` : "أحدث المنتجات"}
                  {desktopSearch && <span className="text-base font-normal text-gray-500 mr-2">({products.length} نتيجة)</span>}
                </h2>
                {!desktopSearch && (
                  <a href="/products" className="flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 transition-colors">
                    عرض الكل <ArrowLeft size={14} />
                  </a>
                )}
              </div>
              {products.length === 0 && desktopSearch ? (
                <div className="text-center py-12 text-gray-500">
                  <Package size={48} className="mx-auto mb-3 opacity-20" />
                  <p>لا توجد نتائج لـ "{desktopSearch}"</p>
                </div>
              ) : (
                <ProductsGrid cols="grid-cols-2 md:grid-cols-3 lg:grid-cols-4" />
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            <div className="shein-wrapper">
              <img src="/images/shein.png" className="shein-bg" alt="shein" />
              <a href="https://order.trendstore-ly.com" target="_blank" className="shein-order-btn">ابدأ الطلب 🛍️</a>
            </div>
            <div className="offer-card">
              <img src="/images/offer.png" alt="عرض اليوم" />
              <button className="offer-btn">% استفد من العرض</button>
            </div>
          </div>

          <div className="relative rounded-2xl border border-purple-500/30 overflow-hidden" style={{ height: "200px" }}>
            <div className="absolute inset-0" style={{ backgroundImage: "url('/images/laptop.png')", backgroundSize: "cover", backgroundPosition: "center" }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <button className="absolute bottom-5 left-5 px-6 py-2.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg font-bold text-sm hover:shadow-[0_0_20px_rgba(168,85,247,0.6)] transition-all">
              اطلب الآن
            </button>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-4 text-purple-300">خدماتنا المميزة</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {services.map((srv, i) => {
                const Icon = srv.icon;
                return (
                  <div key={i} className="p-5 rounded-2xl bg-[#0f1320] border border-purple-500/20 flex flex-col items-center gap-3 text-center hover:border-purple-500/60 hover:shadow-[0_0_20px_rgba(168,85,247,0.18)] transition-all">
                    <div className="w-16 h-16 rounded-2xl bg-purple-500/15 flex items-center justify-center">
                      <Icon size={30} className="text-purple-400" style={{ filter: "drop-shadow(0 0 8px rgba(168,85,247,0.8))" }} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm mb-1">{srv.title}</h3>
                      <p className="text-gray-400 text-xs leading-relaxed">{srv.desc}</p>
                    </div>
                    <button className="mt-auto w-full py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500 transition-all hover:shadow-[0_0_12px_rgba(168,85,247,0.5)]">
                      اطلب الآن
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="w-full rounded-2xl overflow-hidden">
            <img src="/images/features-banner.png" alt="مميزات المتجر" style={{ width: "100%", height: "120px", objectFit: "cover", display: "block" }} />
          </div>

          <footer className="rounded-2xl bg-[#090c16] border border-purple-500/20 p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
              <div>
                <h3 className="text-xl font-bold text-purple-400 mb-2 tracking-widest">TREND STORE</h3>
                <p className="text-gray-400 text-sm leading-relaxed">متجرك الأول للإلكترونيات والخدمات الرقمية في ليبيا</p>
              </div>
              <div>
                <h4 className="font-bold text-purple-300 mb-3 flex items-center gap-2 text-sm">
                  <MapPin size={14} className="text-purple-400" /> فروعنا
                </h4>
                <div className="space-y-3 text-sm text-gray-400">
                  <div>
                    <p className="text-gray-200 font-semibold mb-0.5">بنغازي — قاريونس</p>
                    <p>محلات نادي قاريونس، مقابل مطعم كودو</p>
                  </div>
                  <div>
                    <p className="text-gray-200 font-semibold mb-0.5">الفرع الثاني — بلعون</p>
                    <p>شارع المعهد الصحي</p>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-bold text-purple-300 mb-3 flex items-center gap-2 text-sm">
                  <Phone size={14} className="text-purple-400" /> واتساب
                </h4>
                <div className="space-y-2.5">
                  {["0945798033", "0943579690"].map((num) => (
                    <a key={num} href={`https://wa.me/218${num.slice(1)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-sm text-gray-300 hover:text-green-400 transition-colors">
                      <span className="w-7 h-7 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center text-green-400 text-xs font-bold">W</span>
                      <span dir="ltr">{num}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
            <div className="border-t border-purple-500/15 pt-4 text-center text-xs text-gray-500">
              © 2024 Trend Store — جميع الحقوق محفوظة
            </div>
          </footer>
        </div>
      </div>
    </div>
  );

  // =========================================================================
  // MOBILE LAYOUT — completely separate, no shared JSX with desktop
  // =========================================================================
  const MobileLayout = () => (
    <div className="flex flex-col md:hidden bg-[#0b0f1a] text-white min-h-screen" dir="rtl">

      {/* ── Mobile Top Bar ── */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-purple-500/20 sticky top-0 bg-[#0b0f1a]/95 backdrop-blur-md z-40">
        {/* Logo */}
        <a href="/" className="text-xl font-black tracking-widest bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          TREND
        </a>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {/* Search toggle */}
          <button onClick={() => setMobileSearch(!mobileSearch)} className="text-gray-400 hover:text-purple-400 transition-colors">
            {mobileSearch ? <X size={20} /> : <Search size={20} />}
          </button>
          {/* Notifications */}
          {user && <NotificationBell />}
          {/* Cart */}
          <a href="/cart" className="relative text-gray-400 hover:text-purple-400 transition-colors">
            <ShoppingCart size={20} />
            {count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-purple-500 rounded-full text-[9px] font-black text-white flex items-center justify-center">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </a>
          {/* Account */}
          {user ? (
            <a href="/account" className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-sm font-black">
              {(user.user_metadata?.full_name?.[0] || user.email?.[0] || "؟").toUpperCase()}
            </a>
          ) : (
            <a href="/login" className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <User size={16} />
            </a>
          )}
        </div>
      </header>

      {/* Search bar (expandable) */}
      {mobileSearch && (
        <div className="px-4 py-3 border-b border-purple-500/10 bg-[#0b0f1a] relative z-30">
          <div className="relative">
            <input
              autoFocus
              placeholder="ابحث عن منتج أو تصنيف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-purple-500/30 text-sm text-white focus:outline-none focus:border-purple-500/60 transition-colors placeholder:text-gray-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                <X size={14} />
              </button>
            )}
          </div>
          {searchQuery && products.length > 0 && (
            <div className="mt-2 bg-[#0f1320] border border-purple-500/30 rounded-xl overflow-hidden">
              {products.slice(0, 5).map(p => (
                <a key={p.id} href={`/products/${p.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-purple-500/10 border-b border-white/5 last:border-b-0">
                  {p.image_url
                    ? <img src={p.image_url} alt="" className="w-9 h-9 rounded-lg object-cover" />
                    : <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center"><Package size={14} className="text-purple-400/40" /></div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{p.name}</p>
                    <p className="text-xs text-purple-400">{p.price} د</p>
                  </div>
                </a>
              ))}
            </div>
          )}
          {searchQuery && products.length === 0 && (
            <p className="mt-2 text-center text-gray-600 text-sm py-2">لا توجد نتائج</p>
          )}
        </div>
      )}

      {/* ── Scrollable Content ── */}
      <div className="flex-1 overflow-y-auto pb-20 space-y-5 px-4 py-4">

        {/* Hero Slider */}
        <div className="rounded-2xl overflow-hidden">
          <HeroSlider />
        </div>

        {/* Categories - horizontal scroll */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-purple-300">التصنيفات</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {categories.map((cat, i) => {
              const Icon = cat.icon;
              const isExternal = cat.href.startsWith("http");
              return (
                <a
                  key={i}
                  href={cat.href}
                  target={isExternal ? "_blank" : undefined}
                  rel={isExternal ? "noopener noreferrer" : undefined}
                  className="flex flex-col items-center gap-2 shrink-0 p-3 rounded-2xl bg-[#0f1320] border border-purple-500/20 hover:border-purple-500/50 transition-all min-w-[80px]"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center">
                    <Icon size={20} className="text-purple-400" />
                  </div>
                  <span className="text-[11px] text-center text-gray-300 font-medium leading-tight">{cat.title}</span>
                </a>
              );
            })}
          </div>
        </div>

        {/* Shein banner */}
        <a href="https://order.trendstore-ly.com" target="_blank" className="block rounded-2xl overflow-hidden border border-purple-500/20 hover:border-purple-500/50 transition-all" style={{ background: "linear-gradient(135deg,#1e1b4b,#1e3a5f)" }}>
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-white font-black text-base">طلب من شي إن 🛍️</p>
              <p className="text-gray-400 text-xs mt-0.5">اطلب أي منتج من شي إن وسنوصّله لك</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-2xl">
              🛒
            </div>
          </div>
        </a>

        {/* Products */}
        {products.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-white">أحدث المنتجات</h2>
              <a href="/products" className="text-xs text-purple-400 flex items-center gap-1">
                عرض الكل <ArrowLeft size={12} />
              </a>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {products.map((product) => (
                <a
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="group bg-[#0f1320] border border-purple-500/20 rounded-2xl overflow-hidden hover:border-purple-500/50 transition-all"
                >
                  <div className="aspect-square bg-black/30 overflow-hidden">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-purple-400/20">
                        <Package size={28} />
                      </div>
                    )}
                  </div>
                  <div className="p-2.5 space-y-1">
                    <p className="text-xs font-semibold text-white leading-tight line-clamp-2">{product.name}</p>
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                        {product.price} د
                      </span>
                      <span className={`text-[10px] ${product.stock === 0 ? "text-red-400" : "text-green-400"}`}>
                        {product.stock === 0 ? "نفد" : "متوفر"}
                      </span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Services */}
        <div>
          <h2 className="text-sm font-bold text-purple-300 mb-3">خدماتنا</h2>
          <div className="grid grid-cols-2 gap-3">
            {services.map((srv, i) => {
              const Icon = srv.icon;
              return (
                <div key={i} className="p-4 rounded-2xl bg-[#0f1320] border border-purple-500/20 flex flex-col items-center gap-2 text-center hover:border-purple-500/50 transition-all">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/15 flex items-center justify-center">
                    <Icon size={24} className="text-purple-400" />
                  </div>
                  <h3 className="font-bold text-white text-xs">{srv.title}</h3>
                  <p className="text-gray-500 text-[10px] leading-relaxed">{srv.desc}</p>
                  <button className="w-full py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-blue-600 text-white">
                    اطلب الآن
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="rounded-2xl bg-[#090c16] border border-purple-500/20 p-4 text-center">
          <p className="text-purple-400 font-bold text-sm mb-1">TREND STORE</p>
          <p className="text-gray-500 text-xs">© 2024 — جميع الحقوق محفوظة</p>
          <div className="flex justify-center gap-4 mt-3">
            {["0945798033", "0943579690"].map((num) => (
              <a key={num} href={`https://wa.me/218${num.slice(1)}`} target="_blank" rel="noopener noreferrer" className="text-xs text-green-400 hover:text-green-300 transition-colors" dir="ltr">
                {num}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0b0f1a]/95 border-t border-purple-500/20 backdrop-blur-md z-50 safe-area-inset-bottom">
        <div className="flex items-center justify-around py-2">
          {[
            { label: "الرئيسية", icon: HomeIcon,    href: "/"         },
            { label: "المنتجات", icon: Smartphone,  href: "/products" },
            { label: "السلة",    icon: ShoppingCart, href: "/cart",   badge: count },
            { label: "حسابي",    icon: User,         href: user ? "/account" : "/login" },
          ].map(({ label, icon: Icon, href, badge }) => (
            <a
              key={label}
              href={href}
              className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-gray-500 hover:text-purple-400 transition-colors relative"
            >
              <Icon size={20} />
              {badge ? (
                <span className="absolute -top-0.5 right-2 w-4 h-4 bg-purple-500 rounded-full text-[9px] font-black text-white flex items-center justify-center">
                  {badge > 9 ? "9+" : badge}
                </span>
              ) : null}
              <span className="text-[10px] font-medium">{label}</span>
            </a>
          ))}
          {/* Menu button */}
          <button
            onClick={() => {
              const menu = document.getElementById("mobile-menu-overlay");
              if (menu) menu.classList.toggle("hidden");
            }}
            className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-gray-500 hover:text-purple-400 transition-colors"
          >
            <Menu size={20} />
            <span className="text-[10px] font-medium">القائمة</span>
          </button>
        </div>
      </nav>

      {/* ── Mobile Menu Overlay ── */}
      <div id="mobile-menu-overlay" className="hidden fixed inset-0 z-[60]" onClick={(e) => {
        if (e.target === e.currentTarget) {
          document.getElementById("mobile-menu-overlay")?.classList.add("hidden");
        }
      }}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="absolute bottom-0 left-0 right-0 bg-[#0b0f1a] border-t border-purple-500/20 rounded-t-3xl p-6 space-y-2">
          <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-4" />

          {[...navTop, ...navBottom].map(({ label, icon: Icon, href }, i) => {
            const cls = "flex items-center gap-4 px-4 py-3.5 rounded-2xl text-gray-300 hover:text-purple-300 hover:bg-purple-500/10 cursor-pointer transition-all";
            const closeMenu = () => document.getElementById("mobile-menu-overlay")?.classList.add("hidden");
            if (label === "محفظتي") return (
              <button key={i} onClick={() => { closeMenu(); user ? setWalletOpen(true) : (window.location.href="/login"); }} className={cls + " w-full text-right"}>
                <Icon size={20} />
                <span className="text-sm font-medium">{label}</span>
              </button>
            );
            if (href) {
              const isExternal = href.startsWith("http");
              return (
                <a key={i} href={href} target={isExternal ? "_blank" : undefined} rel={isExternal ? "noopener noreferrer" : undefined} className={cls}
                  onClick={closeMenu}>
                  <Icon size={20} />
                  <span className="text-sm font-medium">{label}</span>
                </a>
              );
            }
            return (
              <div key={i} className={cls} onClick={closeMenu}>
                <Icon size={20} />
                <span className="text-sm font-medium">{label}</span>
              </div>
            );
          })}

          {user && (
            <>
              <div className="border-t border-purple-500/15 my-2" />
              <button onClick={() => { signOut(); document.getElementById("mobile-menu-overlay")?.classList.add("hidden"); }}
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-red-400 hover:bg-red-500/10 transition-all">
                <LogOut size={20} />
                <span className="text-sm font-medium">تسجيل الخروج</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <DesktopLayout />
      <MobileLayout />
      {walletOpen && <WalletModal onClose={() => setWalletOpen(false)} />}
    </>
  );
}
