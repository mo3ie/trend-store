import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser, isAdmin } from "@/lib/authUser";

export const maxDuration = 60;

type Row = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  role: string | null;
  tier: string | null;
  createdAt: string | null;
  /** From Supabase auth, not our profiles table — the truth about sessions. */
  lastSignInAt: string | null;
  emailConfirmed: boolean;
  balance: number;
  orders: number;
  spent: number;
  logins: number;
};

/**
 * GET ?q=&sort=&limit=&offset= — every customer, with the facts an owner
 * actually asks about: when they last signed in, how often, what they have
 * spent, and what is left in their wallet.
 *
 * These live in four places — `auth.users`, `profiles`, `wallets`,
 * `store_orders` — and `profiles` alone answers none of the questions, which is
 * why the admin panel had no user screen at all until now.
 */
export async function GET(req: NextRequest) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  if (!(await isAdmin(me.id))) {
    return NextResponse.json({ error: "للمدير فقط" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") || "").trim();
  const sort = sp.get("sort") || "recent";
  const limit = Math.min(200, Math.max(1, Number(sp.get("limit") || 50)));
  const offset = Math.max(0, Number(sp.get("offset") || 0));

  let pq = supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, phone, address, role, tier, created_at", { count: "exact" });
  if (q) {
    const safe = q.replace(/[,()]/g, " ");
    pq = pq.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`);
  }
  const { data: profiles, count, error } = await pq
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (profiles || []).map((p) => p.id);
  if (!ids.length) {
    return NextResponse.json({ rows: [], total: count ?? 0, summary: await summary() });
  }

  // Everything else in four bulk reads rather than four per user.
  const [wallets, orders, logins, authUsers] = await Promise.all([
    supabaseAdmin.from("wallets").select("user_id, balance").in("user_id", ids),
    supabaseAdmin.from("store_orders").select("user_id, total").in("user_id", ids),
    supabaseAdmin.from("login_events").select("user_id").in("user_id", ids).limit(10000),
    listAuthUsers(ids),
  ]);

  const balanceOf = new Map((wallets.data || []).map((w) => [w.user_id, Number(w.balance) || 0]));
  const orderCount = new Map<string, number>();
  const orderSpend = new Map<string, number>();
  for (const o of orders.data || []) {
    const k = String(o.user_id);
    orderCount.set(k, (orderCount.get(k) ?? 0) + 1);
    orderSpend.set(k, (orderSpend.get(k) ?? 0) + (Number(o.total) || 0));
  }
  const loginCount = new Map<string, number>();
  for (const l of logins.data || []) {
    const k = String(l.user_id);
    loginCount.set(k, (loginCount.get(k) ?? 0) + 1);
  }

  const rows: Row[] = (profiles || []).map((p) => {
    const a = authUsers.get(p.id);
    return {
      id: p.id,
      name: p.full_name || p.email || "—",
      email: p.email ?? a?.email ?? null,
      phone: p.phone ?? null,
      address: p.address ?? null,
      role: p.role ?? null,
      tier: p.tier ?? null,
      createdAt: p.created_at ?? null,
      lastSignInAt: a?.lastSignInAt ?? null,
      emailConfirmed: a?.confirmed ?? false,
      balance: balanceOf.get(p.id) ?? 0,
      orders: orderCount.get(p.id) ?? 0,
      spent: Math.round((orderSpend.get(p.id) ?? 0) * 100) / 100,
      logins: loginCount.get(p.id) ?? 0,
    };
  });

  // Sorting happens here because the interesting keys (last sign-in, spend)
  // are assembled above and do not exist on any single table.
  const dir = (a: string | null, b: string | null) =>
    new Date(b || 0).getTime() - new Date(a || 0).getTime();
  if (sort === "lastSignIn") rows.sort((a, b) => dir(a.lastSignInAt, b.lastSignInAt));
  else if (sort === "spent") rows.sort((a, b) => b.spent - a.spent);
  else if (sort === "balance") rows.sort((a, b) => b.balance - a.balance);
  else if (sort === "logins") rows.sort((a, b) => b.logins - a.logins);
  else if (sort === "name") rows.sort((a, b) => a.name.localeCompare(b.name, "ar"));

  return NextResponse.json({ rows, total: count ?? rows.length, summary: await summary() });
}

/**
 * `last_sign_in_at` and email confirmation live only in `auth.users`, which
 * PostgREST does not expose. The Admin API pages at 1000 users at a time; the
 * store has a few hundred, so one or two pages covers it.
 */
async function listAuthUsers(ids: string[]) {
  const map = new Map<string, { email: string | null; lastSignInAt: string | null; confirmed: boolean }>();
  const want = new Set(ids);
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) break;
    for (const u of data.users) {
      if (!want.has(u.id)) continue;
      map.set(u.id, {
        email: u.email ?? null,
        lastSignInAt: u.last_sign_in_at ?? null,
        confirmed: !!u.email_confirmed_at,
      });
    }
    if (data.users.length < 1000) break;
  }
  return map;
}

async function summary() {
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [total, newWeek, walletSum, loggedToday] = await Promise.all([
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
    supabaseAdmin.from("wallets").select("balance"),
    supabaseAdmin.from("login_events").select("user_id").gte("created_at", dayAgo).limit(10000),
  ]);
  const balances = (walletSum.data || []).reduce((n, w) => n + (Number(w.balance) || 0), 0);
  return {
    users: total.count ?? 0,
    newThisWeek: newWeek.count ?? 0,
    walletTotal: Math.round(balances * 100) / 100,
    activeToday: new Set((loggedToday.data || []).map((l) => l.user_id)).size,
  };
}
