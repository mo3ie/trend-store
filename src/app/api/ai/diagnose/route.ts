import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { aiComplete, hasAI, parseJsonReply } from "@/services/ai";
import { getCatalog, shortlist, rateLimited } from "@/lib/catalog";
import { getUser } from "@/lib/apiAuth";

/**
 * Turns the «افحص جهازك» results into a plain-Arabic report: a health score,
 * each problem with its likely cause, step-by-step SOFTWARE fixes first, and
 * whether it needs the repair shop. Saved to device_reports so the customer
 * (and the shop) can open it by link.
 */
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export type Issue = { title: string; severity: "low" | "medium" | "high"; cause: string; fixes: string[]; needsRepair: boolean };
export type Report = { score: number; summary: string; issues: Issue[]; tips: string[]; products: { id: string; name: string; price: number; image_url: string | null }[] };

const SYSTEM = `أنت فني صيانة هواتف خبير في محل ترند للإلكترونيات (ليبيا)، خبرتك الأكبر في الآيفون.
تستلم نتائج فحص جهاز من المتصفح + إجابات الزبون. اكتب تقرير بالعربية البسيطة.
قواعد:
- اعتمد فقط على النتائج والإجابات المعطاة. لا تفترض أعطال غير مذكورة.
- لكل مشكلة: السبب المحتمل، وخطوات حل برمجية مرتبة يقدر الزبون يسويها بنفسه أولاً (مثلاً للآيفون: الإعدادات ← عام ← تحديث البرنامج، إعادة تشغيل إجبارية، تفريغ التطبيقات، إعادة ضبط الإعدادات، تعطيل تحديث الخلفية، فحص صحة البطارية من الإعدادات ← البطارية)، ثم هل تحتاج صيانة في المحل.
- صحة البطارية أقل من 80% = تحتاج تبديل بطارية (needsRepair=true).
- severity: low/medium/high.
- score من 0 إلى 100 لصحة الجهاز العامة.
- tips: 2-4 نصائح عامة قصيرة للحفاظ على الجهاز.
- products: أرقام id من قائمة المنتجات فقط إذا فيه منتج يحل مشكلة فعلاً (شاحن، كابل، سماعة، حماية شاشة...)، أقصى 3، وإلا قائمة فارغة.
أرجع JSON فقط:
{"score":85,"summary":"...","issues":[{"title":"...","severity":"medium","cause":"...","fixes":["...","..."],"needsRepair":false}],"tips":["..."],"products":["id"]}`;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (rateLimited(`diag:${ip}`, 5, 10 * 60_000)) return NextResponse.json({ error: "حاولت كثير، جرّب بعد شوية" }, { status: 429 });
  if (!hasAI()) return NextResponse.json({ error: "التحليل الذكي غير متاح حالياً" }, { status: 503 });

  let body: { device?: Record<string, unknown>; results?: Record<string, unknown>; answers?: Record<string, unknown> };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad" }, { status: 400 }); }
  const device = body.device || {};
  const results = body.results || {};
  const answers = body.answers || {};
  const payload = JSON.stringify({ device, results, answers }).slice(0, 6000);

  const catalog = await getCatalog();
  const symptoms = Object.values(answers).flat().join(" ");
  const list = shortlist(catalog, `شاحن كابل بطارية سماعة حماية شاشة جراب ${symptoms}`, 30)
    .filter((p) => p.inStock)
    .map((p) => `${p.id} | ${p.name} | ${p.category} | ${p.price} د.ل`).join("\n");

  let rep: Partial<Omit<Report, "products">> & { products?: string[] };
  try {
    const raw = await aiComplete({ system: SYSTEM, user: `نتائج الفحص:\n${payload}\n\nقائمة المنتجات:\n${list}\n\nJSON فقط.`, maxTokens: 1800, temperature: 0.3 });
    rep = parseJsonReply(raw);
  } catch {
    return NextResponse.json({ error: "تعذّر التحليل الآن، جرّب مرة ثانية" }, { status: 502 });
  }

  const byId = new Map(catalog.map((p) => [p.id, p]));
  const report: Report = {
    score: Math.max(0, Math.min(100, Math.round(Number(rep.score) || 0))),
    summary: String(rep.summary || "").slice(0, 600),
    issues: (Array.isArray(rep.issues) ? rep.issues : []).slice(0, 10).map((i) => ({
      title: String(i.title || "").slice(0, 120),
      severity: (["low", "medium", "high"].includes(String(i.severity)) ? i.severity : "medium") as Issue["severity"],
      cause: String(i.cause || "").slice(0, 400),
      fixes: (Array.isArray(i.fixes) ? i.fixes : []).slice(0, 8).map((f) => String(f).slice(0, 300)),
      needsRepair: !!i.needsRepair,
    })),
    tips: (Array.isArray(rep.tips) ? rep.tips : []).slice(0, 5).map((t) => String(t).slice(0, 200)),
    products: (rep.products || []).map((id) => byId.get(String(id))).filter(Boolean).slice(0, 3)
      .map((p) => ({ id: p!.id, name: p!.name, price: p!.price, image_url: p!.image_url })),
  };

  const user = await getUser().catch(() => null);
  const { data } = await db.from("device_reports").insert({
    user_id: user?.id || null, device, results: { results, answers }, score: report.score, ai_report: JSON.stringify(report),
  }).select("id").single();

  return NextResponse.json({ id: data?.id || null, report });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { data } = await db.from("device_reports").select("id,device,results,score,ai_report,created_at").eq("id", id).single();
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  let report: Report | null = null;
  try { report = JSON.parse(data.ai_report || "null"); } catch {}
  return NextResponse.json({ id: data.id, device: data.device, results: data.results, created_at: data.created_at, report });
}
