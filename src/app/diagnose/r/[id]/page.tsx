"use client";

import { use, useEffect, useState } from "react";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import ReportView, { type Report } from "../../Report";

type Deep = {
  device: { model?: string; ios?: string; serialMasked?: string; color?: string; activation?: string };
  battery: { healthPct?: number; cycles?: number; designMah?: number; fullMah?: number };
  storage: { totalGb?: number; freeGb?: number };
  panics: { last30d: number; total: number; reasons: string[] };
  scannedAt: string;
};

/** «شهادة فحص عميق» — data read straight from the iPhone over USB at the shop. */
function DeepCert({ d, notes }: { d: Deep; notes?: string | null }) {
  const h = d.battery.healthPct;
  const hc = h == null ? "" : h >= 85 ? "text-green-400" : h >= 80 ? "text-amber-400" : "text-red-400";
  return (
    <section className="gp-panel p-5 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="text-cyan-300" />
        <div className="flex-1"><b>شهادة فحص عميق — محل ترند</b><p className="text-xs text-[var(--muted)]">قراءة مباشرة من الجهاز بالكابل · {new Date(d.scannedAt).toLocaleString("ar-LY")}</p></div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        <div className="rounded-xl bg-white/5 p-3"><small className="text-[var(--muted)] block">الجهاز</small><b>{d.device.model}</b><small className="block">iOS {d.device.ios} · {d.device.serialMasked}</small></div>
        <div className="rounded-xl bg-white/5 p-3"><small className="text-[var(--muted)] block">صحة البطارية</small><b className={"text-xl " + hc}>{h != null ? h + "%" : "—"}</b><small className="block">{d.battery.cycles != null ? d.battery.cycles + " دورة" : ""}</small></div>
        <div className="rounded-xl bg-white/5 p-3"><small className="text-[var(--muted)] block">التخزين</small><b>{d.storage.totalGb ? d.storage.totalGb + "GB" : "—"}</b><small className="block">{d.storage.freeGb != null ? "فاضي " + d.storage.freeGb + "GB" : ""}</small></div>
        <div className="rounded-xl bg-white/5 p-3"><small className="text-[var(--muted)] block">أعطال النظام (30 يوم)</small><b className={"text-xl " + (d.panics.last30d ? "text-red-400" : "text-green-400")}>{d.panics.last30d}</b><small className="block">الكل {d.panics.total}</small></div>
      </div>
      {notes && <p className="text-sm"><b>ملاحظات الفني:</b> {notes}</p>}
    </section>
  );
}

export default function SharedReport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<{ report: Report | null; device?: { model?: string; os?: string; osVersion?: string; deep?: boolean }; results?: { deep?: Deep; notes?: string | null }; created_at?: string } | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    fetch(`/api/ai/diagnose?id=${encodeURIComponent(id)}`).then(async (r) => {
      if (!r.ok) { setMissing(true); return; }
      setData(await r.json());
    }).catch(() => setMissing(true));
  }, [id]);

  return (
    <div dir="rtl" className="min-h-screen flex flex-col">
      <header className="gp-top flex items-center gap-4 px-6 py-4">
        <a href="/diagnose" className="text-[var(--muted)] hover:text-[var(--text)]"><ArrowRight size={20} /></a>
        <h1 className="text-lg font-bold">تقرير فحص الجهاز</h1>
      </header>
      <div className="gp-wrap gp-narrow w-full space-y-4">
        {missing ? (
          <div className="gp-panel p-8 text-center">التقرير غير موجود.</div>
        ) : !data ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>
        ) : data.report ? (
          <>
            {data.created_at && <p className="dg-note">تاريخ الفحص: {new Date(data.created_at).toLocaleString("ar-EG")}</p>}
            {data.results?.deep && <DeepCert d={data.results.deep} notes={data.results.notes} />}
            <ReportView report={data.report} device={data.device} />
            <a href="/diagnose" className="gp-btn gp-btn-ghost w-full">افحص جهازك أنت</a>
          </>
        ) : <div className="gp-panel p-8 text-center">التقرير غير مكتمل.</div>}
      </div>
    </div>
  );
}
