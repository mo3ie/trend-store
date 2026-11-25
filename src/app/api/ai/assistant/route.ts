import { NextRequest, NextResponse } from "next/server";
import { aiComplete, hasAI, parseJsonReply } from "@/services/ai";
import { getCatalog, shortlist, rateLimited } from "@/lib/catalog";
import { PAGES, guideFor } from "@/lib/siteGuide";
import { settings as utilSettings } from "@/lib/anisUtilities";

/**
 * «ترندي» — the store's AI shopping assistant.
 * Answers in Arabic (Libyan-friendly), recommends ONLY real catalog products
 * (ids are validated against the catalog — never invented), and can point the
 * customer to the device-diagnosis tool or repair booking.
 */
type Msg = { role: "user" | "assistant"; content: string };

const SYSTEM = `أنت «ترندي»، المساعد الذكي لمحل ترند للإلكترونيات في ليبيا.
تتكلم بالعربية بلهجة ليبية مهذبة وبسيطة، وجمل قصيرة.
مهمتك: تساعد الزبون يختار منتج من القائمة المرفقة فقط، وتجاوب على أسئلة الأجهزة والإكسسوارات والصيانة، وتشرح أي ميزة في الموقع خطوة بخطوة من «دليل الموقع» المرفق.
قواعد صارمة:
- لا تخترع منتجات ولا أسعار. استعمل فقط المنتجات الموجودة في القائمة وأرقامها (id) كما هي.
- الأسعار بالدينار الليبي كما في القائمة.
- إذا المنتج غير متوفر قل ذلك واقترح بديل متوفر.
- إذا الزبون يشتكي من عطل أو بطء أو بطارية، اقترح «فحص جهازك» (action: "diagnose") أو حجز صيانة (action: "repair").
- لا تطلب بيانات شخصية ولا بيانات دفع ولا كلمة سر ولا أكواد.
- لما الزبون يسأل على ميزة: اشرحها بخطوات قصيرة مرقّمة من الدليل فقط، وحط رابط صفحتها في "page". لا تخترع ميزات أو أسعار أو مدد مش مكتوبة في الدليل؛ لو ما تعرفش قول بصراحة ووجّهه للمحل.
- لو الدليل يقول الخدمة «متوقفة مؤقتاً» قول إنها قريباً وما تحطش رابطها.
أرجع JSON فقط بهذا الشكل:
{"reply":"نص الرد","products":["id1","id2"],"action":null,"page":null}
حيث action واحدة من: null, "diagnose", "repair", "cart". و page مسار صفحة من الدليل (مثل "/electricity") أو null. أقصى 4 منتجات.`;

// Digital cards are a separate catalogue (card_products) — list the active brands so Trendy can point to /cards.
async function cardBrands(): Promise<string> {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { data } = await db.from("card_products").select("brand,name").eq("active", true).or("provider_available.is.null,provider_available.eq.true").limit(300);
    const brands = [...new Set((data || []).map((c) => String(c.brand || c.name || "").trim()).filter(Boolean))].slice(0, 40);
    return brands.length ? `الكروت المتوفرة الآن في صفحة الكروت الرقمية (/cards): ${brands.join("، ")}. لما يطلب كرت منها وجّهه لـ /cards (مش من قائمة المنتجات).` : "معلومة: صفحة الكروت الرقمية (/cards) ما فيها كروت مفعّلة حالياً، الكروت قريباً.";
  } catch { return ""; }
}

async function liveStatus(): Promise<string> {
  try {
    const s = await utilSettings();
    const st = (on: boolean) => (on ? "شغّالة" : "متوقفة مؤقتاً (قريباً)");
    return `حالة الخدمات الآن: شحن الكهرباء ${st(s.meter_enabled)}، الشحن المباشر ${st(s.recharge_enabled)}.
${await cardBrands()}`;
  } catch { return ""; }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (rateLimited(`assist:${ip}`, 20, 60_000)) {
    return NextResponse.json({ reply: "شوية شوية 🙂 جرّب بعد دقيقة.", products: [] }, { status: 429 });
  }
  if (!hasAI()) return NextResponse.json({ reply: "المساعد غير متاح حالياً.", products: [] }, { status: 503 });

  let messages: Msg[] = [];
  try {
    const body = await req.json();
    messages = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m: Msg) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-8)
      .map((m: Msg) => ({ role: m.role, content: m.content.slice(0, 600) }));
  } catch { /* fallthrough */ }
  const last = [...messages].reverse().find((m) => m.role === "user");
  if (!last) return NextResponse.json({ error: "empty" }, { status: 400 });

  const [catalog, status] = await Promise.all([getCatalog(), liveStatus()]);
  const context = messages.map((m) => m.content).join(" ");
  const list = shortlist(catalog, context, 30);
  const listText = list
    .map((p) => `${p.id} | ${p.name} | ${p.category} | ${p.price} د.ل | ${p.inStock ? "متوفر" : "غير متوفر"}`)
    .join("\n");

  const convo = messages.map((m) => `${m.role === "user" ? "الزبون" : "ترندي"}: ${m.content}`).join("\n");

  try {
    const ask = () => aiComplete({
      system: SYSTEM,
      user: `${guideFor(messages.slice(-3).map((m) => m.content).join(" "))}
${status}

قائمة المنتجات:\n${listText}\n\nالمحادثة:\n${convo}\n\nرد على آخر رسالة للزبون. JSON فقط.`,
      maxTokens: 900,
      temperature: 0.5,
    });
    // free tier: a burst can hit the per-minute limit → wait a moment and try once more
    const raw = await ask().catch(async () => { await new Promise((r) => setTimeout(r, 2500)); return ask(); });
    let out: { reply?: string; products?: string[]; action?: string | null; page?: string | null };
    try { out = parseJsonReply(raw); } catch { out = { reply: raw.slice(0, 800), products: [] }; }

    const byId = new Map(catalog.map((p) => [p.id, p]));
    const products = (out.products || [])
      .map((id) => byId.get(String(id)))
      .filter(Boolean)
      .slice(0, 4)
      .map((p) => ({ id: p!.id, name: p!.name, price: p!.price, image_url: p!.image_url, inStock: p!.inStock }));
    const action = ["diagnose", "repair", "cart"].includes(String(out.action)) ? out.action : null;

    const page = typeof out.page === "string" && PAGES[out.page] ? { href: out.page, label: PAGES[out.page] } : null;
    return NextResponse.json({ reply: String(out.reply || "").slice(0, 1500), products, action, page });
  } catch {
    return NextResponse.json({ reply: "صار خلل بسيط، عاود بعد شوية.", products: [] }, { status: 502 });
  }
}
