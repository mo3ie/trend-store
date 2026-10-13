"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Users, LogIn, Search, RefreshCw, Smartphone, Wallet, ShoppingBag,
  Clock, ShieldCheck, Activity, AlertCircle, X,
} from "lucide-react";

type UserRow = {
  id: string; name: string; email: string | null; phone: string | null;
  address: string | null; role: string | null; tier: string | null;
  createdAt: string | null; lastSignInAt: string | null; emailConfirmed: boolean;
  balance: number; orders: number; spent: number; logins: number;
};
type LoginRow = {
  id: string; userId: string | null; name: string; role: string | null;
  email: string | null; ip: string | null; device: string; app: string; at: string;
};

const SORTS = [
  ["recent", "الأحدث تسجيلاً"],
  ["lastSignIn", "آخر دخول"],
  ["spent", "الأكثر إنفاقاً"],
  ["balance", "الأعلى رصيداً"],
  ["logins", "الأكثر دخولاً"],
  ["name", "الاسم"],
] as const;

function dt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ar-LY", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/** "منذ ٣ ساعات" reads faster than a timestamp when scanning a list. */
function ago(iso: string | null) {
  if (!iso) return "لم يدخل قط";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "الآن";
  if (s < 3600) return `منذ ${Math.floor(s / 60)} د`;
  if (s < 86400) return `منذ ${Math.floor(s / 3600)} س`;
  if (s < 2592000) return `منذ ${Math.floor(s / 86400)} يوم`;
  return `منذ ${Math.floor(s / 2592000)} شهر`;
}

function Stat({ icon: Icon, label, value, hint }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string; value: string | number; hint?: string;
}) {
  return (
    <div className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl p-4">
      <div className="flex items-center gap-2 text-[var(--muted-2)] text-xs mb-2">
        <Icon size={14} className="text-purple-400" /> {label}
      </div>
      <div className="text-2xl font-black">{value}</div>
      {hint && <div className="text-[11px] text-[var(--muted-2)] mt-1">{hint}</div>}
    </div>
  );
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);
  const [tab, setTab] = useState<"users" | "logins">("users");

  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<{ users: number; newThisWeek: number; walletTotal: number; activeToday: number } | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<string>("recent");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [picked, setPicked] = useState<UserRow | null>(null);

  const [logins, setLogins] = useState<LoginRow[]>([]);
  const [loginStats, setLoginStats] = useState<Record<string, number> | null>(null);
  const [series, setSeries] = useState<Array<{ date: string; logins: number; users: number }>>([]);
  const [devices, setDevices] = useState<Array<{ name: string; n: number }>>([]);
  const [since, setSince] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [loadingLogins, setLoadingLogins] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.push("/login"); return; }
      const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", data.session.user.id).single();
      // Employees reach /admin but not this screen: it exposes every customer's
      // contact details, balance and sign-in history.
      if (profile?.role !== "admin") { setDenied(true); setReady(true); return; }
      setReady(true);
    })();
  }, [router]);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    const p = new URLSearchParams({ sort, limit: "100" });
    if (q.trim()) p.set("q", q.trim());
    const d = await fetch(`/api/admin/users?${p}`).then((r) => r.json()).catch(() => null);
    setRows(d?.rows || []);
    setTotal(d?.total || 0);
    setSummary(d?.summary || null);
    setLoadingUsers(false);
  }, [q, sort]);

  const loadLogins = useCallback(async () => {
    setLoadingLogins(true);
    const d = await fetch(`/api/admin/logins?days=${days}&limit=200`).then((r) => r.json()).catch(() => null);
    setLogins(d?.rows || []);
    setLoginStats(d?.stats || null);
    setSeries(d?.series || []);
    setDevices(d?.devices || []);
    setSince(d?.since ?? null);
    setLoadingLogins(false);
  }, [days]);

  useEffect(() => { if (ready && !denied) loadUsers(); }, [ready, denied, loadUsers]);
  useEffect(() => { if (ready && !denied) loadLogins(); }, [ready, denied, loadLogins]);

  if (!ready) return <div className="p-8 text-[var(--muted-2)]">جاري التحميل…</div>;
  if (denied) {
    return (
      <div className="p-8">
        <div className="bg-[var(--surface)] border border-red-500/30 rounded-2xl p-6 flex items-start gap-3">
          <ShieldCheck size={20} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">هذه الصفحة للمدير فقط</p>
            <p className="text-[var(--muted-2)] text-sm mt-1">تحتوي بيانات كل العملاء وأرصدتهم وسجلّ دخولهم.</p>
          </div>
        </div>
      </div>
    );
  }

  const peak = Math.max(1, ...series.map((s) => s.logins));

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            الإعدادات والمستخدمون
          </h1>
          <p className="text-[var(--muted-2)] text-sm mt-1">بيانات العملاء وإحصائيات الدخول</p>
        </div>
        <button
          onClick={() => (tab === "users" ? loadUsers() : loadLogins())}
          className="px-4 py-2 rounded-xl bg-purple-600/20 border border-purple-500/30 text-sm font-bold flex items-center gap-2 hover:bg-purple-600/30 transition-colors"
        >
          <RefreshCw size={15} /> تحديث
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat icon={Users} label="إجمالي المستخدمين" value={summary?.users ?? "—"} />
        <Stat icon={Activity} label="دخلوا اليوم" value={summary?.activeToday ?? "—"} hint="مستخدم مختلف" />
        <Stat icon={ShoppingBag} label="جدد هذا الأسبوع" value={summary?.newThisWeek ?? "—"} />
        <Stat icon={Wallet} label="مجموع المحافظ" value={`${(summary?.walletTotal ?? 0).toFixed(2)} د`} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto">
        {([["users", "المستخدمون", Users], ["logins", "تسجيلات الدخول", LogIn]] as const).map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shrink-0 transition-all ${
              tab === k
                ? "bg-purple-600 text-white"
                : "bg-white/5 text-[var(--muted)] border border-[var(--border)] hover:text-[var(--text)]"
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-2)]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") loadUsers(); }}
                placeholder="ابحث بالاسم أو البريد أو الهاتف…"
                className="w-full bg-[var(--input)] border border-purple-500/25 rounded-xl py-2.5 pr-9 pl-3 text-sm focus:outline-none focus:border-purple-500/60"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-[var(--input)] border border-purple-500/25 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
            >
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <p className="text-[var(--muted-2)] text-xs mb-3">
            {loadingUsers ? "…" : `عرض ${rows.length} من ${total}`}
          </p>

          <div className="overflow-x-auto bg-[var(--surface)] border border-purple-500/20 rounded-2xl">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="text-[var(--muted-2)] text-xs border-b border-[var(--border)]">
                <tr>
                  {["المستخدم", "التواصل", "آخر دخول", "مرات الدخول", "الطلبات", "أنفق", "الرصيد"].map((h) => (
                    <th key={h} className="text-right font-medium px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-[var(--muted-2)]">جاري التحميل…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-[var(--muted-2)]">لا نتائج</td></tr>
                ) : rows.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => setPicked(u)}
                    className="border-b border-[var(--border)] last:border-0 hover:bg-white/5 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="font-bold flex items-center gap-2">
                        {u.name}
                        {u.role === "admin" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">مدير</span>}
                        {u.role === "employee" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">موظف</span>}
                        {!u.emailConfirmed && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300">بريد غير مؤكد</span>}
                      </div>
                      <div className="text-[11px] text-[var(--muted-2)]">انضم {dt(u.createdAt)}</div>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)] text-xs">
                      <div>{u.email || "—"}</div>
                      <div dir="ltr" className="text-right">{u.phone || "—"}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div>{ago(u.lastSignInAt)}</div>
                      <div className="text-[11px] text-[var(--muted-2)]">{dt(u.lastSignInAt)}</div>
                    </td>
                    <td className="px-4 py-3">{u.logins}</td>
                    <td className="px-4 py-3">{u.orders}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{u.spent.toFixed(2)} د</td>
                    <td className="px-4 py-3 whitespace-nowrap font-bold text-green-400">{u.balance.toFixed(2)} د</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "logins" && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  days === d ? "bg-purple-600 text-white" : "bg-white/5 border border-[var(--border)] text-[var(--muted)]"
                }`}
              >
                آخر {d} يوم
              </button>
            ))}
          </div>

          {/*
            The log starts the day this shipped. Saying so matters: an owner who
            reads an empty early week as "nobody visited" would be misled by our
            own missing history, not by their store.
          */}
          {!loadingLogins && (
            <div className="flex items-start gap-2 text-xs text-[var(--muted-2)] bg-white/5 border border-[var(--border)] rounded-xl px-3 py-2.5 mb-4">
              <AlertCircle size={14} className="shrink-0 mt-0.5 text-yellow-400" />
              <span>
                {since
                  ? `سجلّ الدخول يبدأ من ${dt(since)} — لا توجد بيانات قبل هذا التاريخ لأن التسجيل بدأ حينها.`
                  : "لم يُسجَّل أي دخول بعد. يبدأ العدّ من أول مرة يدخل فيها أحد بعد نشر هذا التحديث."}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <Stat icon={LogIn} label="دخول اليوم" value={loginStats?.today ?? "—"} hint={`${loginStats?.activeToday ?? 0} مستخدم مختلف`} />
            <Stat icon={Clock} label="دخول هذا الأسبوع" value={loginStats?.week ?? "—"} hint={`${loginStats?.activeWeek ?? 0} مستخدم مختلف`} />
            <Stat icon={Activity} label={`دخول آخر ${days} يوم`} value={loginStats?.windowTotal ?? "—"} />
            <Stat icon={Users} label="مستخدمون نشطون" value={loginStats?.activeWindow ?? "—"} hint={`خلال ${days} يوم`} />
          </div>

          {/* Per-day bars */}
          <div className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl p-4 mb-5">
            <p className="text-xs text-[var(--muted-2)] mb-3">الدخول اليومي</p>
            <div className="flex items-end gap-[2px] h-28" dir="ltr">
              {series.map((s) => (
                <div key={s.date} className="flex-1 group relative flex items-end h-full">
                  <div
                    className="w-full bg-gradient-to-t from-purple-600 to-blue-500 rounded-t-sm min-h-[2px] transition-all"
                    style={{ height: `${(s.logins / peak) * 100}%` }}
                  />
                  <div className="hidden group-hover:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/90 text-white text-[10px] px-2 py-1 rounded z-10">
                    {s.date} — {s.logins} دخول · {s.users} مستخدم
                  </div>
                </div>
              ))}
            </div>
          </div>

          {devices.length > 0 && (
            <div className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl p-4 mb-5">
              <p className="text-xs text-[var(--muted-2)] mb-3 flex items-center gap-2"><Smartphone size={14} /> الأجهزة</p>
              <div className="flex flex-wrap gap-2">
                {devices.map((d) => (
                  <span key={d.name} className="px-3 py-1.5 rounded-xl bg-white/5 border border-[var(--border)] text-xs">
                    {d.name} <span className="text-purple-300 font-bold">{d.n}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="overflow-x-auto bg-[var(--surface)] border border-purple-500/20 rounded-2xl">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="text-[var(--muted-2)] text-xs border-b border-[var(--border)]">
                <tr>{["المستخدم", "الوقت", "الجهاز", "IP", "التطبيق"].map((h) => (
                  <th key={h} className="text-right font-medium px-4 py-3 whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {loadingLogins ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-[var(--muted-2)]">جاري التحميل…</td></tr>
                ) : logins.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-[var(--muted-2)]">لا تسجيلات بعد</td></tr>
                ) : logins.map((l) => (
                  <tr key={l.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-bold flex items-center gap-2">
                        {l.name}
                        {l.role === "admin" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">مدير</span>}
                      </div>
                      <div className="text-[11px] text-[var(--muted-2)]">{l.email || "—"}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div>{ago(l.at)}</div>
                      <div className="text-[11px] text-[var(--muted-2)]">{dt(l.at)}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{l.device}</td>
                    <td className="px-4 py-3 text-xs text-[var(--muted-2)]" dir="ltr">{l.ip || "—"}</td>
                    <td className="px-4 py-3 text-xs">{l.app}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* User detail */}
      {picked && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setPicked(null); }}>
          <div className="bg-[var(--surface)] border border-purple-500/30 rounded-3xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-purple-500/15 sticky top-0 bg-[var(--surface)]">
              <span className="font-bold">{picked.name}</span>
              <button onClick={() => setPicked(null)} className="text-[var(--muted-2)] hover:text-[var(--text)]"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              {([
                ["البريد", picked.email || "—"],
                ["الهاتف", picked.phone || "—"],
                ["العنوان", picked.address || "—"],
                ["الصلاحية", picked.role || "عميل"],
                ["الفئة", picked.tier || "—"],
                ["تأكيد البريد", picked.emailConfirmed ? "مؤكد" : "غير مؤكد"],
                ["انضم في", dt(picked.createdAt)],
                ["آخر دخول", `${ago(picked.lastSignInAt)} · ${dt(picked.lastSignInAt)}`],
                ["مرات الدخول المسجّلة", String(picked.logins)],
                ["عدد الطلبات", String(picked.orders)],
                ["إجمالي الإنفاق", `${picked.spent.toFixed(2)} د.ل`],
                ["رصيد المحفظة", `${picked.balance.toFixed(2)} د.ل`],
              ] as Array<[string, string]>).map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-2 last:border-0">
                  <span className="text-[var(--muted-2)] text-xs shrink-0">{k}</span>
                  <span className="text-right break-all">{v}</span>
                </div>
              ))}
              <p className="text-[11px] text-[var(--muted-2)] pt-2">
                مرات الدخول تُحتسب من سجلّ المتجر فقط، أما «آخر دخول» فمن نظام الحسابات ويشمل ما قبل تشغيل السجلّ.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
