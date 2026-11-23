import { aiComplete, hasAI, parseJsonReply } from "@/services/ai";

/**
 * AI certificate for a «deep» scan, whatever the data source:
 *   • "usb"       — read over USB in the shop by Trend POS (verified by the shop)
 *   • "analytics" — the owner's own iPhone Analytics files, parsed in their browser
 * Plus, optionally, the browser hardware checks (screen/touch/sound/cameras…).
 */
export type DeepSource = "usb" | "analytics" | "screenshots";

const SYSTEM = `أنت فني آيفون خبير في محل ترند (ليبيا). عندك نتائج فحص عميق للجهاز:
صحة البطارية ودوراتها، أعطال النظام (kernel panics) وأسبابها، أعطال التطبيقات، ضغط الذاكرة (Jetsam)، التخزين، ونتائج فحص الهاردوير من المتصفح إن وجدت.
اكتب تقرير شهادة فحص بالعربي. اعتمد على البيانات فقط ولا تفترض.
- البطارية أقل من 80% = تحتاج تبديل. 80-84% = ملاحظة. دورات فوق 800 = بطارية مستهلكة.
- panics متكررة في آخر 30 يوم = مشكلة؛ فسّر السبب من النص (missing sensor / thermalmonitord / watchdog / AppleSPU / i2c = غالباً قطعة أو فلكس أو بطارية؛ تكرار نفس السبب أوضح).
- تطبيق يتعطّل كثير = مشكلة برمجية في التطبيق (تحديث/حذف/إعادة تثبيت).
- Jetsam كثير = ذاكرة ممتلئة أو تطبيقات ثقيلة.
- سجل القطع والصيانة (parts): أي قطعة "unknown" = قطعة غير أصلية أو مجهولة (مشكلة مهمة واذكر اسم القطعة)، "replaced/used" = تم تبديلها (اذكرها بوضوح)، "genuine" = أصلية.
- تحذير "Service"/صيانة في البطارية = تحتاج تبديل.
- فحص IMEI: iCloud "on" = قفل Find My مفعّل (لا يُشترى إلا بعد إطفائه من صاحبه)، blacklist lost/stolen/blocked = جهاز مبلّغ عنه — خطير جداً، simLock locked = مقفول على شبكة، refurbished/replaced = مجدد أو مستبدل.
- خطوات حل برمجية أولاً، ثم هل يحتاج صيانة.
أرجع JSON فقط:
{"score":0-100,"summary":"...","issues":[{"title":"...","severity":"low|medium|high","cause":"...","fixes":["..."],"needsRepair":false}],"tips":["..."],"products":[]}`;

export async function analyzeDeep(input: Record<string, unknown>, source: DeepSource) {
  let report: Record<string, unknown> = { score: 0, summary: "", issues: [], tips: [], products: [] };
  if (hasAI()) {
    try {
      const raw = await aiComplete({ system: SYSTEM, user: JSON.stringify(input).slice(0, 9000) + "\nJSON فقط.", maxTokens: 1800, temperature: 0.2 });
      report = { ...report, ...parseJsonReply<Record<string, unknown>>(raw) };
    } catch { /* data-only certificate below */ }
  }
  const scan = (input.scan || input.analytics || {}) as { battery?: { healthPct?: number }; panics?: { last30d?: number } };
  const h = Number(scan.battery?.healthPct);
  if (!report.summary) report.summary = `فحص عميق — البطارية ${isFinite(h) ? h + "%" : "غير معروفة"} · أعطال النظام آخر 30 يوم: ${scan.panics?.last30d ?? 0}`;
  if (!report.score) report.score = Math.max(0, Math.min(100, (isFinite(h) ? h : 90) - (Number(scan.panics?.last30d) || 0) * 5));
  report.score = Math.max(0, Math.min(100, Math.round(Number(report.score) || 0)));
  report.deep = true;
  report.source = source;
  return report as { score: number; summary: string; deep: true; source: DeepSource } & Record<string, unknown>;
}
