"use client";

import { Stethoscope, Monitor, Hand, Volume2, Camera, BatteryMedium, Cpu, Wifi, Sparkles, ShieldCheck } from "lucide-react";

/**
 * Homepage feature block for «افحص جهازك»: an animated phone being scanned,
 * the checks lighting up one by one, and a strong call to action.
 */
const CHECKS = [
  { Icon: Monitor, ar: "الشاشة" }, { Icon: Hand, ar: "اللمس" }, { Icon: Volume2, ar: "الصوت" },
  { Icon: Camera, ar: "الكاميرا" }, { Icon: BatteryMedium, ar: "البطارية" }, { Icon: Cpu, ar: "الأداء" },
  { Icon: Wifi, ar: "الشبكة" },
];

export default function DiagnoseShowcase() {
  return (
    <section className="dx" aria-label="افحص جهازك">
      <div className="dx-copy">
        <span className="dx-kicker"><Sparkles size={13} /> جديد · مجاني</span>
        <h2>افحص جوالك في دقيقتين</h2>
        <p>فحص ذكي من المتصفح بدون تحميل أي تطبيق: الشاشة، اللمس، السماعات، المايك، الكاميرات، الحساسات والأداء — والذكاء الاصطناعي يكتبلك تقرير بالأعطال وحلولها خطوة بخطوة. مناسب للآيفون والأندرويد.</p>
        <div className="dx-chips">
          {CHECKS.map(({ Icon, ar }, i) => (
            <span key={ar} style={{ animationDelay: `${i * 0.45}s` }}><Icon size={14} />{ar}</span>
          ))}
        </div>
        <div className="dx-cta">
          <a href="/diagnose" className="dx-btn"><Stethoscope size={18} /> ابدأ الفحص الآن</a>
          <span className="dx-note"><ShieldCheck size={14} /> بدون تسجيل · تقرير تشاركه</span>
        </div>
      </div>

      <a href="/diagnose" className="dx-phone" aria-hidden tabIndex={-1}>
        <span className="dx-ring r1" /><span className="dx-ring r2" />
        <span className="dx-body">
          <span className="dx-notch" />
          <span className="dx-screen">
            <span className="dx-scan" />
            <span className="dx-score"><b>92</b><small>/100</small></span>
            <span className="dx-rows">
              {CHECKS.slice(0, 5).map(({ ar }, i) => (
                <span key={ar} style={{ animationDelay: `${0.6 + i * 0.5}s` }}><i />{ar}<em>✓</em></span>
              ))}
            </span>
          </span>
        </span>
      </a>
    </section>
  );
}
