"use client";

import { useState, useEffect } from "react";
import {
  Home as HomeIcon, ShoppingCart, Wrench, Laptop, Gamepad2, Globe, Smartphone,
  Megaphone, Package, Heart, Wallet, Settings, Menu, Search, Sun, Moon,
  Building2, Headphones, Phone, MapPin, ShieldCheck, Truck, RotateCcw, Lock,
  BadgeCheck, MessageCircle, Check, X, MessagesSquare, Music2, Stethoscope, LayoutDashboard, Gift,
} from "lucide-react";
import WalletModal from "@/components/WalletModal";
import DiagnoseShowcase from "@/components/DiagnoseShowcase";
import DailyGift from "@/components/DailyGift";
import PromoBanner from "@/components/PromoBanner";
import SearchBox from "@/components/SearchBox";
import { supabase } from "@/lib/supabaseClient";
import dynamic from "next/dynamic";
const HeroRobot = dynamic(() => import("@/components/holo/HeroRobot"), { ssr: false, loading: () => <div className="g-hero g-hero-bot" /> });
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useLang } from "@/hooks/useLang";

type Product = { id: string; name: string; price: number; stock: number; category: string; image_url?: string };
type Branch = { name: string; phone: string; addrAr: string; addrEn: string };
type SiteSettings = {
  branches?: Branch[];
  support_phone?: string;
  socials?: { whatsapp?: string; facebook?: string; instagram?: string };
  images?: { hero?: string; offer?: string; shein?: string };
};

// Default branches + contact (overridden by /admin/appearance settings at runtime).
const BRANCHES: Branch[] = [
  { name: "قاريونس", phone: "0945798033", addrAr: "بنغازي — قاريونس، محلات نادي قاريونس، مقابل مطعم كودو", addrEn: "Benghazi — Garyounis, Garyounis Club shops, opposite Kudu" },
  { name: "بلعون", phone: "0918621511", addrAr: "بنغازي — بلعون، شارع المعهد الصحي، بجانب مطعم الحويج", addrEn: "Benghazi — Bel'oun, Health Institute St., next to Al-Huwaij" },
];
const SUPPORT_PHONE = "0918621511";

export default function Home() {
  const { user, signOut } = useAuth();
  const { count, addItem } = useCart();

  const { lang, toggle: toggleLang, t, rtl } = useLang();
  const [light, setLight] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [modal, setModal] = useState<null | "maint" | "support" | "soon">(null);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [mForm, setMForm] = useState({ name: "", phone: "", device: "", fault: "" });
  const [mImages, setMImages] = useState<string[]>([]);
  const [mBusy, setMBusy] = useState(false);
  const [mDoneId, setMDoneId] = useState<string | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [pickOff, setPickOff] = useState(0); // Instant Visual carousel offset (UI only)

  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
    fetch("/api/products?limit=12").then((r) => r.json()).then((d) => setProducts(Array.isArray(d) ? d : []));
    try { if (new URLSearchParams(window.location.search).get("repair") === "1") setModal("maint"); } catch {}
    fetch("/api/site-settings").then((r) => r.json()).then((d) => setSettings(d || null)).catch(() => {});
  }, []);

  // Admin/employee accounts get a quick way into the dashboard.
  useEffect(() => {
    if (!user) { setIsStaff(false); return; }
    supabase.from("profiles").select("role").eq("id", user.id).single()
      .then(({ data }) => setIsStaff(data?.role === "admin" || data?.role === "employee"));
  }, [user]);

  // settings with sensible fallbacks (everything is admin-editable in /admin/appearance)
  const branches = settings?.branches?.length ? settings.branches : BRANCHES;
  const support = settings?.support_phone || SUPPORT_PHONE;
  const socials = settings?.socials || {};
  const wa = socials.whatsapp || `https://wa.me/218${support.replace(/^0/, "")}`;
  const img = settings?.images || {};

  const toggleTheme = () => { const n = !light; setLight(n); document.documentElement.classList.toggle("light", n); try { localStorage.setItem("theme", n ? "light" : "dark"); } catch {} };
  // Customers never see stock limits, so the cart doesn't cap them; the owner keeps real caps.
  const isOwner = user?.email === "mo3iemohamed@gmail.com";
  const addToCart = (p: Product) => addItem({ id: p.id, name: p.name, price: p.price, image_url: p.image_url, stock: isOwner ? p.stock : Math.max(p.stock, 999) });
  const go = (href?: string) => { if (href) window.location.href = href; };
  const closeModal = () => { setModal(null); setMDoneId(null); };

  const uploadMaintPhoto = async (file: File) => {
    const fd = new FormData(); fd.append("file", file);
    const r = await fetch("/api/maintenance/upload", { method: "POST", body: fd });
    const d = await r.json();
    if (d.url) setMImages((p) => [...p, d.url].slice(0, 5)); else alert(d.error || "فشل رفع الصورة");
  };
  const submitMaintenance = async () => {
    if (!mForm.phone || !mForm.device) { alert(t("نوع الجهاز ورقم الهاتف مطلوبان", "Device and phone are required")); return; }
    setMBusy(true);
    const res = await fetch("/api/maintenance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...mForm, images: mImages }) });
    const d = await res.json();
    setMBusy(false);
    if (d.success) { setMDoneId(d.id); setMForm({ name: "", phone: "", device: "", fault: "" }); setMImages([]); }
    else alert(d.error || t("فشل إرسال الطلب", "Failed to send"));
  };

  const shown = query.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()) || (p.category || "").toLowerCase().includes(query.toLowerCase()))
    : products.slice(0, 8);

  // Instant Visual stage: the newest product with a photo leads, the next ones rotate in threes.
  const withImg = products.filter((p) => !!p.image_url);
  const pool = withImg;
  const picks = pool.length ? [0, 1, 2].map((i) => pool[(pickOff + i) % pool.length]).filter((p, i, a) => a.findIndex((q) => q.id === p.id) === i) : [];
  const stepPicks = (d: number) => setPickOff((o) => (pool.length ? (o + d * 3 + pool.length * 3) % pool.length : 0));

  const categories = [
    { ar: "هواتف", en: "Phones", sub: "PHONES", icon: Smartphone, href: "/products?category=هواتف" },
    { ar: "لابتوبات", en: "Laptops", sub: "LAPTOPS", icon: Laptop, href: "/products?category=لابتوبات" },
    { ar: "بلايستيشن", en: "PlayStation", sub: "PLAYSTATION", icon: Gamepad2, href: "/products?category=بلايستيشن" },
    { ar: "خدمات رقمية", en: "Digital", sub: "DIGITAL", icon: Globe, href: "/cards" },
    { ar: "سوق المستعمل", en: "Used Market", sub: "USED", icon: ShieldCheck, href: "/market" },
    { ar: "طلب من المواقع", en: "Order Online", sub: "SHOPPING", icon: ShoppingCart, href: "https://order.trendstore-ly.com" },
    { ar: "أدوات فيسبوك", en: "Facebook Tools", sub: "FACEBOOK", icon: MessagesSquare, href: "/facebook" },
    { ar: "أدوات تيك توك", en: "TikTok Tools", sub: "TIKTOK", icon: Music2, href: "/tiktok" },
    { ar: "مواقعنا", en: "Our Sites", sub: "SITES", icon: Building2, href: "/our-sites" },
  ];
  const services = [
    { ar: "افحص جهازك", en: "Check your phone", dAr: "فحص ذكي للأعطال من المتصفح", dEn: "Smart fault scan in your browser", icon: Stethoscope, cta: t("ابدأ الفحص", "Start scan"), href: "/diagnose" },
    { ar: "صيانة الأجهزة", en: "Device repair", dAr: "إصلاح احترافي بضمان", dEn: "Pro repair, warranted", icon: Wrench, cta: t("احجز صيانة", "Book repair"), onClick: () => setModal("maint") },
    { ar: "الإكسسوارات", en: "Accessories", dAr: "ملحقات أصلية", dEn: "Genuine add-ons", icon: Headphones, cta: t("تصفّح", "Browse"), href: "/products?category=إكسسوارات" },
    { ar: "خدمات رقمية", en: "Digital services", dAr: "كروت محلية ودولية", dEn: "Local & intl cards", icon: Globe, cta: t("تصفّح الكروت", "Browse cards"), href: "/cards" },
    { ar: "بيع الأجهزة", en: "Buy devices", dAr: "أحدث الأجهزة بضمان", dEn: "Latest, warranted", icon: Smartphone, cta: t("تصفّح", "Browse"), href: "/products" },
  ];
  const trust = [
    { ar: "دعم فني 24/7", en: "24/7 support", icon: Headphones },
    { ar: "استرجاع سهل", en: "Easy returns", icon: RotateCcw },
    { ar: "دفع آمن", en: "Secure pay", icon: Lock },
    { ar: "توصيل سريع", en: "Fast delivery", icon: Truck },
    { ar: "الثقة والموثوقية", en: "Trusted", icon: ShieldCheck },
    { ar: "ضمان الجودة", en: "Quality", icon: BadgeCheck },
  ];

  return (
    <div className="home2 min-h-screen" dir={rtl ? "rtl" : "ltr"}>

      <header className="topbar">
        <button className="iconbtn menubtn" aria-label="menu" onClick={() => setMenuOpen(true)}><Menu size={20} /></button>
        <div className="brand">
          <img className="brandlogo" src="/brand/trend-logo.png" alt="TREND" />
          <span className="names">
            <span className="ar">{t("محل ترند", "Trend Store")}</span>
            <span className="wm en">TREND ELECTRONICS</span>
          </span>
        </div>
        <div className="hide-sm" style={{ position: "relative", flex: "0 1 340px" }}>
          <SearchBox placeholder={t("ابحث عن منتج أو خدمة…", "Search products or services…")} />
        </div>
        {isStaff && <a className="adminbtn" href="/admin" title={t("لوحة الإدارة", "Admin")}><LayoutDashboard size={18} /><span>{t("الإدارة", "Admin")}</span></a>}
        <button className="iconbtn langbtn" onClick={toggleLang}>{lang === "ar" ? "EN" : "ع"}</button>
        <button className="iconbtn" aria-label="theme" onClick={toggleTheme}>{light ? <Moon size={19} /> : <Sun size={19} />}</button>
        {user && <span className="hide-sm flex"><NotificationBell /></span>}
        <a className="iconbtn cartdot" href="/cart" aria-label="cart" data-cart-icon><ShoppingCart size={20} />{count > 0 && <i>{count > 9 ? "9+" : count}</i>}</a>
        <a className="iconbtn hide-sm" href={user ? "/account" : "/login"} aria-label="account"><svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg></a>
      </header>

      <div className="sbx-mob"><SearchBox placeholder={t("ابحث عن منتج أو خدمة…", "Search products or services…")} /></div>

      <div className="shell">
        {menuOpen && <div className="drawer-overlay" onClick={() => setMenuOpen(false)} />}
        <aside className={`sidebar${collapsed ? " collapsed" : ""}${menuOpen ? " open" : ""}`} onClick={() => setMenuOpen(false)}>
          <div className="side-head">
            <img className="brandlogo" src="/brand/trend-logo.png" alt="" style={{ height: 36 }} />
            <span className="ar" style={{ fontWeight: 900, fontSize: 15 }}>{t("محل ترند", "Trend Store")}</span>
            <button className="collapse" aria-label="collapse" onClick={() => setCollapsed((c) => !c)}><svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" style={{ width: 16, height: 16, transform: rtl ? "" : "scaleX(-1)" }}><path d="M9 6l6 6-6 6" /></svg></button>
          </div>
          <div className="side-group">{t("التصفّح", "Browse")}</div>
          <div className="navitem active" onClick={() => go("/")}><HomeIcon size={19} /><span>{t("الرئيسية", "Home")}</span></div>
          <div className="navitem" onClick={() => go("/products")}><Smartphone size={19} /><span>{t("متجر الإلكترونيات", "Electronics")}</span></div>
          <div className="navitem" onClick={() => go("https://order.trendstore-ly.com")}><ShoppingCart size={19} /><span>{t("طلب من شي إن", "Order from Shein")}</span></div>
          <div className="navitem" onClick={() => setModal("maint")}><Wrench size={19} /><span>{t("الصيانة", "Maintenance")}</span></div>
          <div className="navitem" onClick={() => go("/cards")}><Globe size={19} /><span>{t("الكروت والخدمات الرقمية", "Cards & Digital")}</span></div>
          <div className="navitem" onClick={() => go("/market")}><ShieldCheck size={19} /><span>{t("سوق المستعمل بضمان", "Used Market")}</span></div>
          <div className="navitem" onClick={() => go("/gift")}><Gift size={19} /><span>{t("هدية اليوم", "Daily Gift")}</span></div>
          <div className="navitem" onClick={() => go("/games")}><Gamepad2 size={19} /><span>{t("تحديات وألعاب", "Games")}</span></div>
          <div className="navitem" onClick={() => go("/our-sites")}><Building2 size={19} /><span>{t("مواقعنا", "Our Sites")}</span></div>
          <div className="side-group">{t("حسابي", "My account")}</div>
          <div className="navitem" onClick={() => go("/orders")}><Package size={19} /><span>{t("تتبّع طلبك", "Track order")}</span></div>
          <div className="navitem" onClick={() => go("/account?tab=favorites")}><Heart size={19} /><span>{t("المفضلة", "Favorites")}</span></div>
          <div className="navitem" onClick={() => (user ? setWalletOpen(true) : go("/login"))}><Wallet size={19} /><span>{t("محفظتي", "Wallet")}</span></div>
          <div className="navitem" onClick={() => go("/account?tab=settings")}><Settings size={19} /><span>{t("الإعدادات", "Settings")}</span></div>
          {user && <div className="navitem" onClick={signOut}><svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></svg><span>{t("تسجيل الخروج", "Sign out")}</span></div>}
        </aside>

        <main className="content">
          <section className="g-stage" aria-label={t("اختيارات ترند", "Trend picks")}>
            <HeroRobot />
            <span className="g-arrow" aria-hidden="true"><svg viewBox="0 0 44 30"><path d="M42 15H6M16 5 6 15l10 10" fill="none" stroke="#E8FFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
            <div className="g-picks">
              <div className="g-picks-h">
                <h1>Instant Visual</h1>
                <span>Trend Picks</span>
                <a className="g-pill" href="/products">{t("استكشاف الكل", "Explore all")} <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" style={{ transform: rtl ? "" : "scaleX(-1)" }}><path d="M19 12H5M11 6l-6 6 6 6" /></svg></a>
              </div>
              <div className="g-cards" key={pickOff}>
                {picks.length === 0 && <p style={{ color: "var(--muted)", gridColumn: "1/-1" }}>{t("جاري تحميل المنتجات…", "Loading products…")}</p>}
                {picks.map((p, i) => (
                  <div key={p.id} className={`g-card${i === 1 ? " frost" : ""}`}>
                    <button className="g-add" aria-label={t("أضف للسلة", "Add to cart")} onClick={() => addToCart(p)}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></button>
                    <a className="g-img" href={`/products/${p.id}`}><img src={p.image_url} alt={p.name} /></a>
                    <b>{p.name}</b>
                    <span className="g-price">{p.price} {t("د.ل", "LYD")}</span>
                    {p.category && <span className="g-cat">{p.category}</span>}
                  </div>
                ))}
              </div>
              <div className="g-actions">
                <a className="g-cta" href="/products">{t("تسوّق الآن", "Shop now")}</a>
                {pool.length > 3 && (
                  <span className="g-nav">
                    <button aria-label={t("السابق", "Previous")} onClick={() => stepPicks(-1)}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg></button>
                    <button aria-label={t("التالي", "Next")} onClick={() => stepPicks(1)}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg></button>
                  </span>
                )}
              </div>
            </div>
          </section>

          <DiagnoseShowcase />

          <DailyGift />

          <PromoBanner products={products} />

          <section>
            <div className="section-h"><h2>{t("الأقسام", "Categories")}</h2></div>
            <div className="cats" style={{ marginTop: 13 }}>
              {categories.map((c) => { const I = c.icon; return (
                <a key={c.sub} className="cat" href={c.href}><span className="ic"><I size={23} /></span><span>{t(c.ar, c.en)}</span><small>{c.sub}</small></a>
              ); })}
            </div>
          </section>

          <section>
            <div className="section-h"><h2>{t("خدماتنا", "Our services")}</h2></div>
            <div className="sv-bento">
              {services.map((s, k) => { const I = s.icon; return (
                <button key={s.en} className={`sv ${k === 0 ? "big" : ""}`} onClick={() => (s.onClick ? s.onClick() : go(s.href))}>
                  <span className="sv-ic"><I size={k === 0 ? 26 : 20} /></span>
                  <span className="sv-t"><b>{t(s.ar, s.en)}</b><small>{t(s.dAr, s.dEn)}</small></span>
                  <span className="sv-go">{s.cta} <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg></span>
                </button>
              ); })}
            </div>
          </section>

          <section className="trust">
            {trust.map((x) => { const I = x.icon; return (
              <div key={x.en} className="t"><span className="ic"><I size={20} /></span><span>{t(x.ar, x.en)}</span></div>
            ); })}
          </section>

          <section className="mt2">
            <div className="mt2-head">
              <span className="mt2-ic"><Wrench size={22} /></span>
              <div><h2>{t("منظومة الصيانة المتكاملة", "Integrated maintenance system")}</h2><p>{t("اطلب صيانة جهازك وتابع حالته لحظة بلحظة — وبوابة مستقلة للفنيين.", "Request a repair and track it live — with a dedicated technician portal.")}</p></div>
            </div>
            <div className="mt2-flow">
              {[t("اطلب بالصور ووصف العطل", "Request with photos"), t("عرض سعر قبل البدء", "Quote first"), t("تتبّع الحالة مباشرة", "Live status"), t("استلم بضمان", "Pick up with warranty")].map((x, k) => (
                <div key={k} className="mt2-step"><i>{k + 1}</i><span>{x}</span></div>
              ))}
            </div>
            <div className="mt2-cta">
              <button className="btn" onClick={() => setModal("maint")}>{t("اطلب صيانة الآن", "Request a repair")}</button>
              <button className="btn ghost" onClick={() => setModal("soon")}>{t("دخول الفنيين", "Technician login")}</button>
            </div>
          </section>

          <section>
            <div className="section-h"><h2>{query ? t("نتائج البحث", "Search results") : t("أحدث المنتجات", "Latest products")}</h2><a href="/products">{t("عرض الكل", "View all")}</a></div>
            <div className="lp-grid">
              {shown.length === 0 && <p style={{ color: "var(--muted)", gridColumn: "1/-1", padding: "20px 0" }}>{t("لا توجد منتجات.", "No products.")}</p>}
              {shown.map((p, k) => (
                <div key={p.id} className="lp" style={{ animationDelay: `${k * 0.06}s` }}>
                  <a className="lp-img" href={`/products/${p.id}`}>{p.image_url ? <img src={p.image_url} alt={p.name} loading="lazy" /> : <Package />}</a>
                  <a className="lp-name" href={`/products/${p.id}`}>{p.name}</a>
                  <div className="lp-row">
                    <b>{p.price} <small>{t("د.ل", "LYD")}</small></b>
                    <button className="lp-add" onClick={() => addToCart(p)} aria-label={t("أضف للسلة", "Add to cart")}><ShoppingCart size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <footer className="footer">
            <div>
              <div className="row"><img className="brandlogo" src="/brand/trend-logo.png" alt="TREND" style={{ height: 46, filter: "none" }} /><div className="names"><div style={{ fontWeight: 900, fontSize: 17 }}>{t("محل ترند", "Trend Store")}</div><div className="wm" style={{ fontSize: 12 }}>TREND ELECTRONICS</div></div></div>
              <span className="support-badge"><span className="dot" />{t("دعم فني 24/7", "24/7 support")}</span>
              <p>{t("وجهتك الأولى للإلكترونيات والخدمات الرقمية في ليبيا — جودة موثوقة وخدمة سريعة.", "Your first stop for electronics & digital services in Libya — trusted quality, fast service.")}</p>
              <button className="btn" onClick={() => setModal("support")}>{t("تواصل معنا", "Contact us")}</button>
            </div>
            <div>
              <h4>{t("للتواصل", "Contact")}</h4>
              <div className="contact">
                {branches.map((br, i) => (
                  <a key={i} href={`tel:${br.phone}`}>
                    <span className="ic"><MapPin size={17} /></span>
                    <span><b>{br.name}</b> — {br.phone}<br /><span style={{ color: "var(--muted)", fontSize: 12, fontWeight: 500 }}>{t(br.addrAr, br.addrEn)}</span></span>
                  </a>
                ))}
                <a href={`tel:${support}`}><span className="ic"><Phone size={17} /></span>{t("الدعم", "Support")}: {support}</a>
              </div>
              <div className="socials">
                {socials.facebook && <a className="iconbtn" aria-label="facebook" href={socials.facebook} target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" strokeWidth={2} stroke="currentColor"><path d="M14 8h2V5h-2a3 3 0 0 0-3 3v2H9v3h2v6h3v-6h2l1-3h-3V8a1 1 0 0 1 1-1Z" /></svg></a>}
                {socials.instagram && <a className="iconbtn" aria-label="instagram" href={socials.instagram} target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" strokeWidth={2} stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" /></svg></a>}
                <a className="iconbtn" aria-label="whatsapp" href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} /></a>
              </div>
            </div>
            <div>
              <h4>{t("روابط سريعة", "Quick links")}</h4>
              <div className="contact">
                <a href="/products">{t("متجر الإلكترونيات", "Electronics")}</a>
                <a href="/orders">{t("تتبّع طلبك", "Track order")}</a>
                <a onClick={() => setModal("maint")}>{t("منظومة الصيانة", "Maintenance")}</a>
                <a href="/privacy">{t("سياسة الخصوصية", "Privacy")}</a>
                <a href="/terms">{t("الشروط والأحكام", "Terms")}</a>
              </div>
            </div>
            <div className="copy">© 2026 {t("محل ترند للإلكترونيات — جميع الحقوق محفوظة", "Trend Store — all rights reserved")}</div>
          </footer>
        </main>
      </div>

      <nav className="bottomnav">
        <a className="active" href="/"><HomeIcon size={21} /><span>{t("الرئيسية", "Home")}</span></a>
        <a href="/orders"><Package size={21} /><span>{t("الطلبات", "Orders")}</span></a>
        <a href="/account?tab=favorites"><Heart size={21} /><span>{t("المفضلة", "Saved")}</span></a>
        <a onClick={() => (user ? setWalletOpen(true) : go("/login"))}><Wallet size={21} /><span>{t("المحفظة", "Wallet")}</span></a>
        <a href={user ? "/account" : "/login"}><svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg><span>{t("حسابي", "Account")}</span></a>
      </nav>

      <button className="support-fab" onClick={() => setModal("support")}><MessageCircle size={18} /><span>{t("الدعم", "Support")}</span></button>

      {modal && (
        <div className="h2modal open" onClick={(e) => { if (e.currentTarget === e.target) closeModal(); }}>
          <div className="sheet">
            <button className="iconbtn" style={{ marginInlineStart: "auto", display: "block" }} aria-label="close" onClick={closeModal}><X size={18} /></button>
            {modal === "maint" && (mDoneId ? (<>
              <h3>{t("تم استلام طلبك ✅", "Request received ✅")}</h3>
              <p>{t("سيتواصل معك فنّي الصيانة بعرض سعر قريباً. رقم طلبك:", "A technician will contact you with a quote soon. Your request number:")}</p>
              <div className="field" style={{ textAlign: "center", fontWeight: 800, letterSpacing: 1 }}>{mDoneId.slice(0, 8).toUpperCase()}</div>
              <a className="btn" style={{ width: "100%", justifyContent: "center" }} href={`/maintenance/track?id=${mDoneId}`}>{t("تتبّع حالة الطلب", "Track request")}</a>
            </>) : (<>
              <h3>{t("طلب صيانة", "Request a repair")}</h3>
              <p>{t("عبّئ التفاصيل وأرفق صور العطل — سيصلك عرض سعر قبل البدء.", "Fill in the details and attach fault photos — you'll get a quote before any work starts.")}</p>
              <input className="field" placeholder={t("الاسم", "Name")} value={mForm.name} onChange={(e) => setMForm({ ...mForm, name: e.target.value })} />
              <input className="field" placeholder={t("نوع الجهاز (مثلاً آيفون 13)", "Device (e.g. iPhone 13)")} value={mForm.device} onChange={(e) => setMForm({ ...mForm, device: e.target.value })} />
              <textarea className="field" rows={3} placeholder={t("وصف العطل", "Describe the fault")} value={mForm.fault} onChange={(e) => setMForm({ ...mForm, fault: e.target.value })} />
              <input className="field" placeholder={t("رقم الهاتف", "Phone")} value={mForm.phone} onChange={(e) => setMForm({ ...mForm, phone: e.target.value })} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10, alignItems: "center" }}>
                {mImages.map((u, i) => <img key={i} src={u} alt="" style={{ width: 46, height: 46, borderRadius: 8, objectFit: "cover" }} />)}
                {mImages.length < 5 && (
                  <label style={{ width: 46, height: 46, borderRadius: 8, border: "1px dashed var(--line)", display: "grid", placeItems: "center", cursor: "pointer", color: "var(--muted)" }}>
                    +
                    <input type="file" accept="image/*" className="hidden" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMaintPhoto(f); }} />
                  </label>
                )}
              </div>
              <button className="btn" style={{ width: "100%", justifyContent: "center" }} disabled={mBusy} onClick={submitMaintenance}>{mBusy ? "…" : t("إرسال الطلب", "Send request")}</button>
            </>))}
            {modal === "support" && (<>
              <h3>{t("تواصل معنا", "Contact us")}</h3>
              <p>{t("فريق الدعم جاهز لخدمتك على مدار الساعة.", "Our support team is available around the clock.")}</p>
              <a className="btn" style={{ width: "100%", justifyContent: "center", marginBottom: 10 }} href={wa}>{t("واتساب", "WhatsApp")}: {support}</a>
              <a className="btn ghost" style={{ width: "100%", justifyContent: "center" }} href={`tel:${support}`}>{t("اتصال هاتفي", "Call us")}</a>
            </>)}
            {modal === "soon" && (<>
              <h3>{t("قريباً", "Coming soon")}</h3>
              <p>{t("هذه الميزة قيد الإعداد وستتوفر قريباً.", "This feature is being prepared and will be available soon.")}</p>
            </>)}
          </div>
        </div>
      )}

      {walletOpen && <WalletModal onClose={() => setWalletOpen(false)} />}
    </div>
  );
}
