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

type UserAddress = {
  id: string;
  label: string;
  address_text: string;
  lat?: number;
  lng?: number;
  is_default: boolean;
};

declare global {
  interface Window {
    Lightbox?: { showPaymentForm: (p: object) => void };
  }
}

const PAYMENT_METHODS = [
  { id: "cash",       name: "الدفع عند الاستلام", icon: "💵", color: "#16a34a"                  },
  { id: "mobicash",   name: "موبي كاش",           icon: "📱", color: "#0284c7", needsCard: true  },
  { id: "masrefypay", name: "مصرفي",               icon: "💳", color: "#ea580c", needsCard: true  },
  { id: "yousrpay",   name: "يسر باي",             icon: "💳", color: "#0d9488", needsCard: true  },
  { id: "saharpay",   name: "صحارة باي",           icon: "💳", color: "#ca8a04", needsCard: true  },
  { id: "edfali",     name: "ادفع لي",             icon: "🏧", color: "#7c3aed", needsPhone: true },
  { id: "moamalat",   name: "بطاقة مصرفية (معاملات)", icon: "🏦", color: "#1e40af", lightbox: true },
];

type CheckoutStep = null | "address" | "payment" | "processing";
type EdfaliStep   = null | "phone" | "sending" | "otp";

export default function CartPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { items, removeItem, updateQuantity, clearCart, total, count } = useCart();

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
  const [orderId,       setOrderId]       = useState<string | null>(null);
  const [payError,      setPayError]      = useState("");

  useEffect(() => {
    if (user) {
      fetch("/api/addresses")
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) setAddresses(data); });
    }
  }, [user]);

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
    if (!chosenAddress.trim() && selectedAddr !== "__new") { setPayError("يرجى اختيار أو إدخال عنوان"); return; }
    if (selectedAddr === "__new" && !newAddrText.trim()) { setPayError("يرجى إدخال العنوان"); return; }
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
    if (!res.ok) throw new Error(data.error || "فشل إنشاء الطلب");
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

  async function payWithDPay() {
    if (!method) return;
    setPayError("");
    setOrdering(true);
    try {
      const oid = await createOrder(method);
      setOrderId(oid);

      const body: any = { amount: total, orderId: oid, method };
      if (["mobicash","masrefypay","yousrpay","saharpay"].includes(method)) {
        if (!cardNumber.trim()) { setPayError("يرجى إدخال رقم البطاقة"); setOrdering(false); return; }
        body.card_number = cardNumber;
      }

      const res = await fetch("/api/payment/dpay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok || !data.payment_link) { setPayError(data.error || "فشل إنشاء جلسة الدفع"); setOrdering(false); return; }

      clearCart();
      window.location.href = data.payment_link;
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
      setOrderId(oid);

      const res = await fetch("/api/payment/moamalat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: oid, amountLYD: total }) });
      const p = await res.json();
      if (!res.ok || !p.success) { setPayError(p.error || "فشل إعداد الدفع"); setOrdering(false); return; }

      // load Moamalat lightbox
      const script = document.createElement("script");
      script.src = p.scriptUrl;
      script.onload = () => {
        if (window.Lightbox) {
          window.Lightbox.showPaymentForm({
            MID: p.MID, TID: p.TID,
            AmountTrxn: p.AmountTrxn,
            MerchantReference: p.MerchantReference,
            TrxDateTime: p.TrxDateTime,
            SecureHash: p.SecureHash,
            completeCallback: () => {
              clearCart();
              router.push(`/success?orderId=${oid}&via=moamalat`);
            },
            errorCallback: (err: any) => { setPayError("فشل الدفع: " + JSON.stringify(err)); setOrdering(false); },
            cancelCallback: () => { setPayError("تم إلغاء الدفع"); setOrdering(false); },
          });
        }
      };
      document.head.appendChild(script);
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

      const res = await fetch("/api/payment/dpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: total, orderId: oid, method: "edfali", customer_mobile: edfaliPhone }),
      });
      const data = await res.json();
      if (!res.ok) { setPayError(data.error || "فشل إرسال رمز التحقق"); setEdfaliStep("phone"); return; }
      setEdfaliSession(data.session_id);
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
      if (!res.ok || !data.success) { setPayError(data.error || "رمز التحقق غير صحيح"); setOrdering(false); return; }
      clearCart();
      router.push(`/success?orderId=${orderId}&via=edfali`);
    } catch (err: any) {
      setPayError(err.message); setOrdering(false);
    }
  }

  const closeModal = () => {
    setStep(null); setMethod(null); setCardNumber(""); setEdfaliStep(null);
    setEdfaliPhone(""); setEdfaliOtp(""); setPayError(""); setOrdering(false);
  };

  return (
    <div className="flex flex-col bg-[#0b0f1a] text-white min-h-screen">

      {/* ─── HEADER ─── */}
      <header className="flex items-center gap-4 px-6 py-3.5 border-b border-purple-500/20 sticky top-0 bg-[#0b0f1a]/90 backdrop-blur-md z-40">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-purple-400 transition-colors shrink-0">
          <ArrowRight size={22} />
        </button>
        <a href="/" className="text-xl font-black tracking-widest bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent shrink-0">
          TREND
        </a>
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-gray-400 shrink-0">
          {user && <NotificationBell />}
          <a href="/cart" className="relative text-purple-400">
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
            <a href="/login" className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-gray-300 text-sm">
              <User size={16} /> دخول
            </a>
          )}
        </div>
      </header>

      <div className="p-4 md:p-6 max-w-2xl mx-auto w-full space-y-5">

        {/* Title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">سلة التسوق</h1>
            <p className="text-gray-500 text-sm mt-0.5">{count} منتج</p>
          </div>
          {items.length > 0 && (
            <button onClick={clearCart} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors">
              <Trash2 size={13} /> تفريغ السلة
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-500">
            <ShoppingBag size={64} className="text-purple-500/20" />
            <p className="text-lg font-medium">السلة فارغة</p>
            <p className="text-sm text-gray-600">أضف منتجات تعجبك من المتجر</p>
            <a href="/products" className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-500 text-white text-sm font-bold hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all mt-2">
              <ShoppingCart size={16} /> تصفح المنتجات
            </a>
          </div>
        ) : (
          <>
            {/* Items */}
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.cartKey} className="bg-[#0f1320] border border-purple-500/20 rounded-2xl p-4 flex items-center gap-4">
                  <a href={`/products/${item.id}`}>
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-16 h-16 rounded-xl object-cover border border-white/10 shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                        <Package size={22} className="text-purple-400/40" />
                      </div>
                    )}
                  </a>
                  <div className="flex-1 min-w-0">
                    <a href={`/products/${item.id}`} className="text-sm font-semibold text-white hover:text-purple-300 transition-colors line-clamp-2">
                      {item.name}
                    </a>
                    {item.variants && Object.keys(item.variants).length > 0 && (
                      <p className="text-xs text-purple-400/70 mt-0.5">
                        {Object.entries(item.variants).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                      </p>
                    )}
                    <p className="text-purple-400 font-black mt-1">{item.price} د</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => updateQuantity(item.cartKey, item.quantity - 1)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors">
                      <Minus size={12} />
                    </button>
                    <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.cartKey, item.quantity + 1)} disabled={item.quantity >= item.stock} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors disabled:opacity-30">
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
            <div className="bg-[#0f1320] border border-purple-500/20 rounded-2xl p-5 space-y-3">
              <h2 className="font-bold text-sm text-gray-400">ملخص الطلب</h2>
              <div className="space-y-2 text-sm">
                {items.map((item) => (
                  <div key={item.cartKey} className="flex justify-between text-gray-400">
                    <span className="truncate max-w-[200px]">{item.name} × {item.quantity}</span>
                    <span>{item.price * item.quantity} د</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-white/10 pt-3 flex justify-between items-center">
                <span className="font-bold text-white">الإجمالي</span>
                <span className="text-2xl font-black bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                  {total} د
                </span>
              </div>
            </div>

            {/* Notes */}
            <div className="bg-[#0f1320] border border-purple-500/20 rounded-2xl p-5">
              <label className="text-gray-400 text-sm font-medium mb-2 block">📝 ملاحظات للطلب (اختياري)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="أضف أي ملاحظات أو تعليمات خاصة بطلبك..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-purple-500/30 text-white text-sm focus:outline-none focus:border-purple-500/60 transition-all resize-none placeholder-gray-600"
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
                  : <><ShoppingBag size={18} /> تأكيد الطلب</>
                }
              </button>
              <a href="/products" className="w-full py-3 rounded-2xl font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center gap-2 transition-all text-sm">
                <ShoppingCart size={16} /> مواصلة التسوق
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
          <div className="bg-white rounded-3xl md:rounded-3xl rounded-b-none w-full md:w-[400px] max-h-[92vh] overflow-y-auto shadow-[0_24px_60px_rgba(0,0,0,0.35)]" dir="rtl"
            style={{ animation: "slideUp 0.25s cubic-bezier(0.22,1,0.36,1)" }}>
            <style>{`@keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>

            {/* ── STEP 1: Address ── */}
            {step === "address" && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-black text-gray-900">عنوان التسليم</h3>
                  <button onClick={closeModal} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
                    <X size={16} />
                  </button>
                </div>

                {/* Saved addresses */}
                {addresses.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {addresses.map((addr) => (
                      <button key={addr.id} onClick={() => setSelectedAddr(addr.id)}
                        className={`w-full flex items-start gap-3 p-3.5 rounded-2xl border-2 text-right transition-all ${selectedAddr === addr.id ? "border-purple-500 bg-purple-50" : "border-gray-100 bg-gray-50 hover:border-purple-300"}`}>
                        <MapPin size={18} className={`shrink-0 mt-0.5 ${selectedAddr === addr.id ? "text-purple-600" : "text-gray-400"}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`font-bold text-sm ${selectedAddr === addr.id ? "text-purple-700" : "text-gray-800"}`}>
                            {addr.label} {addr.is_default && <span className="text-xs font-medium text-purple-500">(افتراضي)</span>}
                          </p>
                          <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">{addr.address_text}</p>
                        </div>
                      </button>
                    ))}
                    <button onClick={() => setSelectedAddr("__new")}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 text-right transition-all ${selectedAddr === "__new" ? "border-purple-500 bg-purple-50" : "border-dashed border-gray-200 hover:border-purple-300"}`}>
                      <span className="text-2xl">+</span>
                      <span className={`text-sm font-medium ${selectedAddr === "__new" ? "text-purple-700" : "text-gray-500"}`}>إضافة عنوان جديد</span>
                    </button>
                  </div>
                )}

                {/* New address input */}
                {(selectedAddr === "__new" || addresses.length === 0) && (
                  <div className="space-y-3">
                    <textarea
                      value={newAddrText}
                      onChange={e => setNewAddrText(e.target.value)}
                      placeholder="أدخل عنوان التسليم التفصيلي..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-purple-400 transition-all resize-none placeholder:text-gray-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCartMap(!showCartMap)}
                      className="w-full py-2.5 rounded-xl border border-dashed border-purple-300 text-purple-600 text-sm font-medium flex items-center justify-center gap-2 hover:bg-purple-50 transition-colors"
                    >
                      <MapPin size={15} />
                      {showCartMap ? "إخفاء الخريطة" : "تحديد الموقع على الخريطة (اختياري)"}
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
                            ✅ تم تحديد الموقع: {newAddrLat.toFixed(4)}، {newAddrLng?.toFixed(4)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {payError && <p className="text-red-500 text-sm mt-3">⚠️ {payError}</p>}

                <button onClick={submitAddress}
                  className="mt-5 w-full py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-500 hover:opacity-90 transition-opacity text-sm">
                  التالي — اختيار طريقة الدفع →
                </button>
              </div>
            )}

            {/* ── STEP 2: Payment ── */}
            {step === "payment" && !edfaliStep && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-black text-gray-900">اختر طريقة الدفع</h3>
                  <button onClick={closeModal} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
                    <X size={16} />
                  </button>
                </div>
                <p className="text-sm text-gray-400 mb-5">المبلغ الإجمالي: <strong className="text-gray-900">{total} د.ل</strong></p>

                <div className="space-y-2 mb-4">
                  {PAYMENT_METHODS.map((pm) => (
                    <button key={pm.id} onClick={() => { setMethod(pm.id); setCardNumber(""); setPayError(""); }}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-right transition-all ${method === pm.id ? "border-purple-500 bg-purple-50" : "border-gray-100 bg-gray-50 hover:border-purple-200"}`}>
                      <span className="text-2xl w-9 text-center shrink-0">{pm.icon}</span>
                      <span className={`font-bold text-sm ${method === pm.id ? "text-purple-800" : "text-gray-800"}`}>{pm.name}</span>
                      {method === pm.id && <span className="mr-auto text-purple-500">✓</span>}
                    </button>
                  ))}
                </div>

                {/* Card number for DPay methods */}
                {method && PAYMENT_METHODS.find(p => p.id === method)?.needsCard && (
                  <div className="mb-4">
                    <label className="text-gray-600 text-xs mb-2 block flex items-center gap-1.5"><CreditCard size={12} /> رقم البطاقة</label>
                    <input
                      type="text"
                      placeholder="أدخل رقم البطاقة"
                      value={cardNumber}
                      onChange={e => setCardNumber(e.target.value.replace(/\D/g, ""))}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:border-purple-400 transition-all"
                      style={{ direction: "ltr", letterSpacing: 2 }}
                    />
                  </div>
                )}

                {payError && <p className="text-red-500 text-sm mb-3">⚠️ {payError}</p>}

                <button
                  onClick={() => {
                    if (!method) { setPayError("يرجى اختيار طريقة الدفع"); return; }
                    if (method === "cash") { setStep("processing"); payWithCash(); return; }
                    if (method === "edfali") { setEdfaliStep("phone"); return; }
                    if (method === "moamalat") { setStep("processing"); payWithMoamalat(); return; }
                    setStep("processing"); payWithDPay();
                  }}
                  disabled={ordering || !method}
                  className="w-full py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-500 hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
                >
                  {ordering ? <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "ادفع الآن →"}
                </button>

                <button onClick={() => { setStep("address"); setMethod(null); }} className="w-full mt-3 py-2.5 text-sm text-gray-400 hover:text-gray-700 transition-colors">
                  ← رجوع لاختيار العنوان
                </button>
              </div>
            )}

            {/* ── EDFALI: Phone step ── */}
            {step === "payment" && edfaliStep === "phone" && (
              <div className="p-6 text-center">
                <div className="text-4xl mb-4">🏧</div>
                <h3 className="text-lg font-black text-gray-900 mb-1">ادفع لي</h3>
                <p className="text-gray-500 text-sm mb-5">أدخل رقم هاتفك المرتبط بحساب <strong>ادفع لي</strong></p>
                <input
                  type="tel"
                  placeholder="0912345678"
                  value={edfaliPhone}
                  onChange={e => setEdfaliPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-xl text-center font-bold tracking-widest focus:outline-none focus:border-purple-400 transition-all mb-4"
                  style={{ direction: "ltr" }}
                  autoFocus
                />
                {payError && <p className="text-red-500 text-sm mb-3">⚠️ {payError}</p>}
                <button onClick={startEdfali} disabled={edfaliPhone.length < 9}
                  className="w-full py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-500 disabled:opacity-50 mb-3 text-sm">
                  إرسال رمز التحقق →
                </button>
                <button onClick={() => setEdfaliStep(null)} className="w-full py-2.5 text-sm text-gray-400 hover:text-gray-700 transition-colors">
                  ← رجوع
                </button>
              </div>
            )}

            {/* ── EDFALI: Sending ── */}
            {step === "payment" && edfaliStep === "sending" && (
              <div className="p-10 text-center">
                <div className="w-14 h-14 border-4 border-purple-100 border-t-purple-600 rounded-full animate-spin mx-auto mb-5" />
                <p className="text-gray-500 text-sm">⏳ جاري إرسال رمز التحقق...</p>
              </div>
            )}

            {/* ── EDFALI: OTP ── */}
            {step === "payment" && edfaliStep === "otp" && (
              <div className="p-6 text-center">
                <div className="text-4xl mb-4">🔐</div>
                <h3 className="text-lg font-black text-gray-900 mb-1">رمز التحقق</h3>
                <p className="text-gray-500 text-sm mb-5">أُرسل رمز مكوّن من <strong>4 أرقام</strong> إلى هاتفك <strong className="text-purple-600">{edfaliPhone}</strong></p>
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
                  {ordering ? <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "تأكيد الدفع ✓"}
                </button>
                <button onClick={() => { setEdfaliStep(null); setEdfaliOtp(""); setOrdering(false); }} className="w-full py-2.5 text-sm text-gray-400 hover:text-gray-700 transition-colors">
                  ← رجوع
                </button>
              </div>
            )}

            {/* ── Processing ── */}
            {step === "processing" && (
              <div className="p-10 text-center">
                <div className="w-14 h-14 border-4 border-purple-100 border-t-purple-600 rounded-full animate-spin mx-auto mb-5" />
                <p className="text-gray-700 font-medium mb-1">جاري معالجة الدفع...</p>
                <p className="text-gray-400 text-sm">لا تغلق هذه النافذة</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
