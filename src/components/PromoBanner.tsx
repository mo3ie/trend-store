"use client";

import { useEffect, useRef, useState } from "react";
import { Gift, ShieldCheck, Microscope, ShoppingBag, CreditCard, Trophy, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

type Product = { id: string; name: string; price: number; image_url?: string | null };
type Slide = { key: string; kicker: string; title: string; sub: string; cta: string; href: string; theme: string; Icon: typeof Gift; img?: string | null };

/**
 * Animated promo banner: auto-rotating slides (swipe on phones, pause on hover),
 * built from live features + one real product — no stock photos.
 */
export default function PromoBanner({ products }: { products: Product[] }) {
  const deal = products.find((p) => p.image_url && !String(p.image_url).startsWith("data:")) || products.find((p) => p.image_url);
  const slides: Slide[] = [
    { key: "gift", kicker: "كل يوم 9 بالليل", title: "هدية اليوم مجاناً", sub: "جاوب سؤال اليوم وادخل السحب — نزيه وتقدر تتحقق منه بنفسك", cta: "شارك الآن", href: "/gift", theme: "gold", Icon: Gift },
    ...(deal ? [{ key: "deal", kicker: "وصل جديد", title: deal.name, sub: `بسعر ${deal.price} د.ل — متوفر في محل ترند`, cta: "شوف المنتج", href: `/products/${deal.id}`, theme: "cyan", Icon: Sparkles, img: deal.image_url }] : []),
    { key: "market", kicker: "جديد", title: "سوق المستعمل بضمان", sub: "بيع واشري مستعمل — ترند تمسك الفلوس لين تستلم وتتأكد", cta: "ادخل السوق", href: "/market", theme: "teal", Icon: ShieldCheck },
    { key: "deep", kicker: "5 د.ل فقط", title: "الفحص العميق للآيفون", sub: "صحة البطارية الحقيقية وأعطال النظام — من جوالك بدون كابل", cta: "افحص جهازك", href: "/deep-scan", theme: "violet", Icon: Microscope },
    { key: "shein", kicker: "توصيل لكل ليبيا", title: "اطلب من شي إن", sub: "سعر السلة بالدينار في ثواني — وادفع بالطريقة اللي تناسبك", cta: "ابدأ طلبك", href: "https://order.trendstore-ly.com", theme: "pink", Icon: ShoppingBag },
    { key: "cards", kicker: "محلية ودولية", title: "كروت الشحن والألعاب", sub: "ليبيانا، المدار، PlayStation، iTunes، PUBG… من محفظتك", cta: "تصفّح الكروت", href: "/cards", theme: "blue", Icon: CreditCard },
    { key: "games", kicker: "جوائز أسبوعية", title: "تحديات ترند", sub: "العب كل يوم، اجمع نقاط، وأعلى 3 يفوزوا", cta: "العب الآن", href: "/games", theme: "lime", Icon: Trophy },
  ];
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef<number | null>(null);
  const n = slides.length;

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setI((x) => (x + 1) % n), 5200);
    return () => clearTimeout(t);
  }, [i, paused, n]);

  const go = (d: number) => setI((x) => (x + d + n) % n);

  return (
    <section className="pb" aria-label="العروض" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; setPaused(true); }}
      onTouchEnd={(e) => { if (touch.current != null) { const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); } touch.current = null; setPaused(false); }}>
      {slides.map((s, k) => {
        const I = s.Icon;
        return (
          <a key={s.key} href={s.href} className={`pb-slide t-${s.theme} ${k === i ? "on" : ""}`} aria-hidden={k !== i} tabIndex={k === i ? 0 : -1}>
            <span className="pb-orb o1" /><span className="pb-orb o2" /><span className="pb-grid" />
            <div className="pb-copy">
              <span className="pb-kicker">{s.kicker}</span>
              <h2>{s.title}</h2>
              <p>{s.sub}</p>
              <span className="pb-cta">{s.cta} <ChevronLeft size={16} /></span>
            </div>
            <div className="pb-art">
              {s.img ? <img src={s.img} alt="" /> : <span className="pb-icon"><I size={64} strokeWidth={1.6} /></span>}
              <span className="pb-ring" />
            </div>
          </a>
        );
      })}
      <div className="pb-nav">
        <button onClick={(e) => { e.preventDefault(); go(-1); }} aria-label="السابق"><ChevronRight size={18} /></button>
        <div className="pb-dots">{slides.map((s, k) => <button key={s.key} onClick={() => setI(k)} className={k === i ? "on" : ""} aria-label={s.title}><i style={{ animationPlayState: paused ? "paused" : "running" }} /></button>)}</div>
        <button onClick={(e) => { e.preventDefault(); go(1); }} aria-label="التالي"><ChevronLeft size={18} /></button>
      </div>
    </section>
  );
}
