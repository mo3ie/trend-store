"use client";

import { useSale } from "@/hooks/useSale";
import { useLang } from "@/hooks/useLang";
import { fmtLibyaTime } from "@/lib/sale";

/**
 * Big «الجمعة البيضاء» header. Shows only while the offer is on (admin → appearance).
 * Before buying opens: a live countdown + "prepare your cart". After: "buying is open".
 */
export default function SaleBanner({ compact = false }: { compact?: boolean }) {
  const { sale, state } = useSale();
  const { t, lang } = useLang();
  if (!sale || !state.on) return null;

  const ar = lang === "ar";
  const upTo = Math.max(0, Math.min(99, Math.round(Number(sale.upTo) || 0)));
  const s = Math.floor(state.msLeft / 1000);
  const parts = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
  const labels = ar ? ["ساعة", "دقيقة", "ثانية"] : ["hrs", "min", "sec"];

  return (
    <section className={`wf${compact ? " wf-compact" : ""}`} aria-label={sale.title || t("الجمعة البيضاء", "White Friday")}>
      <div className="wf-glow" aria-hidden="true" />
      <div className="wf-in">
        <div className="wf-txt">
          <span className="wf-kicker">{t("عروض لفترة محدودة", "Limited-time offers")}</span>
          <h2 className="wf-title">{sale.title || t("الجمعة البيضاء", "White Friday")}</h2>
          {sale.subtitle && <p className="wf-sub">{sale.subtitle}</p>}
          {state.locked && state.opensAt ? (
            <p className="wf-note">{t(`الشراء يبدأ الساعة ${fmtLibyaTime(state.opensAt)} — جهّز سلتك الآن`, `Buying opens at ${fmtLibyaTime(state.opensAt, false)} — fill your cart now`)}</p>
          ) : (
            <p className="wf-note wf-open"><i />{t("الشراء متاح الآن", "Buying is open now")}</p>
          )}
          <a className="wf-cta" href="/products">{state.locked ? t("تصفّح العروض", "Browse offers") : t("تسوّق العروض الآن", "Shop the offers")}</a>
        </div>
        <div className="wf-side">
          {upTo > 0 && (
            <div className="wf-pct">
              <small>{t("تخفيضات تصل إلى", "Up to")}</small>
              <b><span>%</span>{upTo}</b>
              {!ar && <small>off</small>}
            </div>
          )}
          {state.locked && (
            <div className="wf-cd" role="timer" aria-live="off">
              {parts.map((v, i) => (
                <span key={i} className="wf-box"><b>{String(v).padStart(2, "0")}</b><small>{labels[i]}</small></span>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`
.wf{position:relative;overflow:hidden;border-radius:26px;margin:0 0 18px;color:#fff;background:radial-gradient(120% 140% at 85% 0%,#1d2a3a 0%,#0b0f17 55%,#05070b 100%);border:1px solid rgba(255,255,255,.12);box-shadow:0 18px 50px rgba(0,0,0,.35);isolation:isolate}
.wf-glow{position:absolute;inset:-40% -10% auto auto;width:70%;height:180%;background:radial-gradient(closest-side,rgba(85,230,230,.35),transparent 70%);filter:blur(10px);z-index:-1;animation:wfpulse 5s ease-in-out infinite}
.wf::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(115deg,transparent 0 22px,rgba(255,255,255,.025) 22px 44px);z-index:-1}
@keyframes wfpulse{50%{opacity:.6;transform:scale(1.08)}}
.wf-in{display:flex;align-items:center;justify-content:space-between;gap:22px;padding:30px 34px;flex-wrap:wrap}
.wf-txt{flex:1 1 300px;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:8px}
.wf-kicker{font-size:12.5px;font-weight:800;letter-spacing:.04em;padding:5px 12px;border-radius:999px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18)}
.wf-title{margin:0;font-size:clamp(34px,6vw,58px);font-weight:900;line-height:1.08;background:linear-gradient(180deg,#fff 30%,#bdf3f3);-webkit-background-clip:text;background-clip:text;color:transparent}
.wf-sub{margin:0;font-size:16px;color:rgba(255,255,255,.82)}
.wf-note{margin:2px 0 0;font-size:14.5px;font-weight:700;color:#ffd27a;display:flex;align-items:center;gap:8px}
.wf-open{color:#7ff5c4}.wf-open i{width:9px;height:9px;border-radius:50%;background:#2ee59d;box-shadow:0 0 0 0 rgba(46,229,157,.6);animation:wfdot 1.6s infinite}
@keyframes wfdot{70%{box-shadow:0 0 0 9px rgba(46,229,157,0)}100%{box-shadow:0 0 0 0 rgba(46,229,157,0)}}
.wf-cta{margin-top:8px;display:inline-flex;align-items:center;height:46px;padding:0 24px;border-radius:14px;background:#fff;color:#0b0f17;font-weight:900;font-size:15px;text-decoration:none;transition:transform .15s}
.wf-cta:hover{transform:translateY(-2px)}
.wf-side{display:flex;flex-direction:column;align-items:center;gap:14px;flex:0 1 auto}
.wf-pct{display:flex;flex-direction:column;align-items:center;line-height:1}
.wf-pct small{font-size:15px;font-weight:800;color:rgba(255,255,255,.85)}
.wf-pct b{font-size:clamp(72px,12vw,120px);font-weight:900;letter-spacing:-.03em;background:linear-gradient(180deg,#fff,#7fe8e8);-webkit-background-clip:text;background-clip:text;color:transparent;display:flex;align-items:flex-start;direction:ltr}
.wf-pct b span{font-size:.42em;margin-top:.18em}
.wf-cd{display:flex;gap:8px;direction:ltr}
.wf-box{display:flex;flex-direction:column;align-items:center;min-width:62px;padding:9px 6px;border-radius:14px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(6px)}
.wf-box b{font-size:26px;font-weight:900;font-variant-numeric:tabular-nums}
.wf-box small{font-size:11px;color:rgba(255,255,255,.7);margin-top:2px}
.wf-compact .wf-in{padding:20px 22px}.wf-compact .wf-title{font-size:clamp(28px,5vw,42px)}.wf-compact .wf-pct b{font-size:clamp(56px,9vw,84px)}
@media (max-width:640px){.wf{border-radius:20px}.wf-in{padding:22px 18px;gap:16px}.wf-side{width:100%;flex-direction:row;justify-content:space-between;align-items:center}.wf-box{min-width:52px;padding:7px 4px}.wf-box b{font-size:21px}.wf-cta{height:42px}}
html.light .wf{box-shadow:0 14px 36px rgba(15,23,42,.18)}
`}</style>
    </section>
  );
}
