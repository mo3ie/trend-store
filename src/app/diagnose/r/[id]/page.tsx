"use client";

import { use, useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import ReportView, { type Report } from "../../Report";

export default function SharedReport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<{ report: Report | null; device?: { model?: string; os?: string; osVersion?: string }; created_at?: string } | null>(null);
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
            <ReportView report={data.report} device={data.device} />
            <a href="/diagnose" className="gp-btn gp-btn-ghost w-full">افحص جهازك أنت</a>
          </>
        ) : <div className="gp-panel p-8 text-center">التقرير غير مكتمل.</div>}
      </div>
    </div>
  );
}
