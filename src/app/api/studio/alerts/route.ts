import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";

type Alert = { id: string; severity: "error" | "warning" | "info"; area: "ads" | "studio" | "bot"; title: string; detail?: string; at?: string };

// GET ?pageId= — aggregated problems across Ads, the AI Employee, and the bot for a Page.
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const pageId = req.nextUrl.searchParams.get("pageId");
  if (!pageId) return NextResponse.json({ error: "pageId مطلوب" }, { status: 400 });

  const alerts: Alert[] = [];

  // 1) Ad campaigns with problems.
  const { data: camps } = await supabaseAdmin
    .from("ad_campaigns")
    .select("id, page_name, status, error_message, created_at, continuous")
    .eq("user_id", user.id).eq("page_id", pageId)
    .order("created_at", { ascending: false }).limit(50);
  for (const c of camps || []) {
    if (c.status === "rejected") alerts.push({ id: `ad-${c.id}`, severity: "error", area: "ads", title: "إعلان مرفوض من فيسبوك", detail: c.error_message || "راجع سياسات الإعلان أو تواصل مع الدعم.", at: c.created_at });
    else if (c.status === "failed") alerts.push({ id: `ad-${c.id}`, severity: "error", area: "ads", title: "فشل إنشاء الإعلان", detail: c.error_message || "", at: c.created_at });
    else if (c.status === "issues") alerts.push({ id: `ad-${c.id}`, severity: "warning", area: "ads", title: "إعلان به مشكلة توصيل", detail: c.error_message || "قد يحتاج تعديل الاستهداف أو الميزانية.", at: c.created_at });
    else if (c.status === "paused" && c.error_message) alerts.push({ id: `ad-${c.id}`, severity: "warning", area: "ads", title: "حملة متوقفة", detail: c.error_message, at: c.created_at });
  }

  // 2) AI-Employee posts that failed to publish/boost.
  const { data: posts } = await supabaseAdmin
    .from("studio_posts")
    .select("id, status, error, scheduled_for, caption")
    .eq("user_id", user.id).eq("page_id", pageId).eq("status", "failed").limit(50);
  for (const p of posts || []) {
    alerts.push({ id: `post-${p.id}`, severity: "error", area: "studio", title: "فشل نشر منشور مجدول", detail: p.error || (p.caption ? String(p.caption).slice(0, 60) : ""), at: p.scheduled_for });
  }

  // 3) Bot health: enabled but no usable token, or recent reply failures.
  const { data: cfg } = await supabaseAdmin
    .from("bot_configs")
    .select("id, enabled, ai_enabled, active_token_id")
    .eq("user_id", user.id).eq("page_id", pageId).eq("platform", "meta").maybeSingle();
  if (cfg?.enabled) {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("bot_reply_log")
      .select("id", { count: "exact", head: true })
      .eq("page_id", pageId).in("error", ["token_invalid", "meta_error", "ai_unavailable"]).gte("created_at", since);
    if ((count || 0) > 0) alerts.push({ id: "bot-fail", severity: "warning", area: "bot", title: "فشل بعض ردود البوت (آخر 24 ساعة)", detail: `${count} تعليق لم يُرَدّ عليه — قد يكون رمز الصفحة أو الذكاء غير متاح.` });
  }

  const order = { error: 0, warning: 1, info: 2 } as const;
  alerts.sort((a, b) => order[a.severity] - order[b.severity]);
  return NextResponse.json({ alerts, count: alerts.length });
}
