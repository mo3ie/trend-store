"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Radio, Users, Crown, Activity, Loader2, Search, X, Eye, MousePointerClick, Clock, LogIn, ShoppingBag, UserPlus, RefreshCw, Smartphone } from "lucide-react";

// ── labels ─────────────────────────────────────────────────────────────────────
const PAGE_NAMES: [RegExp, string][] = [
  [/^\/$/, "الرئيسية"], [/^\/products\/:id/, "صفحة منتج"], [/^\/products/, "المنتجات"], [/^\/cart/, "السلة"],
  [/^\/orders/, "طلباتي"], [/^\/account/, "حسابي"], [/^\/login/, "تسجيل الدخول"], [/^\/register/, "إنشاء حساب"],
  [/^\/cards/, "الكروت"], [/^\/electricity/, "شحن الكهرباء"], [/^\/recharge/, "الشحن المباشر"], [/^\/market/, "سوق المستعمل"],
  [/^\/gift/, "هدية اليوم"], [/^\/games/, "الألعاب"], [/^\/diagnose/, "فحص الجهاز"], [/^\/deep-scan/, "الفحص العميق"],
  [/^\/facebook\/pages/, "فيسبوك — صفحاتي"], [/^\/facebook/, "أدوات فيسبوك"], [/^\/ads\/create/, "إنشاء إعلان"], [/^\/ads\/checkout/, "دفع إعلان"],
  [/^\/ads\/connect/, "ربط صفحة (إعلانات)"], [/^\/ads/, "الإعلانات"], [/^\/bot/, "بوت الرد"], [/^\/studio/, "الموظف الذكي"],
  [/^\/subscriptions/, "الاشتراكات"], [/^\/tiktok/, "أدوات تيك توك"], [/^\/our-sites/, "مواقعنا"], [/^\/privacy/, "الخصوصية"], [/^\/terms/, "الشروط"],
];
const pageName = (p: string) => { const base = (p || "/").split("?")[0]; const hit = PAGE_NAMES.find(([re]) => re.test(base)); return hit ? hit[1] : base; };
const OPS: Record<string, { label: string; color: string }> = {
  order: { label: "طلبات المتجر", color: "#8b5cf6" }, wallet: { label: "المحفظة", color: "#0ea5e9" }, card: { label: "الكروت", color: "#f59e0b" },
  utility: { label: "الكهرباء والشحن", color: "#eab308" }, subscription: { label: "الاشتراكات", color: "#10b981" }, market: { label: "شراء مستعمل", color: "#ec4899" },
  listing: { label: "إعلانات المستعمل", color: "#f472b6" }, maintenance: { label: "الصيانة", color: "#64748b" }, ad: { label: "الحملات الإعلانية", color: "#3b82f6" },
};
const PRODUCTS: Record<string, string> = { bot: "بوت الرد", ads: "الإعلانات", studio: "الموظف الذكي", tiktok_bot: "بوت تيك توك" };

const n = (v: unknown) => Number(v || 0).toLocaleString("ar-LY");
const money = (v: unknown) => `${Number(v || 0).toLocaleString("ar-LY", { maximumFractionDigits: 2 })} د.ل`;
const dt = (s?: string | null) => (s ? new Intl.DateTimeFormat("ar-LY", { timeZone: "Africa/Tripoli", dateStyle: "medium", timeStyle: "short" }).format(new Date(s)) : "—");
function ago(s?: string | null) {
  if (!s) return "—";
  const m = Math.round((Date.now() - new Date(s).getTime()) / 60000);
  if (m < 1) return "الآن"; if (m < 60) return `قبل ${m} د`; const h = Math.round(m / 60); if (h < 24) return `قبل ${h} س`; return `قبل ${Math.round(h / 24)} يوم`;
}
const secs = (v?: number | null) => { if (v == null) return "—"; const s = Math.round(v); return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} د` : `${s} ث`; };

const card = "bg-[var(--surface)] border border-purple-500/20 rounded-2xl";
const ACCENT = "#8b5cf6";

type Tab = "overview" | "live" | "users" | "subs" | "ops";
/* eslint-disable @typescript-eslint/no-explicit-any */

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [days, setDays] = useState(7);
  const [res, setRes] = useState<{ tab: Tab; d: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    const qs = new URLSearchParams({ type: tab, days: String(days) });
    if (tab === "users" && q.trim()) qs.set("q", q.trim());
    const r = await fetch(`/api/admin/reports?${qs}`, { cache: "no-store" });
    const d = await r.json().catch(() => null);
    if (!r.ok) setErr(d?.error || "تعذّر تحميل التقرير"); else setRes({ tab, d });
    setLoading(false);
  }, [tab, days, q]);

  useEffect(() => { const tm = setTimeout(load, tab === "users" ? 300 : 0); return () => clearTimeout(tm); }, [load, tab]);
  useEffect(() => { if (tab !== "live") return; const id = setInterval(load, 15000); return () => clearInterval(id); }, [tab, load]);

  // only ever hand a tab the data that was loaded FOR it (shapes differ per tab)
  const data = res && res.tab === tab ? res.d : null;

  const tabs: [Tab, string, React.ComponentType<{ size?: number }>][] = [
    ["overview", "نظرة عامة", BarChart3], ["live", "الآن على الموقع", Radio], ["users", "العملاء ونشاطهم", Users], ["subs", "المشتركون", Crown], ["ops", "العمليات", Activity],
  ];

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">التقارير</h1>
          <p className="text-[var(--muted-2)] text-sm mt-0.5">من يدخل، ماذا يفتح، ماذا يضغط، وماذا يشتري — كل خدمات المتجر في مكان واحد.</p>
        </div>
        <div className="flex items-center gap-2">
          {tab !== "live" && tab !== "subs" && (
            <div className="flex rounded-xl border border-[var(--border)] overflow-hidden text-sm" role="group" aria-label="الفترة">
              {[[1, "اليوم"], [7, "7 أيام"], [30, "30 يوماً"], [90, "90 يوماً"]].map(([v, l]) => (
                <button key={v} onClick={() => setDays(v as number)} className={`px-3 py-2 font-bold ${days === v ? "bg-purple-600 text-white" : "text-[var(--muted)] hover:bg-white/5"}`}>{l}</button>
              ))}
            </div>
          )}
          <button onClick={load} title="تحديث" className="p-2.5 rounded-xl border border-[var(--border)] text-[var(--muted)] hover:bg-white/5"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {tabs.map(([k, l, I]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap border ${tab === k ? "bg-purple-600/15 border-purple-500/50 text-purple-400" : "border-[var(--border)] text-[var(--muted)] hover:bg-white/5"}`}>
            <I size={16} />{l}
          </button>
        ))}
      </div>

      {err && <div className="rounded-xl p-4 bg-red-500/10 text-red-400 text-sm">{err}</div>}
      {loading && !data ? <div className="flex justify-center p-16"><Loader2 className="animate-spin text-purple-400" size={30} /></div> : data && (
        <>
          {tab === "overview" && <Overview d={data} days={days} />}
          {tab === "live" && <Live list={data} onUser={setUserId} />}
          {tab === "users" && <UsersTab list={data} q={q} setQ={setQ} onUser={setUserId} />}
          {tab === "subs" && <Subs d={data} onUser={setUserId} />}
          {tab === "ops" && <Ops d={data} onUser={setUserId} />}
        </>
      )}

      {userId && <UserDrawer id={userId} onClose={() => setUserId(null)} />}
    </div>
  );
}

// ── pieces ─────────────────────────────────────────────────────────────────────
function Kpi({ icon: I, label, value, sub }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string; sub?: string }) {
  return (
    <div className={`${card} p-4`}>
      <div className="flex items-center gap-2 text-[var(--muted-2)] text-xs font-bold"><I size={15} className="text-purple-400" />{label}</div>
      <div className="text-2xl font-black mt-1.5">{value}</div>
      {sub && <div className="text-[var(--muted-2)] text-xs mt-0.5">{sub}</div>}
    </div>
  );
}

function Section({ title, hint, children, className = "" }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`${card} p-5 ${className}`}>
      <h2 className="font-bold text-sm">{title}</h2>
      {hint && <p className="text-[var(--muted-2)] text-xs mt-0.5">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Ranked horizontal bars — one series, one hue; value is printed, hover shows details. */
function Ranked({ rows, empty = "لا توجد بيانات بعد." }: { rows: { label: React.ReactNode; value: number; detail?: string; key: string }[]; empty?: string }) {
  if (!rows.length) return <p className="text-[var(--muted-2)] text-sm">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} title={r.detail} className="group">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="font-bold tabular-nums shrink-0">{n(r.value)}</span>
          </div>
          <div className="h-2 mt-1 rounded-full bg-[var(--input)] overflow-hidden">
            <div className="h-full rounded-full transition-all group-hover:brightness-110" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: ACCENT }} />
          </div>
          {r.detail && <div className="text-[11px] text-[var(--muted-2)] mt-0.5">{r.detail}</div>}
        </li>
      ))}
    </ul>
  );
}

/** Vertical bars with a hover tooltip (daily visitors, hours). */
function Columns({ data, labelOf, valueOf, tipOf, height = 150 }: { data: any[]; labelOf: (d: any) => string; valueOf: (d: any) => number; tipOf: (d: any) => string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <p className="text-[var(--muted-2)] text-sm">لا توجد بيانات بعد.</p>;
  const max = Math.max(...data.map(valueOf), 1);
  const every = Math.ceil(data.length / 12);
  return (
    <div className="relative" dir="ltr">
      <div className="flex items-end gap-[2px]" style={{ height }} onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => (
          <div key={i} className="flex-1 h-full flex items-end cursor-default" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}>
            <div className="w-full rounded-t-[4px]" style={{ height: `${(valueOf(d) / max) * 100}%`, minHeight: valueOf(d) ? 2 : 0, background: ACCENT, opacity: hover === null || hover === i ? 1 : 0.45 }} />
          </div>
        ))}
      </div>
      <div className="flex gap-[2px] mt-1.5 border-t border-[var(--border)] pt-1">
        {data.map((d, i) => <div key={i} className="flex-1 text-center text-[10px] text-[var(--muted-2)] overflow-hidden whitespace-nowrap">{i % every === 0 ? labelOf(d) : ""}</div>)}
      </div>
      {hover !== null && (
        <div className="absolute -top-2 pointer-events-none px-2.5 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] shadow-lg text-xs whitespace-nowrap" dir="rtl"
          style={{ left: `clamp(0px, calc(${((hover + 0.5) / data.length) * 100}% - 70px), calc(100% - 140px))` }}>
          {tipOf(data[hover])}
        </div>
      )}
    </div>
  );
}

// ── tabs ───────────────────────────────────────────────────────────────────────
function Overview({ d, days }: { d: any; days: number }) {
  const t = d.totals || {};
  const hours = useMemo(() => Array.from({ length: 24 }, (_, h) => ({ h, n: (d.hours || []).find((x: any) => x.h === h)?.n || 0 })), [d.hours]);
  const peak = hours.reduce((a, b) => (b.n > a.n ? b : a), hours[0]);
  const fresh = !d.first_event || new Date(d.first_event).getTime() > Date.now() - days * 86400000;
  return (
    <div className="space-y-5">
      {fresh && (
        <div className="rounded-xl p-3.5 text-sm bg-amber-500/10 border border-amber-500/30 text-amber-500">
          تسجيل الصفحات والضغطات بدأ {d.first_event ? `في ${dt(d.first_event)}` : "الآن"} — الأرقام قبل ذلك غير موجودة، وليست «لا نشاط». (الدخول والطلبات والعمليات محسوبة من سجلاتها القديمة.)
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={Users} label="زوار" value={n(t.visitors)} sub={`${n(t.users)} منهم مسجّلون`} />
        <Kpi icon={Eye} label="صفحات فُتحت" value={n(t.views)} sub={t.visitors ? `${(t.views / t.visitors).toFixed(1)} صفحة لكل زائر` : undefined} />
        <Kpi icon={MousePointerClick} label="ضغطات" value={n(t.clicks)} />
        <Kpi icon={Clock} label="متوسط البقاء في الصفحة" value={secs(t.avg_view_sec)} />
        <Kpi icon={LogIn} label="تسجيلات دخول" value={n(t.logins)} />
        <Kpi icon={UserPlus} label="حسابات جديدة" value={n(t.signups)} />
        <Kpi icon={ShoppingBag} label="طلبات المتجر" value={n(t.orders)} sub={`مدفوع: ${money(t.orders_total)}`} />
        <Kpi icon={Crown} label="اشتراكات فعّالة" value={n(t.active_subs)} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Section title="الزوار يومياً" hint="مرّر على العمود لرؤية التفاصيل" className="lg:col-span-2">
          <Columns data={d.daily || []} labelOf={(x) => x.day.slice(5)} valueOf={(x) => x.visitors} tipOf={(x) => `${x.day}: ${n(x.visitors)} زائر · ${n(x.views)} صفحة · ${n(x.users)} مسجّل`} />
        </Section>
        <Section title="أوقات الذروة" hint={peak?.n ? `أكثر ساعة نشاطاً: ${peak.h}:00 بتوقيت ليبيا` : "بتوقيت ليبيا"}>
          <Columns data={hours} height={120} labelOf={(x) => String(x.h)} valueOf={(x) => x.n} tipOf={(x) => `الساعة ${x.h}:00 — ${n(x.n)} صفحة`} />
        </Section>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Section title="أكثر الصفحات فتحاً" hint="مع عدد الزوار ومتوسط مدة البقاء">
          <Ranked rows={(d.pages || []).slice(0, 12).map((p: any) => ({ key: p.path, label: <span>{pageName(p.path)} <span className="text-[var(--muted-2)] text-xs" dir="ltr">{p.path}</span></span>, value: p.views, detail: `${n(p.visitors)} زائر · بقاء ${secs(p.avg_sec)}` }))} />
        </Section>
        <Section title="أكثر الأزرار ضغطاً" hint="ما الذي يجذب الناس للضغط">
          <Ranked rows={(d.clicks || []).slice(0, 12).map((c: any, i: number) => ({ key: `${c.label}-${c.path}-${i}`, label: <span>«{c.label}» <span className="text-[var(--muted-2)] text-xs">في {pageName(c.path)}</span></span>, value: c.n, detail: `${n(c.people)} شخص` }))} />
        </Section>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Section title="أكثر المنتجات مشاهدة" className="lg:col-span-2">
          {(d.products || []).length === 0 ? <p className="text-[var(--muted-2)] text-sm">لا توجد بيانات بعد.</p> : (
            <div className="grid sm:grid-cols-2 gap-3">
              {d.products.map((p: any, i: number) => (
                <a key={p.id} href={`/products/${p.id}`} target="_blank" className="flex items-center gap-3 p-2.5 rounded-xl border border-[var(--border)] hover:border-purple-500/40">
                  <span className="text-xs font-black text-purple-400 w-5 text-center">{i + 1}</span>
                  {p.image ? <img src={p.image} alt="" className="w-11 h-11 rounded-lg object-cover" /> : <span className="w-11 h-11 rounded-lg bg-[var(--input)]" />}
                  <span className="min-w-0 flex-1"><span className="block text-sm font-bold truncate">{p.name}</span><span className="text-xs text-[var(--muted-2)]">{n(p.views)} مشاهدة · {n(p.visitors)} زائر · {money(p.price)}</span></span>
                </a>
              ))}
            </div>
          )}
        </Section>
        <div className="space-y-5">
          <Section title="الأجهزة"><Ranked rows={(d.devices || []).map((x: any) => ({ key: x.device, label: x.device, value: x.n }))} /></Section>
          <Section title="من أين جاؤوا" hint="المواقع التي أرسلت الزوار"><Ranked rows={(d.refs || []).map((x: any) => ({ key: x.ref, label: <span dir="ltr">{x.ref}</span>, value: x.n }))} empty="لا يوجد بعد (أغلبهم دخلوا مباشرة)." /></Section>
        </div>
      </div>
    </div>
  );
}

function Live({ list, onUser }: { list: any[]; onUser: (id: string) => void }) {
  const signed = list.filter((x) => x.user_id).length;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Kpi icon={Radio} label="على الموقع الآن (آخر 5 دقائق)" value={n(list.length)} />
        <Kpi icon={Users} label="مسجّلون" value={n(signed)} sub={`${n(list.length - signed)} زائر بدون حساب`} />
      </div>
      <Section title="من على الموقع ووين هو" hint="يتحدّث تلقائياً كل 15 ثانية">
        {list.length === 0 ? <p className="text-[var(--muted-2)] text-sm">لا أحد الآن.</p> : (
          <ul className="divide-y divide-[var(--border)]">
            {list.map((x) => (
              <li key={x.sid} className="py-2.5 flex items-center gap-3 text-sm">
                <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                {x.user_id ? <button onClick={() => onUser(x.user_id)} className="font-bold text-purple-400 hover:underline">{x.name || "عميل"}</button> : <span className="text-[var(--muted)]">زائر</span>}
                <span className="text-[var(--muted-2)]">في</span><span className="font-bold">{pageName(x.path)}</span>
                <span className="text-[var(--muted-2)] text-xs flex items-center gap-1 ms-auto"><Smartphone size={12} />{x.device} · {ago(x.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function UsersTab({ list, q, setQ, onUser }: { list: any[]; q: string; setQ: (v: string) => void; onUser: (id: string) => void }) {
  return (
    <Section title="العملاء ونشاطهم" hint="اضغط على أي عميل لرؤية كل ما فتحه وفعله واشتراه">
      <label className="relative block mb-4">
        <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3 text-[var(--muted-2)]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو البريد أو الهاتف…" className="w-full ps-10 pe-3 py-2.5 rounded-xl bg-[var(--input)] border border-[var(--border)] text-sm focus:outline-none focus:border-purple-500/60" />
      </label>
      {list.length === 0 ? <p className="text-[var(--muted-2)] text-sm">لا يوجد عملاء نشطون في هذه الفترة.</p> : (
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm min-w-[820px]">
            <thead><tr className="text-[var(--muted-2)] text-xs border-b border-[var(--border)]">
              {["العميل", "آخر ظهور", "أيام نشاط", "صفحات", "ضغطات", "دخول", "طلبات", "مدفوع", "اشتراكات", "المحفظة"].map((h) => <th key={h} className="text-right px-4 py-2.5 font-medium">{h}</th>)}
            </tr></thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id} onClick={() => onUser(u.id)} className="border-b border-[var(--border)] hover:bg-purple-500/5 cursor-pointer">
                  <td className="px-4 py-2.5"><div className="font-bold">{u.name || "—"} {u.role && u.role !== "customer" && u.role !== "user" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400">{u.role}</span>}</div><div className="text-xs text-[var(--muted-2)]">{u.email || u.phone}</div></td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{ago(u.last_seen)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{n(u.days)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{n(u.views)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{n(u.clicks)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{n(u.logins)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{n(u.orders)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{u.paid ? money(u.paid) : "—"}</td>
                  <td className="px-4 py-2.5">{u.subs ? <span className="text-green-500 font-bold">{n(u.subs)}</span> : "—"}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{money(u.wallet)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function Subs({ d, onUser }: { d: any; onUser: (id: string) => void }) {
  const [filter, setFilter] = useState("active");
  const list = (d.list || []).filter((s: any) => filter === "all" || s.state === filter);
  const stateLabel: Record<string, [string, string]> = { active: ["فعّال", "text-green-500"], expired: ["منتهي", "text-red-400"], cancelled: ["ملغى", "text-[var(--muted-2)]"], pending: ["قيد الدفع", "text-amber-500"] };
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi icon={Crown} label="اشتراكات فعّالة" value={n(d.active)} sub={`${n(d.subscribers)} مشترك`} />
        <Kpi icon={Clock} label="تنتهي خلال 7 أيام" value={n(d.expiring7)} />
        <Kpi icon={RefreshCw} label="تجديد تلقائي" value={n(d.auto_renew)} />
        <Kpi icon={BarChart3} label="الدخل الشهري المتكرر" value={money(d.mrr)} />
        <Kpi icon={ShoppingBag} label="مبيعات اشتراكات (30 يوماً)" value={money(d.revenue30)} />
      </div>
      <div className="grid lg:grid-cols-3 gap-5">
        <Section title="الاشتراكات الفعّالة حسب الخدمة">
          <Ranked rows={(d.by_product || []).map((x: any) => ({ key: `${x.product}-${x.tier}`, label: `${PRODUCTS[x.product] || x.product}${x.tier ? ` — ${x.tier}` : ""}`, value: x.n }))} empty="لا توجد اشتراكات فعّالة." />
        </Section>
        <Section title="قائمة المشتركين" className="lg:col-span-2">
          <div className="flex gap-2 mb-3 flex-wrap">
            {[["active", "فعّالة"], ["expired", "منتهية"], ["cancelled", "ملغاة"], ["all", "الكل"]].map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${filter === k ? "bg-purple-600 text-white border-purple-600" : "border-[var(--border)] text-[var(--muted)]"}`}>{l}</button>
            ))}
          </div>
          {list.length === 0 ? <p className="text-[var(--muted-2)] text-sm">لا يوجد.</p> : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm min-w-[640px]">
                <thead><tr className="text-[var(--muted-2)] text-xs border-b border-[var(--border)]">{["المشترك", "الخدمة", "الحالة", "ينتهي", "السعر", "صفحات", "تجديد"].map((h) => <th key={h} className="text-right px-4 py-2 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {list.map((s: any) => (
                    <tr key={s.id} className="border-b border-[var(--border)]">
                      <td className="px-4 py-2"><button onClick={() => onUser(s.user_id)} className="font-bold text-purple-400 hover:underline">{s.name || "—"}</button><div className="text-xs text-[var(--muted-2)]">{s.phone}</div></td>
                      <td className="px-4 py-2">{PRODUCTS[s.product] || s.product}{s.tier ? ` — ${s.tier}` : ""}</td>
                      <td className={`px-4 py-2 font-bold ${stateLabel[s.state]?.[1] || ""}`}>{stateLabel[s.state]?.[0] || s.state}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{dt(s.expires_at)}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{money(s.price)}</td>
                      <td className="px-4 py-2">{n(s.pages)}</td>
                      <td className="px-4 py-2">{s.auto_renew ? "✓" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Ops({ d, onUser }: { d: any; onUser: (id: string) => void }) {
  const [kind, setKind] = useState("all");
  const summary: any[] = d.summary || [];
  const feed = (d.feed || []).filter((o: any) => kind === "all" || o.kind === kind);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {summary.map((s) => (
          <button key={s.kind} onClick={() => setKind(kind === s.kind ? "all" : s.kind)} className={`${card} p-4 text-right ${kind === s.kind ? "ring-2 ring-purple-500" : ""}`}>
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--muted-2)]"><span className="w-2.5 h-2.5 rounded-full" style={{ background: OPS[s.kind]?.color }} />{OPS[s.kind]?.label || s.kind}</div>
            <div className="text-2xl font-black mt-1">{n(s.n)}</div>
            <div className="text-xs text-[var(--muted-2)]">{money(s.sum)} · {n(s.people)} شخص</div>
          </button>
        ))}
      </div>
      <Section title={kind === "all" ? "كل العمليات" : OPS[kind]?.label || kind} hint="اضغط على اسم العميل لرؤية نشاطه الكامل">
        {feed.length === 0 ? <p className="text-[var(--muted-2)] text-sm">لا توجد عمليات في هذه الفترة.</p> : <OpsList rows={feed} onUser={onUser} />}
      </Section>
    </div>
  );
}

function OpsList({ rows, onUser }: { rows: any[]; onUser?: (id: string) => void }) {
  return (
    <ul className="divide-y divide-[var(--border)]">
      {rows.map((o, i) => (
        <li key={i} className="py-2.5 flex items-center gap-3 text-sm flex-wrap">
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md text-white shrink-0" style={{ background: OPS[o.kind]?.color || "#64748b" }}>{OPS[o.kind]?.label || o.kind}</span>
          <span className="min-w-0 flex-1">
            <span className="font-bold">{o.title}</span>
            {o.name && onUser && <> — <button onClick={() => onUser(o.user_id)} className="text-purple-400 hover:underline">{o.name}</button></>}
            {o.status && <span className="text-xs text-[var(--muted-2)]"> · {o.status}</span>}
          </span>
          {o.amount != null && <span className="font-bold whitespace-nowrap">{money(o.amount)}</span>}
          <span className="text-xs text-[var(--muted-2)] whitespace-nowrap">{dt(o.at)}</span>
        </li>
      ))}
    </ul>
  );
}

function UserDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [d, setD] = useState<any>(null);
  const [tab, setTab] = useState<"timeline" | "ops" | "logins">("timeline");
  useEffect(() => { fetch(`/api/admin/reports?type=user&id=${id}`, { cache: "no-store" }).then((r) => r.json()).then(setD).catch(() => setD({})); }, [id]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);

  // fold "__leave" rows into the view they close, so each line reads "opened X — stayed 1:20"
  const timeline = useMemo(() => {
    const ev: any[] = d?.events || [];
    const out: any[] = [];
    const leaves: Record<string, number> = {};
    for (const e of ev) { // newest first
      if (e.label === "__leave") { leaves[e.path] = e.dur_ms; continue; }
      if (e.kind === "view" && leaves[e.path] != null) { out.push({ ...e, stay: leaves[e.path] }); delete leaves[e.path]; } else out.push(e);
    }
    return out;
  }, [d]);
  const p = d?.profile || {};

  return (
    <div className="fixed inset-0 z-[80] flex" role="dialog" aria-modal="true" aria-label="نشاط العميل">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside className="relative ms-auto h-full w-full max-w-2xl bg-[var(--bg,#0b0f1a)] border-s border-purple-500/20 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-[var(--surface)] border-b border-[var(--border)] p-4 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-bold text-lg truncate">{p.full_name || p.email || "عميل"}</div>
            <div className="text-xs text-[var(--muted-2)]">{[p.email, p.phone].filter(Boolean).join(" · ")}{p.created_at ? ` · انضم ${dt(p.created_at)}` : ""}</div>
          </div>
          <button onClick={onClose} aria-label="إغلاق" className="p-2 rounded-lg hover:bg-white/10"><X size={18} /></button>
        </div>
        {!d ? <div className="flex justify-center p-16"><Loader2 className="animate-spin text-purple-400" /></div> : (
          <div className="p-4 space-y-4">
            {(d.top_pages || []).length > 0 && (
              <div className={`${card} p-4`}>
                <div className="text-xs font-bold text-[var(--muted-2)] mb-2">أكثر ما يفتحه</div>
                <div className="flex flex-wrap gap-2">{d.top_pages.map((t: any) => <span key={t.path} className="px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-bold">{pageName(t.path)} · {n(t.n)}</span>)}</div>
              </div>
            )}
            <div className="flex gap-2">
              {([["timeline", `ماذا فتح وضغط (${timeline.length})`], ["ops", `عملياته (${(d.ops || []).length})`], ["logins", `الدخول (${(d.logins || []).length})`]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} className={`px-3 py-2 rounded-lg text-xs font-bold border ${tab === k ? "bg-purple-600 text-white border-purple-600" : "border-[var(--border)] text-[var(--muted)]"}`}>{l}</button>
              ))}
            </div>
            {tab === "timeline" && (timeline.length === 0 ? <p className="text-[var(--muted-2)] text-sm">لا يوجد نشاط مسجّل بعد (التسجيل بدأ حديثاً).</p> : (
              <ol className="relative border-s-2 border-purple-500/20 ms-2 space-y-3">
                {timeline.map((e, i) => (
                  <li key={i} className="ms-4 text-sm">
                    <span className={`absolute -start-[7px] mt-1.5 w-3 h-3 rounded-full ${e.kind === "click" ? "bg-amber-500" : "bg-purple-500"}`} />
                    {e.kind === "view"
                      ? <span>فتح <b>{pageName(e.path)}</b> <span className="text-xs text-[var(--muted-2)]" dir="ltr">{e.path}</span>{e.stay ? <span className="text-xs text-[var(--muted-2)]"> — بقي {secs(e.stay / 1000)}</span> : null}</span>
                      : <span>ضغط <b>«{e.label}»</b> <span className="text-xs text-[var(--muted-2)]">في {pageName(e.path)}</span></span>}
                    <div className="text-[11px] text-[var(--muted-2)]">{dt(e.at)} · {e.device}</div>
                  </li>
                ))}
              </ol>
            ))}
            {tab === "ops" && ((d.ops || []).length === 0 ? <p className="text-[var(--muted-2)] text-sm">لا توجد عمليات.</p> : <OpsList rows={d.ops} />)}
            {tab === "logins" && ((d.logins || []).length === 0 ? <p className="text-[var(--muted-2)] text-sm">لا يوجد.</p> : (
              <ul className="divide-y divide-[var(--border)] text-sm">{d.logins.map((l: any, i: number) => <li key={i} className="py-2 flex justify-between gap-3"><span>{dt(l.at)}</span><span className="text-xs text-[var(--muted-2)] truncate max-w-[60%]" dir="ltr">{l.app} · {(l.ua || "").slice(0, 60)}</span></li>)}</ul>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
