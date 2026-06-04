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
  Bell,
  User,
  Clock,
  Headphones,
  MapPin,
  Phone,
  LogOut,
  ChevronDown,
} from "lucide-react";
import HeroSlider from "@/components/HeroSlider";
import { useAuth } from "@/hooks/useAuth";

const categories = [
  { title: "هواتف",           sub: "PHONES",          icon: Smartphone  },
  { title: "لابتوبات",        sub: "LAPTOPS",         icon: Laptop      },
  { title: "بلايستيشن",      sub: "PLAYSTATION",     icon: Gamepad2    },
  { title: "خدمات إلكترونية", sub: "E-SERVICES",      icon: Globe       },
  { title: "طلب من المواقع", sub: "ONLINE SHOPPING", icon: ShoppingCart },
  { title: "إعلانات",         sub: "MARKETING",       icon: Megaphone   },
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
  { label: "متجر الإلكترونيات", icon: Smartphone,  href: undefined },
  { label: "الصيانة",           icon: Wrench,      href: undefined },
  { label: "خدمات رقمية",      icon: Megaphone,   href: undefined },
];

const navBottom = [
  { label: "تتبع طلبك", icon: Package  },
  { label: "المفضلة",   icon: Heart    },
  { label: "محفظتي",    icon: Wallet   },
  { label: "الإعدادات", icon: Settings },
];

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, signOut } = useAuth();

  // إغلاق القائمة عند الضغط خارجها
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex bg-[#0b0f1a] text-white min-h-screen">

      {/* ═══════════════════════════════ SIDEBAR ═══════════════════════════════ */}
      <div
        className={`${
          sidebarOpen ? "w-64 px-6" : "w-[70px] px-3"
        } flex flex-col py-6 border-r border-purple-500/20 min-h-screen shrink-0 transition-all duration-300 overflow-hidden`}
      >
          {/* Logo */}
          <div className={`mb-8 ${!sidebarOpen ? "text-center" : ""}`}>
            <h1 className="text-2xl font-black tracking-widest bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent leading-tight">
              {sidebarOpen ? "TREND" : "T"}
            </h1>
            {sidebarOpen && (
              <p className="text-xs text-gray-500 mt-0.5">ترند للإلكترونيات</p>
            )}
          </div>

          {/* Navigation Top */}
          <nav className="space-y-1 flex-1">
            {navTop.map(({ label, icon: Icon, href }, i) => {
              if (href) {
                return (
                  <a key={i} href={href} target="_blank" className="flex gap-2 items-center hover:text-purple-400 cursor-pointer px-3 py-2.5">
                    <ShoppingCart size={18} /> {sidebarOpen && "طلب شي ان"}
                  </a>
                );
              }
              const cls = `flex items-center py-2.5 rounded-xl text-gray-300 hover:text-purple-300 hover:bg-purple-500/10 cursor-pointer transition-all ${sidebarOpen ? "gap-3 px-3" : "justify-center px-0"}`;
              return (
                <div key={i} title={!sidebarOpen ? label : undefined} className={cls}>
                  <Icon size={18} className="shrink-0" />
                  {sidebarOpen && <span className="text-sm">{label}</span>}
                </div>
              );
            })}

            <div className="border-t border-purple-500/15 my-4" />

            {navBottom.map(({ label, icon: Icon }, i) => (
              <div
                key={i}
                title={!sidebarOpen ? label : undefined}
                className={`flex items-center py-2.5 rounded-xl text-gray-300 hover:text-purple-300 hover:bg-purple-500/10 cursor-pointer transition-all ${
                  sidebarOpen ? "gap-3 px-3" : "justify-center px-0"
                }`}
              >
                <Icon size={18} className="shrink-0" />
                {sidebarOpen && <span className="text-sm">{label}</span>}
              </div>
            ))}
          </nav>

          {/* Support Card — visible only when open */}
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

        {/* ─── HEADER BAR ─── */}
        <header className="flex items-center gap-4 px-6 py-3.5 border-b border-purple-500/20 sticky top-0 bg-[#0b0f1a]/90 backdrop-blur-md z-40">

          {/* Menu Button — RIGHT side in RTL, aligned with TREND logo */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-400 hover:text-purple-400 transition-colors shrink-0"
          >
            <Menu size={22} />
          </button>

          {/* Account Button */}
          {user ? (
            <div className="relative shrink-0" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-gray-300 hover:text-purple-300 transition-all"
              >
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
                    <a
                      key={label}
                      href={href}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-purple-300 hover:bg-purple-500/10 transition-colors"
                    >
                      <Icon size={15} />
                      {label}
                    </a>
                  ))}
                  <div className="border-t border-purple-500/15" />
                  <button
                    onClick={signOut}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  >
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

          {/* Notifications + Cart */}
          <div className="flex items-center gap-3 text-gray-400 shrink-0">
            <button className="relative hover:text-purple-400 transition-colors">
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full" />
            </button>
            <button className="hover:text-purple-400 transition-colors">
              <ShoppingCart size={20} />
            </button>
          </div>

          {/* Search */}
          <div className="flex-1">
            <input
              placeholder="ابحث عن منتج..."
              className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-purple-500/20 text-sm focus:outline-none focus:border-purple-500/50 transition-colors placeholder:text-gray-500"
            />
          </div>
        </header>

        {/* ─── CONTENT ─── */}
        <div className="p-6 space-y-6 overflow-y-auto">

          {/* HERO SLIDER */}
          <HeroSlider />

          {/* CATEGORIES */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.map((cat, i) => {
              const Icon = cat.icon;
              return (
                <div key={i} className="category-card">
                  <Icon size={32} className="icon gradient-icon" />
                  <h3>{cat.title}</h3>
                  <p>{cat.sub}</p>
                </div>
              );
            })}
          </div>

          {/* GRID CARDS */}
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

          {/* NEW ARRIVAL */}
          <div
            className="relative rounded-2xl border border-purple-500/30 overflow-hidden"
            style={{ height: "200px" }}
          >
            {/* Image fills the entire box */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: "url('/images/laptop.png')",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            {/* Gradient overlay so button is readable */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            {/* Button — bottom left (screen-left) */}
            <button className="absolute bottom-5 left-5 px-6 py-2.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg font-bold text-sm hover:shadow-[0_0_20px_rgba(168,85,247,0.6)] transition-all">
              اطلب الآن
            </button>
          </div>

          {/* ─── SERVICES ─── */}
          <div>
            <h2 className="text-xl font-bold mb-4 text-purple-300">خدماتنا المميزة</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {services.map((srv, i) => {
                const Icon = srv.icon;
                return (
                  <div
                    key={i}
                    className="p-5 rounded-2xl bg-[#0f1320] border border-purple-500/20 flex flex-col items-center gap-3 text-center hover:border-purple-500/60 hover:shadow-[0_0_20px_rgba(168,85,247,0.18)] transition-all"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-purple-500/15 flex items-center justify-center">
                      <Icon
                        size={30}
                        className="text-purple-400"
                        style={{ filter: "drop-shadow(0 0 8px rgba(168,85,247,0.8))" }}
                      />
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

          {/* ─── FEATURES BAR ─── */}
          <div className="w-full rounded-2xl overflow-hidden">
            <img
              src="/images/features-banner.png"
              alt="مميزات المتجر"
              style={{ width: "100%", height: "120px", objectFit: "cover", display: "block" }}
            />
          </div>

          {/* ─── FOOTER ─── */}
          <footer className="rounded-2xl bg-[#090c16] border border-purple-500/20 p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">

              {/* Brand */}
              <div>
                <h3 className="text-xl font-bold text-purple-400 mb-2 tracking-widest">TREND STORE</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  متجرك الأول للإلكترونيات والخدمات الرقمية في ليبيا
                </p>
              </div>

              {/* Branches */}
              <div>
                <h4 className="font-bold text-purple-300 mb-3 flex items-center gap-2 text-sm">
                  <MapPin size={14} className="text-purple-400" />
                  فروعنا
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

              {/* WhatsApp */}
              <div>
                <h4 className="font-bold text-purple-300 mb-3 flex items-center gap-2 text-sm">
                  <Phone size={14} className="text-purple-400" />
                  واتساب
                </h4>
                <div className="space-y-2.5">
                  {["0945798033", "0943579690"].map((num) => (
                    <a
                      key={num}
                      href={`https://wa.me/218${num.slice(1)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 text-sm text-gray-300 hover:text-green-400 transition-colors"
                    >
                      <span className="w-7 h-7 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center text-green-400 text-xs font-bold">
                        W
                      </span>
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
}
