"use client";

import { useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function MoamalatPayContent() {
  const params    = useSearchParams();
  const scriptRef = useRef(false);

  const MID               = params.get("mid") ?? "";
  const TID               = params.get("tid") ?? "";
  const AmountTrxn        = params.get("amount") ?? "";
  const MerchantReference = params.get("ref") ?? "";
  const TrxDateTime       = params.get("datetime") ?? "";
  const SecureHash        = params.get("hash") ?? "";
  const scriptUrl         = params.get("script") ?? "https://npg.moamalat.net:6006/js/lightbox.js";
  const returnUrl         = params.get("return") ?? "/";
  const cancelUrl         = params.get("cancel") ?? "/";

  useEffect(() => {
    if (scriptRef.current) return;
    scriptRef.current = true;

    if (!MID || !TID || !AmountTrxn || !SecureHash) return;

    const load = () => {
      (window as any).Lightbox.Checkout.configure = {
        MID,
        TID,
        AmountTrxn,
        MerchantReference,
        TrxDateTime,
        SecureHash,
        completeCallback: () => {
          const sep = returnUrl.includes("?") ? "&" : "?";
          window.location.href = returnUrl + sep + "paid=1";
        },
        errorCallback:    () => { window.location.href = cancelUrl + (cancelUrl.includes("?") ? "&" : "?") + "err=payment"; },
        cancelCallback:   () => { window.location.href = cancelUrl; },
      };
      (window as any).Lightbox.Checkout.showLightbox();
    };

    if (document.getElementById("moamalat-lb")) { load(); return; }
    const s = document.createElement("script");
    s.id = "moamalat-lb";
    s.src = scriptUrl;
    s.onload = load;
    document.head.appendChild(s);
  }, [MID, TID, AmountTrxn, MerchantReference, TrxDateTime, SecureHash, scriptUrl, returnUrl, cancelUrl]);

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center" dir="rtl">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[var(--muted)] text-sm">جارٍ تحميل بوابة الدفع...</p>
      </div>
    </div>
  );
}

export default function MoamalatPayPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <MoamalatPayContent />
    </Suspense>
  );
}
