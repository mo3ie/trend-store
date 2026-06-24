"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle, Package, ArrowLeft, ShoppingCart } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import LangToggle from "@/components/LangToggle";

function SuccessContent() {
  const params  = useSearchParams();
  const orderId = params.get("orderId");
  const via     = params.get("via");
  const paid    = params.get("paid");
  const { t, rtl } = useLang();

  const [dots, setDots] = useState(".");
  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d.length < 3 ? d + "." : ".")), 500);
    return () => clearInterval(t);
  }, []);

  // Confirm Moamalat payment immediately after returning from trendstore-ly.com/moamalat-pay
  useEffect(() => {
    if (via === "moamalat" && paid === "1" && orderId) {
      fetch("/api/payment/moamalat/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      }).catch(() => {});
    }
  }, [via, paid, orderId]);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col items-center justify-center p-6" dir={rtl ? "rtl" : "ltr"}>
      <div className="absolute top-5 end-5"><LangToggle /></div>
      <div className="fixed top-[-150px] right-[-150px] w-[500px] h-[500px] bg-green-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-md w-full space-y-6 text-center relative z-10">

        {/* Icon */}
        <div className="w-24 h-24 rounded-full bg-green-500/20 border-2 border-green-500/40 flex items-center justify-center mx-auto shadow-[0_0_40px_rgba(34,197,94,0.3)]">
          <CheckCircle size={52} className="text-green-400" />
        </div>

        {/* Title */}
        <div>
          <h1 className="text-3xl font-black text-[var(--text)] mb-2">{t("تم الطلب بنجاح! 🎉", "Order placed successfully! 🎉")}</h1>
          <p className="text-[var(--muted)] text-sm leading-relaxed">
            {t("شكراً لك! تم استلام طلبك وسنتواصل معك قريباً لتأكيد التسليم.", "Thank you! We've received your order and will contact you soon to confirm delivery.")}
          </p>
        </div>

        {/* Order ID */}
        {orderId && (
          <div className="bg-[var(--surface)] border border-green-500/20 rounded-2xl p-5">
            <p className="text-[var(--muted-2)] text-xs mb-1">{t("رقم الطلب", "Order number")}</p>
            <p className="text-[var(--text)] font-black text-lg tracking-widest">
              #{orderId.slice(0, 12).toUpperCase()}
            </p>
            {via && (
              <p className="text-[var(--muted-2)] text-xs mt-2">
                {t("طريقة الدفع:", "Payment method:")} {via === "cash" ? t("الدفع عند الاستلام", "Cash on delivery") : via === "dpay" ? t("بوابة DPay", "DPay gateway") : via === "moamalat" ? t("معاملات", "Moamalat") : via === "yusor" ? t("يسر باي", "Yusor Pay") : via === "edfali" ? t("ادفع لي", "Edfali") : via}
              </p>
            )}
          </div>
        )}

        {/* Steps */}
        <div className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl p-5 text-start">
          <h3 className="font-bold text-sm text-purple-300 mb-4">{t("ماذا يحدث بعد ذلك؟", "What happens next?")}</h3>
          <div className="space-y-3">
            {[
              { step: "1", text: t("سيتصل بك فريقنا لتأكيد تفاصيل الطلب", "Our team will call you to confirm your order details"), done: true },
              { step: "2", text: t("سيتم تجهيز الطلب وشحنه إليك", "Your order will be prepared and shipped to you"), done: false },
              { step: "3", text: t("يمكنك تتبع حالة طلبك في أي وقت", "You can track your order status anytime"), done: false },
            ].map(({ step, text, done }) => (
              <div key={step} className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5 ${done ? "bg-green-500 text-[var(--text)]" : "bg-purple-500/20 border border-purple-500/30 text-purple-400"}`}>
                  {step}
                </div>
                <p className="text-sm text-[var(--muted)] leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <a
            href="/orders"
            className="w-full py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-500 hover:shadow-[0_0_24px_rgba(168,85,247,0.5)] transition-all flex items-center justify-center gap-2"
          >
            <Package size={18} /> {t("تتبع طلبك", "Track your order")}
          </a>
          <a
            href="/products"
            className="w-full py-3 rounded-2xl font-medium text-[var(--muted)] hover:text-[var(--text)] bg-white/5 hover:bg-white/10 border border-[var(--border)] flex items-center justify-center gap-2 transition-all text-sm"
          >
            <ShoppingCart size={16} /> {t("مواصلة التسوق", "Continue shopping")}
          </a>
          <a
            href="/"
            className="flex items-center justify-center gap-1 text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            <ArrowLeft size={14} /> {t("العودة للرئيسية", "Back to home")}
          </a>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <span className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
