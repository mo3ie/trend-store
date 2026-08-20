"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, ShoppingCart, User, Package,
  Trash2, Plus, Minus, ShoppingBag, MapPin, CreditCard, X,
} from "lucide-react";
import dynamic from "next/dynamic";
const MapPicker = dynamic(() => import("@/components/MapPicker"), { ssr: false });
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useLang } from "@/hooks/useLang";
import LangToggle from "@/components/LangToggle";

type UserAddress = {
  id: string;
  label: string;
  address_text: string;
  lat?: number;
  lng?: number;
  is_default: boolean;
};


// يسر باي ومصرفي باي وموبي كاش مخفيّة عن الزبائن حتى الإطلاق الرسمي: تظهر فقط للأدمن
// (للاختبار) أو عند ضبط NEXT_PUBLIC_YUSOR_ENABLED / NEXT_PUBLIC_MASARAFI_ENABLED /
// NEXT_PUBLIC_MOBICASH_ENABLED = true (إطلاق للجميع).
const ADMIN_EMAIL = "mo3iemohamed@gmail.com";

const PAYMENT_METHODS = [
  { id: "cash",     name: "الدفع عند الاستلام",        nameEn: "Cash on delivery",        icon: "💵", color: "#16a34a"                  },
  { id: "yusor",    name: "يسر باي (بطاقة مصرفية)",   nameEn: "Yusor Pay (bank card)",   icon: "💳", color: "#0ea5e9", needsCard: true, gated: true },
  { id: "masarafi", name: "مصرفي باي (مصرف الجمهورية)", nameEn: "Masarafi Pay (Jumhouria Bank)", icon: "🏛️", color: "#059669", needsCard: true, gated: true },
  { id: "mobicash", name: "موبي كاش (بطاقة الوحدة)",  nameEn: "MobiCash (Wahda card)",   icon: "📲", color: "#f97316", needsCard: true, gated: true },
  { id: "edfali",   name: "ادفع لي",                   nameEn: "Edfali",                  icon: "🏧", color: "#7c3aed", needsPhone: true },
  { id: "moamalat", name: "بطاقة مصرفية (معاملات)", nameEn: "Bank card (Moamalat)",    icon: "🏦", color: "#1e40af", lightbox: true },
];

type CheckoutStep = null | "address" | "payment" | "processing";
type EdfaliStep   = null | "phone" | "sending" | "otp";
type YusorStep    = null | "card" | "sending" | "otp";
type MasarafiStep = null | "card" | "sending" | "otp";
type MobicashStep = null | "card" | "sending" | "otp";

export default function CartPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { items, removeItem, updateQuantity, clearCart, total, count } = useCart();
  const { t, rtl } = useLang();

  const [notes,         setNotes]         = useState("");
  const [ordering,      setOrdering]      = useState(false);

  // Checkout flow
  const [step,          setStep]          = useState<CheckoutStep>(null);
  const [addresses,     setAddresses]     = useState<UserAddress[]>([]);
  const [selectedAddr,  setSelectedAddr]  = useState<string | null>(null);
  const [newAddrText,   setNewAddrText]   = useState("");
  const [newAddrLat,    setNewAddrLat]    = useState<number | undefined>(undefined);
  const [newAddrLng,    setNewAddrLng]    = useState<number | undefined>(undefined);
  const [showCartMap,   setShowCartMap]   = useState(false);
  const [method,        setMethod]        = useState<string | null>(null);
  const [cardNumber,    setCardNumber]    = useState("");
  const [edfaliStep,    setEdfaliStep]    = useState<EdfaliStep>(null);
  const [edfaliPhone,   setEdfaliPhone]   = useState("");
  const [edfaliOtp,     setEdfaliOtp]     = useState("");
  const [edfaliSession, setEdfaliSession] = useState<string | null>(null);
  const [yusorStep,     setYusorStep]     = useState<YusorStep>(null);
  const [yusorCard,     setYusorCard]     = useState("");
  const [yusorOtp,      setYusorOtp]      = useState("");
  const [masarafiStep,  setMasarafiStep]  = useState<MasarafiStep>(null);
  const [masarafiCard,  setMasarafiCard]  = useState("");
  const [masarafiOtp,   setMasarafiOtp]   = useState("");
  const [mcStep,        setMcStep]        = useState<MobicashStep>(null);
  const [mcCard,        setMcCard]        = useState("");
  const [mcOtp,         setMcOtp]         = useState("");
  const [orderId,       setOrderId]       = useState<string | null>(null);
  const [payError,      setPayError]      = useState("");

  useEffect(() => {
    if (user) {
      fetch("/api/addresses")
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) setAddresses(data); });
    }
  }, [user]);

  const yusorVisible =
    process.env.NEXT_PUBLIC_YUSOR_ENABLED === "true" || user?.email === ADMIN_EMAIL;
  const masarafiVisible =
    process.env.NEXT_PUBLIC_MASARAFI_ENABLED === "true" || user?.email === ADMIN_EMAIL;
  const mobicashVisible =
    process.env.NEXT_PUBLIC_MOBICASH_ENABLED === "true" || user?.email === ADMIN_EMAIL;
  const visibleMethods = PAYMENT_METHODS.filter(pm =>
    pm.id === "yusor" ? yusorVisible
      : pm.id === "masarafi" ? masarafiVisible
      : pm.id === "mobicash" ? mobicashVisible : true);

  const chosenAddress = selectedAddr === "__new"
    ? newAddrText
    : addresses.find(a => a.id === selectedAddr)?.address_text || "";

  async function startCheckout() {
    if (!user) { router.push("/login"); return; }
    if (addresses.length > 0 && !selectedAddr) {
      setSelectedAddr(addresses.find(a => a.is_default)?.id || addresses[0]?.id || "__new");
    } else if (addresses.length === 0) {
      setSelectedAddr("__new");
    }
    setStep("address");
  }

  async function submitAddress() {
    if (!chosenAddress.trim() && selectedAddr !== "__new") { setPayError(t("يرجى اختيار أو إدخال عنوان", "Please select or enter an address")); return; }
    if (selectedAddr === "__new" && !newAddrText.trim()) { setPayError(t("يرجى إدخال العنوان", "Please enter an address")); return; }
    setPayError("");
    setStep("payment");
  }

  async function createOrder(paymentMethod: string) {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity, image_url: i.image_url, variants: i.variants })),
        total,
        notes: notes.trim() || null,
        address_text: chosenAddress,
        payment_method: paymentMethod,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t("فشل إنشاء الطلب", "Failed to create the order"));
    return data.id as string;
  }

  async function payWithCash() {
    setPayError("");
    setOrdering(true);
    try {
      const oid = await createOrder("cash");
      clearCart();
      router.push(`/success?orderId=${oid}&via=cash`);
    } catch (err: any) {
      setPayError(err.message);
      setOrdering(false);
    }
  }

  async function payWithMoamalat() {
    setPayError("");
    setOrdering(true);
    try {
      const oid = await createOrder("moamalat");

      const res = await fetch("/api/payment/moamalat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: oid, amountLYD: total }) });
      const p = await res.json();
      if (!res.ok || !p.success) { setPayError(p.error || t("فشل إعداد الدفع", "Failed to set up payment")); setOrdering(false); return; }

      clearCart();

      const returnUrl = `${window.location.origin}/success?orderId=${oid}&via=moamalat`;
      const cancelUrl = `${window.location.origin}/cart`;

      const qs = new URLSearchParams({
        mid:      p.MID,
        tid:      p.TID,
        amount:   p.AmountTrxn,
        ref:      p.MerchantReference,
        datetime: p.TrxDateTime,
        hash:     p.SecureHash,
        script:   p.scriptUrl,
        return:   returnUrl,
        cancel:   cancelUrl,
      }).toString();

      window.location.href = `/moamalat-pay?${qs}`;
    } catch (err: any) {
      setPayError(err.message);
      setOrdering(false);
    }
  }

  async function startEdfali() {
    setEdfaliStep("sending");
    setPayError("");
    try {
      const oid = orderId || await createOrder("edfali");
      setOrderId(oid);

      const res = await fetch("/api/edfali/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerPhone: edfaliPhone, amount: total }),
      });
      const data = await res.json();
      if (!res.ok) { setPayError(data.error || t("فشل إرسال رمز التحقق", "Failed to send the verification code")); setEdfaliStep("phone"); return; }
      setEdfaliSession(data.sessionId);
      setEdfaliStep("otp");
    } catch (err: any) {
      setPayError(err.message); setEdfaliStep("phone");
    }
  }

  async function verifyEdfali() {
    if (!edfaliOtp || !orderId) return;
    setOrdering(true);
    try {
      const res = await fetch("/api/edfali/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: edfaliSession, otp: edfaliOtp, order_id: orderId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setPayError(data.error || t("رمز التحقق غير صحيح", "Invalid verification code")); setOrdering(false); return; }
      clearCart();
      router.push(`/success?orderId=${orderId}&via=edfali`);
    } catch (err: any) {
      setPayError(err.message); setOrdering(false);
    }
  }

  async function startYusor() {
    if (yusorCard.replace(/\D/g, "").length < 9) { setPayError(t("رقم البطاقة يجب أن يكون 9 أرقام على الأقل", "Card number must be at least 9 digits")); return; }
    setYusorStep("sending");
    setPayError("");
    try {
      const oid = orderId || await createOrder("yusor");
      setOrderId(oid);

      const res = await fetch("/api/yusor/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: oid, identityCard: yusorCard, amount: total }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setPayError(data.error || t("فشل بدء عملية الدفع", "Failed to start the payment")); setYusorStep("card"); return; }
      setYusorStep("otp");
    } catch (err: any) {
      setPayError(err.message); setYusorStep("card");
    }
  }

  async function verifyYusor() {
    if (!yusorOtp || !orderId) return;
    setOrdering(true);
    try {
      const res = await fetch("/api/yusor/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, otp: yusorOtp }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setPayError(data.error || t("رمز التحقق غير صحيح", "Invalid verification code")); setOrdering(false); return; }
      clearCart();
      router.push(`/success?orderId=${orderId}&via=yusor`);
    } catch (err: any) {
      setPayError(err.message); setOrdering(false);
    }
  }

  async function startMasarafi() {
    if (masarafiCard.replace(/\D/g, "").length < 9) { setPayError(t("رقم البطاقة يجب أن يكون 9 أرقام على الأقل", "Card number must be at least 9 digits")); return; }
    setMasarafiStep("sending");
    setPayError("");
    try {
      const oid = orderId || await createOrder("masarafi");
      setOrderId(oid);

      const res = await fetch("/api/masarafi/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: oid, identityCard: masarafiCard, amount: total }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setPayError(data.error || t("فشل بدء عملية الدفع", "Failed to start the payment")); setMasarafiStep("card"); return; }
      setMasarafiStep("otp");
    } catch (err: any) {
      setPayError(err.message); setMasarafiStep("card");
    }
  }

  async function verifyMasarafi() {
    if (!masarafiOtp || !orderId) return;
    setOrdering(true);
    try {
      const res = await fetch("/api/masarafi/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, otp: masarafiOtp }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setPayError(data.error || t("رمز التحقق غير صحيح", "Invalid verification code")); setOrdering(false); return; }
      clearCart();
      router.push(`/success?orderId=${orderId}&via=masarafi`);
    } catch (err: any) {
      setPayError(err.message); setOrdering(false);
    }
  }

  async function startMobicash() {
    if (mcCard.replace(/\D/g, "").length < 5) { setPayError(t("رقم البطاقة غير صحيح", "Invalid card number")); return; }
    setMcStep("sending");
    setPayError("");
    try {
      const oid = orderId || await createOrder("mobicash");
      setOrderId(oid);

      const res = await fetch("/api/mobicash/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: oid, cardNumber: mcCard }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setPayError(data.error || t("فشل بدء عملية الدفع", "Failed to start the payment")); setMcStep("card"); return; }
      setMcStep("otp");
    } catch (err: any) {
      setPayError(err.message); setMcStep("card");
    }
  }

  async function verifyMobicash() {
    if (!mcOtp || !orderId) return;
    setOrdering(true);
    try {
      const res = await fetch("/api/mobicash/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, otp: mcOtp }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setPayError(data.error || t("رمز التحقق غير صحيح", "Invalid verification code")); setOrdering(false); return; }
      clearCart();
      router.push(`/success?orderId=${orderId}&via=mobicash`);
    } catch (err: any) {
      setPayError(err.message); setOrdering(false);
    }
  }

  const closeModal = () => {
    setStep(null); setMethod(null); setCardNumber(""); setEdfaliStep(null);
    setEdfaliPhone(""); setEdfaliOtp(""); setYusorStep(null); setYusorCard("");
    setYusorOtp(""); setMasarafiStep(null); setMasarafiCard(""); setMasarafiOtp("");
    setMcStep(null); setMcCard(""); setMcOtp("");
    setPayError(""); setOrdering(false);
  };

  return (
    <div className="flex flex-col bg-[var(--bg)] text-[var(--text)] min-h-screen" dir={rtl ? "rtl" : "ltr"}>

      {/* ─── HEADER ─── */}
      <header className="flex items-center gap-4 px-6 py-3.5 border-b border-purple-500/20 sticky top-0 bg-[var(--glass)] backdrop-blur-md z-40">
        <button onClick={() => router.back()} className="text-[var(--muted)] hover:text-purple-400 transition-colors shrink-0">
          <ArrowRight size={22} className={rtl ? "" : "rotate-180"} />
        </button>
        <a href="/" className="text-xl font-black tracking-widest bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent shrink-0">
          TREND
        </a>
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-[var(--muted)] shrink-0">
          <LangToggle />
          {user && <NotificationBell />}
          <a href="/cart" className="relative text-purple-400">
            <ShoppingCart size={20} />
            {count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-purple-500 rounded-full text-[10px] font-black text-[var(--text)] flex items-center justify-center">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </a>
          {user ? (
            <a href="/account" className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-sm font-black">
              {(user.user_metadata?.full_name?.[0] || user.email?.[0] || "؟").toUpperCase()}
            </a>
          ) : (
            <a href="/login" className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-[var(--muted)] text-sm">
              <User size={16} /> {t("دخول", "Sign in")}
            </a>
          )}
        </div>
      </header>

      <div className="p-4 md:p-6 max-w-2xl mx-auto w-full space-y-5">

        {/* Title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">{t("سلة التسوق", "Shopping Cart")}</h1>
            <p className="text-[var(--muted-2)] text-sm mt-0.5">{count} {t("منتج", "items")}</p>
          </div>
          {items.length > 0 && (
            <button onClick={clearCart} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors">
              <Trash2 size={13} /> {t("تفريغ السلة", "Clear cart")}
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-[var(--muted-2)]">
            <ShoppingBag size={64} className="text-purple-500/20" />
            <p className="text-lg font-medium">{t("السلة فارغة", "Your cart is empty")}</p>
            <p className="text-sm text-[var(--muted-2)]">{t("أضف منتجات تعجبك من المتجر", "Add some products from the store")}</p>
            <a href="/products" className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-500 text-white text-sm font-bold hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all mt-2">
              <ShoppingCart size={16} /> {t("تصفح المنتجات", "Browse products")}
            </a>
          </div>
        ) : (
          <>
            {/* Items */}
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.cartKey} className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl p-4 flex items-center gap-4">
                  <a href={`/products/${item.id}`}>
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-16 h-16 rounded-xl object-cover border border-[var(--border)] shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                        <Package size={22} className="text-purple-400/40" />
                      </div>
                    )}
                  </a>
                  <div className="flex-1 min-w-0">
                    <a href={`/products/${item.id}`} className="text-sm font-semibold text-[var(--text)] hover:text-purple-300 transition-colors line-clamp-2">
                      {item.name}
                    </a>
                    {item.variants && Object.keys(item.variants).length > 0 && (
                      <p className="text-xs text-purple-400/70 mt-0.5">
                        {Object.entries(item.variants).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                      </p>
                    )}
                    <p className="text-purple-400 font-black mt-1">{item.price} {t("د", "LYD")}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => updateQuantity(item.cartKey, item.quantity - 1)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-[var(--border)] flex items-center justify-center transition-colors">
                      <Minus size={12} />
                    </button>
                    <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.cartKey, item.quantity + 1)} disabled={item.quantity >= item.stock} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-[var(--border)] flex items-center justify-center transition-colors disabled:opacity-30">
                      <Plus size={12} />
                    </button>
                    <button onClick={() => removeItem(item.cartKey)} className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 flex items-center justify-center text-red-400 transition-colors mr-1">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl p-5 space-y-3">
              <h2 className="font-bold text-sm text-[var(--muted)]">{t("ملخص الطلب", "Order summary")}</h2>
              <div className="space-y-2 text-sm">
                {items.map((item) => (
                  <div key={item.cartKey} className="flex justify-between text-[var(--muted)]">
                    <span className="truncate max-w-[200px]">{item.name} × {item.quantity}</span>
                    <span>{item.price * item.quantity} {t("د", "LYD")}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-[var(--border)] pt-3 flex justify-between items-center">
                <span className="font-bold text-[var(--text)]">{t("الإجمالي", "Total")}</span>
                <span className="text-2xl font-black bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                  {total} {t("د", "LYD")}
                </span>
              </div>
            </div>

            {/* Notes */}
            <div className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl p-5">
              <label className="text-[var(--muted)] text-sm font-medium mb-2 block">📝 {t("ملاحظات للطلب (اختياري)", "Order notes (optional)")}</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={t("أضف أي ملاحظات أو تعليمات خاصة بطلبك...", "Add any notes or special instructions...")}
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-[var(--input)] border border-purple-500/30 text-[var(--text)] text-sm focus:outline-none focus:border-purple-500/60 transition-all resize-none placeholder-gray-600"
              />
            </div>

            {/* CTA */}
            <div className="space-y-3">
              <button
                onClick={startCheckout}
                disabled={ordering}
                className="w-full py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-500 hover:shadow-[0_0_24px_rgba(168,85,247,0.5)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {ordering
                  ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><ShoppingBag size={18} /> {t("تأكيد الطلب", "Checkout")}</>
                }
              </button>
              <a href="/products" className="w-full py-3 rounded-2xl font-medium text-[var(--muted)] hover:text-[var(--text)] bg-white/5 hover:bg-white/10 border border-[var(--border)] flex items-center justify-center gap-2 transition-all text-sm">
                <ShoppingCart size={16} /> {t("مواصلة التسوق", "Continue shopping")}
              </a>
            </div>
          </>
        )}
      </div>

      {/* ════════════════════════════════════════════════════
          CHECKOUT MODAL
          ════════════════════════════════════════════════════ */}
      {step && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !ordering) closeModal(); }}>
          <div className="bg-white rounded-3xl md:rounded-3xl rounded-b-none w-full md:w-[400px] max-h-[92vh] overflow-y-auto shadow-[0_24px_60px_rgba(0,0,0,0.35)]" dir={rtl ? "rtl" : "ltr"}
            style={{ animation: "slideUp 0.25s cubic-bezier(0.22,1,0.36,1)" }}>
            <style>{`@keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>

            {/* ── STEP 1: Address ── */}
            {step === "address" && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-black text-gray-900">{t("عنوان التسليم", "Delivery address")}</h3>
                  <button onClick={closeModal} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[var(--muted-2)] hover:bg-gray-200 transition-colors">
                    <X size={16} />
                  </button>
                </div>

                {/* Saved addresses */}
                {addresses.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {addresses.map((addr) => (
                      <button key={addr.id} onClick={() => setSelectedAddr(addr.id)}
                        className={`w-full flex items-start gap-3 p-3.5 rounded-2xl border-2 text-start transition-all ${selectedAddr === addr.id ? "border-purple-500 bg-purple-50" : "border-gray-100 bg-gray-50 hover:border-purple-300"}`}>
                        <MapPin size={18} className={`shrink-0 mt-0.5 ${selectedAddr === addr.id ? "text-purple-600" : "text-[var(--muted)]"}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`font-bold text-sm ${selectedAddr === addr.id ? "text-purple-700" : "text-gray-800"}`}>
                            {addr.label} {addr.is_default && <span className="text-xs font-medium text-purple-500">({t("افتراضي", "default")})</span>}
                          </p>
                          <p className="text-[var(--muted-2)] text-xs mt-0.5 leading-relaxed">{addr.address_text}</p>
                        </div>
                      </button>
                    ))}
                    <button onClick={() => setSelectedAddr("__new")}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 text-start transition-all ${selectedAddr === "__new" ? "border-purple-500 bg-purple-50" : "border-dashed border-gray-200 hover:border-purple-300"}`}>
                      <span className="text-2xl">+</span>
                      <span className={`text-sm font-medium ${selectedAddr === "__new" ? "text-purple-700" : "text-[var(--muted-2)]"}`}>{t("إضافة عنوان جديد", "Add a new address")}</span>
                    </button>
                  </div>
                )}

                {/* New address input */}
                {(selectedAddr === "__new" || addresses.length === 0) && (
                  <div className="space-y-3">
                    <textarea
                      value={newAddrText}
                      onChange={e => setNewAddrText(e.target.value)}
                      placeholder={t("أدخل عنوان التسليم التفصيلي...", "Enter your detailed delivery address...")}
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-purple-400 transition-all resize-none placeholder:text-[var(--muted)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCartMap(!showCartMap)}
                      className="w-full py-2.5 rounded-xl border border-dashed border-purple-300 text-purple-600 text-sm font-medium flex items-center justify-center gap-2 hover:bg-purple-50 transition-colors"
                    >
                      <MapPin size={15} />
                      {showCartMap ? t("إخفاء الخريطة", "Hide map") : t("تحديد الموقع على الخريطة (اختياري)", "Pick location on map (optional)")}
                    </button>
                    {showCartMap && (
                      <div>
                        <MapPicker
                          lat={newAddrLat}
                          lng={newAddrLng}
                          onSelect={({ lat, lng, address }) => {
                            setNewAddrLat(lat);
                            setNewAddrLng(lng);
                            if (address && !newAddrText) setNewAddrText(address.split(",")[0]);
                          }}
                        />
                        {newAddrLat && (
                          <p className="text-xs text-green-600 bg-green-50 rounded-xl px-3 py-2 mt-2">
                            ✅ {t("تم تحديد الموقع:", "Location set:")} {newAddrLat.toFixed(4)}، {newAddrLng?.toFixed(4)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {payError && <p className="text-red-500 text-sm mt-3">⚠️ {payError}</p>}

                <button onClick={submitAddress}
                  className="mt-5 w-full py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-500 hover:opacity-90 transition-opacity text-sm">
                  {t("التالي — اختيار طريقة الدفع", "Next — choose payment method")}
                </button>
              </div>
            )}

            {/* ── STEP 2: Payment ── */}
            {step === "payment" && !edfaliStep && !yusorStep && !masarafiStep && !mcStep && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-black text-gray-900">{t("اختر طريقة الدفع", "Choose payment method")}</h3>
                  <button onClick={closeModal} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[var(--muted-2)] hover:bg-gray-200 transition-colors">
                    <X size={16} />
                  </button>
                </div>
                <p className="text-sm text-[var(--muted)] mb-5">{t("المبلغ الإجمالي:", "Total amount:")} <strong className="text-gray-900">{total} {t("د.ل", "LYD")}</strong></p>

                <div className="space-y-2 mb-4">
                  {visibleMethods.map((pm) => (
                    <button key={pm.id} onClick={() => { setMethod(pm.id); setCardNumber(""); setPayError(""); }}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-start transition-all ${method === pm.id ? "border-purple-500 bg-purple-50" : "border-gray-100 bg-gray-50 hover:border-purple-200"}`}>
                      <span className="text-2xl w-9 text-center shrink-0">{pm.icon}</span>
                      <span className={`font-bold text-sm ${method === pm.id ? "text-purple-800" : "text-gray-800"}`}>{rtl ? pm.name : pm.nameEn}</span>
                      {method === pm.id && <span className="ms-auto text-purple-500">✓</span>}
                    </button>
                  ))}
                </div>

{payError && <p className="text-red-500 text-sm mb-3">⚠️ {payError}</p>}

                <button
                  onClick={() => {
                    if (!method) { setPayError(t("يرجى اختيار طريقة الدفع", "Please choose a payment method")); return; }
                    if (method === "cash") { setStep("processing"); payWithCash(); return; }
                    if (method === "yusor") { setYusorStep("card"); return; }
                    if (method === "masarafi") { setMasarafiStep("card"); return; }
                    if (method === "mobicash") { setMcStep("card"); return; }
                    if (method === "edfali") { setEdfaliStep("phone"); return; }
                    if (method === "moamalat") { setStep("processing"); payWithMoamalat(); return; }
                  }}
                  disabled={ordering || !method}
                  className="w-full py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-500 hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
                >
                  {ordering ? <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t("ادفع الآن", "Pay now")}
                </button>

                <button onClick={() => { setStep("address"); setMethod(null); }} className="w-full mt-3 py-2.5 text-sm text-[var(--muted)] hover:text-gray-700 transition-colors">
                  {t("رجوع لاختيار العنوان", "Back to address")}
                </button>
              </div>
            )}

            {/* ── EDFALI: Phone step ── */}
            {step === "payment" && edfaliStep === "phone" && (
              <div className="p-6 text-center">
                <div className="text-4xl mb-4">🏧</div>
                <h3 className="text-lg font-black text-gray-900 mb-1">{t("ادفع لي", "Edfali")}</h3>
                <p className="text-[var(--muted-2)] text-sm mb-5">{t("أدخل رقم هاتفك المرتبط بحساب «ادفع لي»", "Enter the phone number linked to your Edfali account")}</p>
                <input
                  type="tel"
                  placeholder="9xxxxxxxx"
                  value={edfaliPhone}
                  onChange={e => setEdfaliPhone(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-xl text-center font-bold tracking-widest focus:outline-none focus:border-purple-400 transition-all mb-4"
                  style={{ direction: "ltr" }}
                  autoFocus
                />
                <p className="text-[var(--muted)] text-xs mb-3 text-center">{t("بدون الصفر — مثال: 918621511", "Without the leading zero — e.g. 918621511")}</p>
                {payError && <p className="text-red-500 text-sm mb-3">⚠️ {payError}</p>}
                <button onClick={startEdfali} disabled={edfaliPhone.length < 9}
                  className="w-full py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-500 disabled:opacity-50 mb-3 text-sm">
                  {t("إرسال رمز التحقق", "Send verification code")}
                </button>
                <button onClick={() => setEdfaliStep(null)} className="w-full py-2.5 text-sm text-[var(--muted)] hover:text-gray-700 transition-colors">
                  {t("رجوع", "Back")}
                </button>
              </div>
            )}

            {/* ── EDFALI: Sending ── */}
            {step === "payment" && edfaliStep === "sending" && (
              <div className="p-10 text-center">
                <div className="w-14 h-14 border-4 border-purple-100 border-t-purple-600 rounded-full animate-spin mx-auto mb-5" />
                <p className="text-[var(--muted-2)] text-sm">⏳ {t("جاري إرسال رمز التحقق...", "Sending verification code...")}</p>
              </div>
            )}

            {/* ── EDFALI: OTP ── */}
            {step === "payment" && edfaliStep === "otp" && (
              <div className="p-6 text-center">
                <div className="text-4xl mb-4">🔐</div>
                <h3 className="text-lg font-black text-gray-900 mb-1">{t("رمز التحقق", "Verification code")}</h3>
                <p className="text-[var(--muted-2)] text-sm mb-5">{t("أُرسل رمز مكوّن من 4 أرقام إلى هاتفك", "A 4-digit code was sent to your phone")} <strong className="text-purple-600">{edfaliPhone}</strong></p>
                <input
                  type="number"
                  maxLength={4}
                  placeholder="0000"
                  value={edfaliOtp}
                  onChange={e => setEdfaliOtp(e.target.value.slice(0, 4))}
                  className="w-full px-4 py-4 rounded-xl border border-gray-200 text-gray-900 text-3xl text-center font-black tracking-widest focus:outline-none focus:border-purple-400 transition-all mb-4"
                  style={{ direction: "ltr" }}
                  autoFocus
                />
                {payError && <p className="text-red-500 text-sm mb-3">⚠️ {payError}</p>}
                <button onClick={verifyEdfali} disabled={ordering || edfaliOtp.length < 4}
                  className="w-full py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-500 disabled:opacity-50 mb-3 text-sm">
                  {ordering ? <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t("تأكيد الدفع ✓", "Confirm payment ✓")}
                </button>
                <button onClick={() => { setEdfaliStep(null); setEdfaliOtp(""); setOrdering(false); }} className="w-full py-2.5 text-sm text-[var(--muted)] hover:text-gray-700 transition-colors">
                  {t("رجوع", "Back")}
                </button>
              </div>
            )}

            {/* ── YUSOR: Card step ── */}
            {step === "payment" && yusorStep === "card" && (
              <div className="p-6 text-center">
                <div className="text-4xl mb-4">💳</div>
                <h3 className="text-lg font-black text-gray-900 mb-1">{t("يسر باي", "Yusor Pay")}</h3>
                <p className="text-[var(--muted-2)] text-sm mb-5">{t("أدخل رقم بطاقتك المصرفية لإتمام الدفع", "Enter your bank card number to complete payment")}</p>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder={t("رقم البطاقة", "Card number")}
                  value={yusorCard}
                  onChange={e => setYusorCard(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-xl text-center font-bold tracking-widest focus:outline-none focus:border-sky-400 transition-all mb-3"
                  style={{ direction: "ltr" }}
                  autoFocus
                />
                <p className="text-[var(--muted)] text-xs mb-3 text-center">{t("9 أرقام (رقم البطاقة + البادئة) — أو 10 أرقام لمصرف التجارة والتنمية", "9 digits (card number + prefix) — or 10 digits for Bank of Commerce & Development")}</p>
                {payError && <p className="text-red-500 text-sm mb-3">⚠️ {payError}</p>}
                <button onClick={startYusor} disabled={yusorCard.replace(/\D/g, "").length < 9}
                  className="w-full py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-sky-600 to-blue-500 disabled:opacity-50 mb-3 text-sm">
                  {t("إرسال رمز التحقق", "Send verification code")}
                </button>
                <button onClick={() => { setYusorStep(null); setYusorCard(""); setPayError(""); }} className="w-full py-2.5 text-sm text-[var(--muted)] hover:text-gray-700 transition-colors">
                  {t("رجوع", "Back")}
                </button>
              </div>
            )}

            {/* ── YUSOR: Sending ── */}
            {step === "payment" && yusorStep === "sending" && (
              <div className="p-10 text-center">
                <div className="w-14 h-14 border-4 border-sky-100 border-t-sky-600 rounded-full animate-spin mx-auto mb-5" />
                <p className="text-[var(--muted-2)] text-sm">⏳ {t("جاري إرسال رمز التحقق...", "Sending verification code...")}</p>
              </div>
            )}

            {/* ── YUSOR: OTP ── */}
            {step === "payment" && yusorStep === "otp" && (
              <div className="p-6 text-center">
                <div className="text-4xl mb-4">🔐</div>
                <h3 className="text-lg font-black text-gray-900 mb-1">{t("رمز التحقق", "Verification code")}</h3>
                <p className="text-[var(--muted-2)] text-sm mb-5">{t("أُرسل رمز التحقق إلى هاتفك المرتبط بالبطاقة المصرفية", "A verification code was sent to the phone linked to your bank card")}</p>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder={t("رمز التحقق", "Verification code")}
                  value={yusorOtp}
                  onChange={e => setYusorOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  className="w-full px-4 py-4 rounded-xl border border-gray-200 text-gray-900 text-3xl text-center font-black tracking-widest focus:outline-none focus:border-sky-400 transition-all mb-4"
                  style={{ direction: "ltr" }}
                  autoFocus
                />
                {payError && <p className="text-red-500 text-sm mb-3">⚠️ {payError}</p>}
                <button onClick={verifyYusor} disabled={ordering || yusorOtp.length < 4}
                  className="w-full py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-sky-600 to-blue-500 disabled:opacity-50 mb-3 text-sm">
                  {ordering ? <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t("تأكيد الدفع ✓", "Confirm payment ✓")}
                </button>
                <button onClick={() => { setYusorStep("card"); setYusorOtp(""); setOrdering(false); }} className="w-full py-2.5 text-sm text-[var(--muted)] hover:text-gray-700 transition-colors">
                  {t("رجوع", "Back")}
                </button>
              </div>
            )}

            {/* ── MASARAFI: Card step ── */}
            {step === "payment" && masarafiStep === "card" && (
              <div className="p-6 text-center">
                <div className="text-4xl mb-4">🏛️</div>
                <h3 className="text-lg font-black text-gray-900 mb-1">{t("مصرفي باي", "Masarafi Pay")}</h3>
                <p className="text-[var(--muted-2)] text-sm mb-5">{t("أدخل رقم بطاقتك من مصرف الجمهورية لإتمام الدفع", "Enter your Jumhouria Bank card number to complete payment")}</p>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder={t("رقم البطاقة", "Card number")}
                  value={masarafiCard}
                  onChange={e => setMasarafiCard(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-xl text-center font-bold tracking-widest focus:outline-none focus:border-emerald-400 transition-all mb-3"
                  style={{ direction: "ltr" }}
                  autoFocus
                />
                <p className="text-[var(--muted)] text-xs mb-3 text-center">{t("9 أرقام (رقم البطاقة + البادئة)", "9 digits (card number + prefix)")}</p>
                {payError && <p className="text-red-500 text-sm mb-3">⚠️ {payError}</p>}
                <button onClick={startMasarafi} disabled={masarafiCard.replace(/\D/g, "").length < 9}
                  className="w-full py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-emerald-600 to-green-500 disabled:opacity-50 mb-3 text-sm">
                  {t("إرسال رمز التحقق", "Send verification code")}
                </button>
                <button onClick={() => { setMasarafiStep(null); setMasarafiCard(""); setPayError(""); }} className="w-full py-2.5 text-sm text-[var(--muted)] hover:text-gray-700 transition-colors">
                  {t("رجوع", "Back")}
                </button>
              </div>
            )}

            {/* ── MASARAFI: Sending ── */}
            {step === "payment" && masarafiStep === "sending" && (
              <div className="p-10 text-center">
                <div className="w-14 h-14 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin mx-auto mb-5" />
                <p className="text-[var(--muted-2)] text-sm">⏳ {t("جاري إرسال رمز التحقق...", "Sending verification code...")}</p>
              </div>
            )}

            {/* ── MASARAFI: OTP ── */}
            {step === "payment" && masarafiStep === "otp" && (
              <div className="p-6 text-center">
                <div className="text-4xl mb-4">🔐</div>
                <h3 className="text-lg font-black text-gray-900 mb-1">{t("رمز التحقق", "Verification code")}</h3>
                <p className="text-[var(--muted-2)] text-sm mb-5">{t("أُرسل رمز التحقق إلى هاتفك المرتبط ببطاقة مصرف الجمهورية", "A verification code was sent to the phone linked to your Jumhouria Bank card")}</p>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder={t("رمز التحقق", "Verification code")}
                  value={masarafiOtp}
                  onChange={e => setMasarafiOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  className="w-full px-4 py-4 rounded-xl border border-gray-200 text-gray-900 text-3xl text-center font-black tracking-widest focus:outline-none focus:border-emerald-400 transition-all mb-4"
                  style={{ direction: "ltr" }}
                  autoFocus
                />
                {payError && <p className="text-red-500 text-sm mb-3">⚠️ {payError}</p>}
                <button onClick={verifyMasarafi} disabled={ordering || masarafiOtp.length < 4}
                  className="w-full py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-emerald-600 to-green-500 disabled:opacity-50 mb-3 text-sm">
                  {ordering ? <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t("تأكيد الدفع ✓", "Confirm payment ✓")}
                </button>
                <button onClick={() => { setMasarafiStep("card"); setMasarafiOtp(""); setOrdering(false); }} className="w-full py-2.5 text-sm text-[var(--muted)] hover:text-gray-700 transition-colors">
                  {t("رجوع", "Back")}
                </button>
              </div>
            )}

            {/* ── MOBICASH: Card step ── */}
            {step === "payment" && mcStep === "card" && (
              <div className="p-6 text-center">
                <div className="text-4xl mb-4">📲</div>
                <h3 className="text-lg font-black text-gray-900 mb-1">{t("موبي كاش", "MobiCash")}</h3>
                <p className="text-[var(--muted-2)] text-sm mb-5">{t("أدخل رقم بطاقة موبي كاش لإتمام الدفع", "Enter your MobiCash card number to complete payment")}</p>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder={t("رقم البطاقة", "Card number")}
                  value={mcCard}
                  onChange={e => setMcCard(e.target.value.replace(/\D/g, "").slice(0, 19))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-xl text-center font-bold tracking-widest focus:outline-none focus:border-orange-400 transition-all mb-3"
                  style={{ direction: "ltr" }}
                  autoFocus
                />
                <p className="text-[var(--muted)] text-xs mb-3 text-center">{t("سيصلك رمز تحقق على هاتفك المرتبط بالبطاقة", "A verification code will be sent to the phone linked to the card")}</p>
                {payError && <p className="text-red-500 text-sm mb-3">⚠️ {payError}</p>}
                <button onClick={startMobicash} disabled={mcCard.replace(/\D/g, "").length < 5}
                  className="w-full py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 disabled:opacity-50 mb-3 text-sm">
                  {t("إرسال رمز التحقق", "Send verification code")}
                </button>
                <button onClick={() => { setMcStep(null); setMcCard(""); setPayError(""); }} className="w-full py-2.5 text-sm text-[var(--muted)] hover:text-gray-700 transition-colors">
                  {t("رجوع", "Back")}
                </button>
              </div>
            )}

            {/* ── MOBICASH: Sending ── */}
            {step === "payment" && mcStep === "sending" && (
              <div className="p-10 text-center">
                <div className="w-14 h-14 border-4 border-orange-100 border-t-orange-500 rounded-full animate-spin mx-auto mb-5" />
                <p className="text-[var(--muted-2)] text-sm">⏳ {t("جاري إرسال رمز التحقق...", "Sending verification code...")}</p>
              </div>
            )}

            {/* ── MOBICASH: OTP ── */}
            {step === "payment" && mcStep === "otp" && (
              <div className="p-6 text-center">
                <div className="text-4xl mb-4">🔐</div>
                <h3 className="text-lg font-black text-gray-900 mb-1">{t("رمز التحقق", "Verification code")}</h3>
                <p className="text-[var(--muted-2)] text-sm mb-5">{t("أُرسل رمز التحقق إلى هاتفك — صالح لمدة 5 دقائق", "A verification code was sent to your phone — valid for 5 minutes")}</p>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder={t("رمز التحقق", "Verification code")}
                  value={mcOtp}
                  onChange={e => setMcOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  className="w-full px-4 py-4 rounded-xl border border-gray-200 text-gray-900 text-3xl text-center font-black tracking-widest focus:outline-none focus:border-orange-400 transition-all mb-4"
                  style={{ direction: "ltr" }}
                  autoFocus
                />
                {payError && <p className="text-red-500 text-sm mb-3">⚠️ {payError}</p>}
                <button onClick={verifyMobicash} disabled={ordering || mcOtp.length < 4}
                  className="w-full py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 disabled:opacity-50 mb-3 text-sm">
                  {ordering ? <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t("تأكيد الدفع ✓", "Confirm payment ✓")}
                </button>
                <button onClick={() => { setMcStep("card"); setMcOtp(""); setOrdering(false); }} className="w-full py-2.5 text-sm text-[var(--muted)] hover:text-gray-700 transition-colors">
                  {t("رجوع", "Back")}
                </button>
              </div>
            )}

            {/* ── Processing ── */}
            {step === "processing" && (
              <div className="p-10 text-center">
                <div className="w-14 h-14 border-4 border-purple-100 border-t-purple-600 rounded-full animate-spin mx-auto mb-5" />
                <p className="text-gray-700 font-medium mb-1">{t("جاري معالجة الدفع...", "Processing payment...")}</p>
                <p className="text-[var(--muted)] text-sm">{t("لا تغلق هذه النافذة", "Don't close this window")}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
