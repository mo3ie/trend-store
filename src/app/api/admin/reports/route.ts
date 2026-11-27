import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser, isAdmin } from "@/lib/authUser";

export const maxDuration = 30;

/**
 * GET /api/admin/reports?type=overview|live|users|ops|subs|user&days=&q=&id=
 * Admin (manager) only — reads the report functions from sql/47, which are not
 * executable by anon/authenticated roles.
 */
export async function GET(req: NextRequest) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  if (!(await isAdmin(me.id))) return NextResponse.json({ error: "للمدير فقط" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") || "overview";
  const days = Math.min(365, Math.max(1, Number(sp.get("days") || 7)));

  let call;
  switch (type) {
    case "overview": call = supabaseAdmin.rpc("admin_report_overview", { p_days: days }); break;
    case "live": call = supabaseAdmin.rpc("admin_report_live"); break;
    case "users": call = supabaseAdmin.rpc("admin_report_users", { p_days: days, p_q: (sp.get("q") || "").slice(0, 80) || null, p_limit: 300 }); break;
    case "ops": call = supabaseAdmin.rpc("admin_report_ops", { p_days: days }); break;
    case "subs": call = supabaseAdmin.rpc("admin_report_subs"); break;
    case "user": {
      const id = sp.get("id") || "";
      if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });
      call = supabaseAdmin.rpc("admin_report_user", { p_user: id });
      break;
    }
    default: return NextResponse.json({ error: "نوع غير معروف" }, { status: 400 });
  }
  const { data, error } = await call;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? null, { headers: { "Cache-Control": "no-store" } });
}
