"use client";

import { useState, useEffect } from "react";
import {
  Home as HomeIcon, ShoppingCart, Wrench, Laptop, Gamepad2, Globe, Smartphone,
  Megaphone, Package, Heart, Wallet, Settings, Menu, Search, Sun, Moon,
  Building2, Headphones, Phone, MapPin, ShieldCheck, Truck, RotateCcw, Lock,
  BadgeCheck, MessageCircle, Check, X,
} from "lucide-react";
import WalletModal from "@/components/WalletModal";
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";

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

  const [lang, setLang] = useState<"ar" | "en">("ar");
  const [light, setLight] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [modal, setModal] = useState<null | "maint" | "support" | "soon">(null);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [mForm, setMForm] = useState({ name: "", phone: "", device: "", fault: "" });
  const [mImages, setMImages] = useState<string[]>([]);
  const [mBusy, setMBusy] = useState(false);
  const [mDoneId, setMDoneId] = useState<string | null>(null);

  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const rtl = lang === "ar";

  useEffect(() => {
    try { if (localStorage.getItem("store-lang") === "en") setLang("en"); } catch {}
    setLight(document.documentElement.classList.contains("light"));
    fetch("/api/products?limit=12").then((r) => r.json()).then((d) => setProducts(Array.isArray(d) ? d : []));
    fetch("/api/site-settings").then((r) => r.json()).then((d) => setSettings(d || null)).catch(() => {});
  }, []);

  // settings with sensible fallbacks (everything is admin-editable in /admin/appearance)
  const branches = settings?.branches?.length ? settings.branches : BRANCHES;
  const support = settings?.support_phone || SUPPORT_PHONE;
  const socials = settings?.socials || {};
  const wa = socials.whatsapp || `https://wa.me/218${support.replace(/^0/, "")}`;
  const img = settings?.images || {};

  const toggleLang = () => setLang((l) => { const n = l === "ar" ? "en" : "ar"; try { localStorage.setItem("store-lang", n); } catch {} return n; });
  const toggleTheme = () => { const n = !light; setLight(n); document.documentElement.classList.toggle("light", n); try { localStorage.setItem("theme", n ? "light" : "dark"); } catch {} };
  const addToCart = (p: Product) => addItem({ id: p.id, name: p.name, price: p.price, image_url: p.image_url, stock: p.stock });
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

  const categories = [
    { ar: "هواتف", en: "Phones", sub: "PHONES", icon: Smartphone, href: "/products?category=هواتف" },
    { ar: "لابتوبات", en: "Laptops", sub: "LAPTOPS", icon: Laptop, href: "/products?category=لابتوبات" },
    { ar: "بلايستيشن", en: "PlayStation", sub: "PLAYSTATION", icon: Gamepad2, href: "/products?category=بلايستيشن" },
    { ar: "خدمات رقمية", en: "Digital", sub: "DIGITAL", icon: Globe, href: "/products" },
    { ar: "طلب من المواقع", en: "Order Online", sub: "SHOPPING", icon: ShoppingCart, href: "https://order.trendstore-ly.com" },
    { ar: "إعلانات", en: "Ads", sub: "MARKETING", icon: Megaphone, href: "/ads" },
    { ar: "مواقعنا", en: "Our Sites", sub: "SITES", icon: Building2, href: "/our-sites" },
  ];
  const services = [
    { ar: "صيانة الأجهزة", en: "Device repair", dAr: "إصلاح احترافي بضمان", dEn: "Pro repair, warranted", icon: Wrench, cta: t("احجز صيانة", "Book repair"), onClick: () => setModal("maint") },
    { ar: "الإكسسوارات", en: "Accessories", dAr: "ملحقات أصلية", dEn: "Genuine add-ons", icon: Headphones, cta: t("تصفّح", "Browse"), href: "/products?category=إكسسوارات" },
    { ar: "خدمات رقمية", en: "Digital services", dAr: "اشتراكات وبطاقات", dEn: "Subs & cards", icon: Globe, cta: t("اطلب خدمة", "Request"), onClick: () => setModal("soon") },
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
        <button className="iconbtn menubtn" aria-label="menu" onClick={() => setCollapsed((c) => !c)}><Menu size={20} /></button>
        <div className="brand">
          <span className="logo"><b>T</b></span>
          <span className="names">
            <span className="ar">{t("محل ترند", "Trend Store")}</span>
            <span className="wm en">TREND ELECTRONICS</span>
          </span>
        </div>
        <div className="hide-sm" style={{ position: "relative", flex: "0 1 280px" }}>
          <Search size={16} style={{ position: "absolute", insetInlineStart: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("ابحث عن منتج…", "Search products…")}
            style={{ width: "100%", padding: "10px 36px", borderRadius: 13, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--text)", fontFamily: "inherit", fontSize: 13 }} />
        </div>
        <button className="iconbtn langbtn" onClick={toggleLang}>{lang === "ar" ? "EN" : "ع"}</button>
        <button className="iconbtn" aria-label="theme" onClick={toggleTheme}>{light ? <Moon size={19} /> : <Sun size={19} />}</button>
        {user && <NotificationBell />}
        <a className="iconbtn cartdot" href="/cart" aria-label="cart"><ShoppingCart size={20} />{count > 0 && <i>{count > 9 ? "9+" : count}</i>}</a>
        <a className="iconbtn" href={user ? "/account" : "/login"} aria-label="account"><svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg></a>
      </header>

      <div className="shell">
        <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
          <div className="side-head">
            <span className="logo" style={{ width: 32, height: 32, borderRadius: 10 }}><b style={{ fontSize: 15 }}>T</b></span>
            <span className="ar" style={{ fontWeight: 900, fontSize: 15 }}>{t("محل ترند", "Trend Store")}</span>
            <button className="collapse" aria-label="collapse" onClick={() => setCollapsed((c) => !c)}><svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" style={{ width: 16, height: 16, transform: rtl ? "" : "scaleX(-1)" }}><path d="M9 6l6 6-6 6" /></svg></button>
          </div>
          <div className="side-group">{t("التصفّح", "Browse")}</div>
          <div className="navitem active" onClick={() => go("/")}><HomeIcon size={19} /><span>{t("الرئيسية", "Home")}</span></div>
          <div className="navitem" onClick={() => go("/products")}><Smartphone size={19} /><span>{t("متجر الإلكترونيات", "Electronics")}</span></div>
          <div className="navitem" onClick={() => go("https://order.trendstore-ly.com")}><ShoppingCart size={19} /><span>{t("طلب من شي إن", "Order from Shein")}</span></div>
          <div className="navitem" onClick={() => setModal("maint")}><Wrench size={19} /><span>{t("الصيانة", "Maintenance")}</span></div>
          <div className="navitem" onClick={() => setModal("soon")}><Globe size={19} /><span>{t("خدمات رقمية", "Digital Services")}</span></div>
          <div className="navitem" onClick={() => go("/our-sites")}><Building2 size={19} /><span>{t("مواقعنا", "Our Sites")}</span></div>
          <div className="side-group">{t("حسابي", "My account")}</div>
          <div className="navitem" onClick={() => go("/orders")}><Package size={19} /><span>{t("تتبّع طلبك", "Track order")}</span></div>
          <div className="navitem" onClick={() => go("/account?tab=favorites")}><Heart size={19} /><span>{t("المفضلة", "Favorites")}</span></div>
          <div className="navitem" onClick={() => (user ? setWalletOpen(true) : go("/login"))}><Wallet size={19} /><span>{t("محفظتي", "Wallet")}</span></div>
          <div className="navitem" onClick={() => go("/account?tab=settings")}><Settings size={19} /><span>{t("الإعدادات", "Settings")}</span></div>
          {user && <div className="navitem" onClick={signOut}><svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></svg><span>{t("تسجيل الخروج", "Sign out")}</span></div>}
        </aside>

        <main className="content">
          <section className="hero" style={img.hero ? { backgroundImage: `linear-gradient(120deg, rgba(8,10,18,.80), rgba(8,10,18,.45)), url(${img.hero})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
            <div className="inner">
              <h1>{t("كل ما تحتاجه من عالم التقنية", "Everything you need from the world of tech")}</h1>
              <p>{t("هواتف، لابتوبات، أجهزة وإكسسوارات أصلية — توصيل لكل ليبيا.", "Phones, laptops, devices & genuine accessories — delivery across Libya.")}</p>
              <a className="btn" href="/products">{t("تسوّق الآن", "Shop now")}</a>
            </div>
          </section>

          <section>
            <div className="section-h"><h2>{t("الأقسام", "Categories")}</h2></div>
            <div className="cats" style={{ marginTop: 13 }}>
              {categories.map((c) => { const I = c.icon; return (
                <a key={c.sub} className="cat" href={c.href}><span className="ic"><I size={23} /></span><span>{t(c.ar, c.en)}</span><small>{c.sub}</small></a>
              ); })}
            </div>
          </section>

          <section>
            <div className="section-h"><h2>{t("عروض وخدمات", "Offers & Services")}</h2></div>
            <div className="grid2" style={{ marginTop: 13 }}>
              <a className="card wide" href="/products">
                <div className="thumb">{img.offer ? <img src={img.offer} alt="" /> : <Laptop />}</div>
                <div className="body"><span className="badge">{t("عرض الأسبوع", "Weekly deal")}</span><h3>{t("لابتوبات بخصم يصل 25%", "Laptops up to 25% off")}</h3><span className="btn sm">{t("تسوّق الآن", "Shop now")}</span></div>
              </a>
              <a className="card wide shein" href="https://order.trendstore-ly.com">
                <div className="thumb">{img.shein ? <img src={img.shein} alt="" /> : <ShoppingCart />}</div>
                <div className="body"><span className="badge">{t("حصري", "Exclusive")}</span><h3>{t("اطلب من شي إن إلى ليبيا", "Order Shein to Libya")}</h3><span className="btn sm">{t("ابدأ طلبك", "Start order")}</span></div>
              </a>
            </div>
          </section>

          <section>
            <div className="section-h"><h2>{t("خدماتنا", "Our services")}</h2></div>
            <div className="grid4" style={{ marginTop: 13 }}>
              {services.map((s) => { const I = s.icon; return (
                <div key={s.en} className="card">
                  <div className="thumb tall"><I /></div>
                  <div className="body"><h3>{t(s.ar, s.en)}</h3><p>{t(s.dAr, s.dEn)}</p>
                    <button className="btn sm" onClick={() => (s.onClick ? s.onClick() : go(s.href))}>{s.cta}</button>
                  </div>
                </div>
              ); })}
            </div>
          </section>

          <section className="trust">
            {trust.map((x) => { const I = x.icon; return (
              <div key={x.en} className="t"><span className="ic"><I size={20} /></span><span>{t(x.ar, x.en)}</span></div>
            ); })}
          </section>

          <section className="maint">
            <div className="head"><span className="ic"><Wrench size={23} /></span><h2>{t("منظومة الصيانة المتكاملة", "Integrated maintenance system")}</h2></div>
            <p className="sub">{t("اطلب صيانة جهازك وتابع حالته لحظة بلحظة — وبوابة مستقلة للفنيين.", "Request a repair and track it live — with a dedicated technician portal.")}</p>
            <div className="two">
              <div className="mcard"><h3>{t("للزبون", "For customers")}</h3>
                <ul className="feat">
                  <li><Check size={16} /><span>{t("طلب بالصور ووصف العطل", "Request with photos & fault")}</span></li>
                  <li><Check size={16} /><span>{t("عرض سعر قبل البدء وتتبّع الحالة", "Quote first, live status")}</span></li>
                  <li><Check size={16} /><span>{t("ضمان على الإصلاح", "Repair warranty")}</span></li>
                </ul>
                <button className="btn sm" onClick={() => setModal("maint")}>{t("اطلب صيانة الآن", "Request a repair")}</button>
              </div>
              <div className="mcard"><h3>{t("لفني الصيانة", "For technicians")}</h3>
                <ul className="feat">
                  <li><Check size={16} /><span>{t("بوابة استلام وقبول الطلبات", "Receive & accept jobs")}</span></li>
                  <li><Check size={16} /><span>{t("تحديث الحالة وإرسال السعر", "Update status & quote")}</span></li>
                  <li><Check size={16} /><span>{t("لوحة الأرباح والسجل", "Earnings & history")}</span></li>
                </ul>
                <button className="btn sm ghost" onClick={() => setModal("soon")}>{t("دخول الفنيين", "Technician login")}</button>
              </div>
            </div>
          </section>

          <section>
            <div className="section-h"><h2>{query ? t("نتائج البحث", "Search results") : t("أحدث المنتجات", "Latest products")}</h2><a href="/products">{t("عرض الكل", "View all")}</a></div>
            <div className="grid4" style={{ marginTop: 13 }}>
              {shown.length === 0 && <p style={{ color: "var(--muted)", gridColumn: "1/-1", padding: "20px 0" }}>{t("لا توجد منتجات.", "No products.")}</p>}
              {shown.map((p) => (
                <div key={p.id} className="card">
                  <a className="thumb tall" href={`/products/${p.id}`}>{p.image_url ? <img src={p.image_url} alt={p.name} /> : <Package />}</a>
                  <div className="body"><h3 style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</h3><span className="price">{p.price} {t("د.ل", "LYD")}</span>
                    <button className="btn sm" onClick={() => addToCart(p)}>{t("أضف للسلة", "Add to cart")}</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <footer className="footer">
            <div>
              <div className="row"><span className="logo"><b>T</b></span><div className="names"><div style={{ fontWeight: 900, fontSize: 17 }}>{t("محل ترند", "Trend Store")}</div><div className="wm" style={{ fontSize: 12 }}>TREND ELECTRONICS</div></div></div>
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
