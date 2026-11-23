"use client";

import { AlertTriangle, CheckCircle2, Wrench, Lightbulb, Share2, ShoppingCart } from "lucide-react";

export type Issue = { title: string; severity: "low" | "medium" | "high"; cause: string; fixes: string[]; needsRepair: boolean };
export type Report = { score: number; summary: string; issues: Issue[]; tips: string[]; products: { id: string; name: string; price: number; image_url: string | null }[] };

const SEV: Record<Issue["severity"], { ar: string; cls: string }> = {
  low: { ar: "بسيطة", cls: "low" }, medium: { ar: "متوسطة", cls: "med" }, high: { ar: "مهمة", cls: "high" },
};

export default function ReportView({ report, id, device }: { report: Report; id?: string | null; device?: { model?: string; os?: string; osVersion?: string } }) {
  const color = report.score >= 80 ? "#22c55e" : report.score >= 55 ? "#f59e0b" : "#ef4444";
  const shareUrl = id ? `${typeof window !== "undefined" ? window.location.origin : ""}/diagnose/r/${id}` : "";
  const needsShop = report.issues.some((i) => i.needsRepair);

  const share = async () => {
    if (!shareUrl) return;
    const text = `تقرير فحص جهازي من محل ترند: ${report.score}/100`;
    try {
      if (navigator.share) await navigator.share({ title: "تقرير فحص الجهاز", text, url: shareUrl });
      else { await navigator.clipboard.writeText(shareUrl); alert("تم نسخ الرابط"); }
    } catch {}
  };

  return (
    <div className="dg-report space-y-4">
      <section className="gp-panel dg-score">
        <div className="dg-ring" style={{ ["--p" as string]: `${report.score}`, ["--c" as string]: color }}>
          <b>{report.score}</b><small>/100</small>
        </div>
        <div className="flex-1 min-w-0">
          <h2>صحة الجهاز</h2>
          {device?.model && <p className="dg-dev">{device.model}{device.os ? ` · ${device.os} ${device.osVersion || ""}` : ""}</p>}
          <p>{report.summary}</p>
        </div>
      </section>

      {report.issues.length === 0 ? (
        <section className="gp-panel dg-issue ok"><CheckCircle2 size={20} /> ما لقيناش أي مشكلة في الفحص. جهازك في حالة ممتازة 👌</section>
      ) : report.issues.map((i, k) => (
        <section key={k} className={`gp-panel dg-issue ${SEV[i.severity].cls}`}>
          <header>
            <AlertTriangle size={18} />
            <h3>{i.title}</h3>
            <span className="dg-sev">{SEV[i.severity].ar}</span>
          </header>
          {i.cause && <p className="dg-cause"><b>السبب المحتمل:</b> {i.cause}</p>}
          {i.fixes.length > 0 && (
            <ol className="dg-fixes">{i.fixes.map((f, j) => <li key={j}>{f}</li>)}</ol>
          )}
          {i.needsRepair && <p className="dg-shop"><Wrench size={15} /> هذي تحتاج فحص في المحل</p>}
        </section>
      ))}

      {report.tips.length > 0 && (
        <section className="gp-panel dg-tips">
          <h3><Lightbulb size={17} /> نصائح للحفاظ على جهازك</h3>
          <ul>{report.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </section>
      )}

      {report.products.length > 0 && (
        <section className="gp-panel dg-prods">
          <h3><ShoppingCart size={17} /> منتجات تفيدك</h3>
          <div className="dg-prod-grid">
            {report.products.map((p) => (
              <a key={p.id} href={`/products/${p.id}`}>
                {p.image_url && <img src={p.image_url} alt="" />}
                <span>{p.name}</span><b>{p.price} د.ل</b>
              </a>
            ))}
          </div>
        </section>
      )}

      <div className="dg-actions">
        {needsShop && (
          <a className="gp-btn gp-btn-main" href={`/?repair=1`}><Wrench size={17} /> احجز صيانة</a>
        )}
        {id && <button className="gp-btn gp-btn-ghost" onClick={share}><Share2 size={17} /> شارك التقرير</button>}
      </div>
    </div>
  );
}
