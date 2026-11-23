"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck, Trophy, Loader2, CheckCircle2, XCircle } from "lucide-react";
import DailyGift from "@/components/DailyGift";

type Draw = { day: string; gift_title: string; seed_hash: string; seed: string | null; entries_count: number | null; entries_hash: string | null; winner_name: string | null; drawn: boolean; claimed: boolean; redraws: number; disqualified: number[] };
type Data = { history: Draw[]; myWins: { day: string; gift_title: string; claim_code: string; claimed: boolean }[] };

const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
async function sha256(s: string) { return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))); }
async function hmac(key: string, msg: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg)));
}

/** Re-runs the draw in the visitor's browser from the published data. */
async function verify(d: Draw): Promise<{ ok: boolean; lines: string[] }> {
  const lines: string[] = [];
  if (!d.seed) return { ok: false, lines: ["البذرة لم تُكشف بعد"] };
  const h = await sha256(d.seed);
  const c1 = h === d.seed_hash;
  lines.push(`${c1 ? "✓" : "✗"} بصمة البذرة المنشورة قبل السحب تطابق البذرة المكشوفة`);
  const r = await fetch(`/api/gift/entries?day=${d.day}`);
  const list = await r.text();
  const eh = await sha256(list);
  const c2 = eh === d.entries_hash;
  lines.push(`${c2 ? "✓" : "✗"} قائمة المشاركين (${list ? list.split("\n").length : 0}) تطابق البصمة المسجّلة`);
  if (!list) return { ok: c1 && c2, lines: [...lines, "لا يوجد مشاركين في هذا اليوم"] };
  const rows = list.split("\n");
  const idx = Number(BigInt("0x" + (await hmac(d.seed, eh))) % BigInt(rows.length));
  lines.push(`→ الفائز الأول = المشارك رقم ${idx + 1} في القائمة (المعرّف ${rows[idx]})`);
  if (d.redraws > 0) {
    // Winners disqualified after the draw are skipped; the redraw uses the same seed + ":rN".
    const cand = rows.filter((r) => !d.disqualified.includes(Number(r.split(":")[0])));
    const j = Number(BigInt("0x" + (await hmac(d.seed, `${eh}:r${d.redraws}`))) % BigInt(cand.length || 1));
    lines.push(`↻ أُعيد السحب ${d.redraws} مرة بعد استبعاد فائز مخالف → الفائز النهائي: ${cand[j] || "-"}`);
  }
  return { ok: c1 && c2, lines };
}

export default function GiftPage() {
  const [d, setD] = useState<Data | null>(null);
  const [res, setRes] = useState<Record<string, { ok: boolean; lines: string[] } | "busy">>({});
  useEffect(() => { fetch("/api/gift").then((r) => r.json()).then(setD); }, []);

  const check = async (x: Draw) => { setRes((p) => ({ ...p, [x.day]: "busy" })); const r = await verify(x); setRes((p) => ({ ...p, [x.day]: r })); };

  return (
    <div dir="rtl" className="min-h-screen flex flex-col">
      <header className="gp-top flex items-center gap-4 px-6 py-4">
        <a href="/" className="text-[var(--muted)] hover:text-[var(--text)]"><ArrowRight size={20} /></a>
        <h1 className="text-lg font-bold">هدية اليوم</h1>
      </header>
      <div className="gp-wrap gp-narrow w-full space-y-5">
        <DailyGift />

        {!!d?.myWins.length && (
          <section className="gp-panel p-5 space-y-2">
            <h2 className="font-bold flex items-center gap-2"><Trophy size={18} className="text-amber-400" /> هداياك</h2>
            {d.myWins.map((w) => (
              <div key={w.day} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="flex-1">{w.gift_title} · {w.day}</span>
                <b dir="ltr" className="font-mono tracking-widest">{w.claim_code}</b>
                <span className={w.claimed ? "text-green-400" : "text-amber-400"}>{w.claimed ? "تم الاستلام" : "بانتظار الاستلام — اعرض الكود في المحل"}</span>
              </div>
            ))}
          </section>
        )}

        <section className="gp-panel p-5 space-y-3 text-sm leading-7">
          <h2 className="font-bold flex items-center gap-2 text-base"><ShieldCheck size={18} /> كيف نضمن إن السحب عادل وما فيش تدخل؟</h2>
          <ol className="list-decimal pr-5 space-y-1">
            <li>كل يوم السيستم يولّد <b>رقم سري عشوائي (بذرة)</b>، وينشر <b>بصمته</b> فقط قبل ما تبدأ المشاركة — فلا نحن ولا غيرنا نقدر نغيّره بعدين.</li>
            <li>المشاركات تتسجّل بالترتيب، وكل مشارك له معرّف مجهول.</li>
            <li>الساعة 9 بالليل يُحسب الفائز تلقائياً: <code dir="ltr">HMAC-SHA256(البذرة, بصمة القائمة) mod عدد المشاركين</code>.</li>
            <li>بعد السحب تنكشف البذرة والقائمة، وتقدر تعيد الحساب بنفسك بزر «تحقق» تحت — يشتغل في متصفحك أنت.</li>
            <li>الفائز يوصله <b>كود استلام</b> في حسابه وفي الإشعارات، والمحل يتأكد من الكود وهوية الفائز قبل التسليم.</li>
            <li><b>الحماية من الاحتيال:</b> مشاركة وحدة لكل شخص مربوطة برقم الهاتف والجهاز والشبكة؛ الحسابات الأحدث من 3 أيام ما تشاركش؛ كثرة الحسابات من نفس الشبكة تُستبعد كلها؛ والفائز ما يشاركش 30 يوم بعد فوزه. المستبعدين ما يدخلوش في القائمة المنشورة.</li>
          </ol>
        </section>

        <section className="gp-panel p-5 space-y-3">
          <h2 className="font-bold">النتائج السابقة</h2>
          {!d ? <Loader2 className="animate-spin" /> : d.history.length === 0 ? <p className="text-sm text-[var(--muted)]">ما فيش سحوبات سابقة لحد الآن.</p> : d.history.map((x) => {
            const r = res[x.day];
            return (
              <div key={x.day} className="rounded-xl border border-white/10 p-3 text-sm space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="flex-1">{x.day} · {x.gift_title}</b>
                  <span>{x.winner_name ? <>🏆 {x.winner_name}</> : "لا يوجد مشاركين"} · {x.entries_count} مشارك</span>
                  <button onClick={() => check(x)} className="gp-btn gp-btn-ghost text-xs px-3 py-1.5">تحقق</button>
                </div>
                <p className="text-[11px] text-[var(--muted)] break-all" dir="ltr">seed hash: {x.seed_hash}<br />seed: {x.seed}</p>
                {r === "busy" && <Loader2 size={15} className="animate-spin" />}
                {r && r !== "busy" && (
                  <div className={`rounded-lg p-2 ${r.ok ? "bg-green-500/10 text-green-300" : "bg-red-500/10 text-red-300"}`}>
                    <p className="font-bold flex items-center gap-1">{r.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />} {r.ok ? "السحب سليم ومطابق" : "في عدم تطابق"}</p>
                    {r.lines.map((l, i) => <p key={i} className="text-xs">{l}</p>)}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
