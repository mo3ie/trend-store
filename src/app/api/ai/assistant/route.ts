import { NextRequest, NextResponse } from "next/server";
import { aiComplete, hasAI, parseJsonReply } from "@/services/ai";
import { getCatalog, shortlist, rateLimited } from "@/lib/catalog";

/**
 * «ترندي» — the store's AI shopping assistant.
 * Answers in Arabic (Libyan-friendly), recommends ONLY real catalog products
 * (ids are validated against the catalog — never invented), and can point the
 * customer to the device-diagnosis tool or repair booking.
 */
type Msg = { role: "user" | "assistant"; content: string };

const SYSTEM = `أنت «ترندي»، المساعد الذكي لمحل ترند للإلكترونيات في ليبيا.
تتكلم بالعربية بلهجة ليبية مهذبة وبسيطة، وجمل قصيرة.
مهمتك: تساعد الزبون يختار منتج من القائمة المرفقة فقط، وتجاوب على أسئلة الأجهزة والإكسسوارات والصيانة.
قواعد صارمة:
- لا تخترع منتجات ولا أسعار. استعمل فقط المنتجات الموجودة في القائمة وأرقامها (id) كما هي.
- الأسعار بالدينار الليبي كما في القائمة.
- إذا المنتج غير متوفر قل ذلك واقترح بديل متوفر.
- إذا الزبون يشتكي من عطل أو بطء أو بطارية، اقترح «فحص جهازك» (action: "diagnose") أو حجز صيانة (action: "repair").
- لا تطلب بيانات شخصية ولا بيانات دفع.
أرجع JSON فقط بهذا الشكل:
{"reply":"نص الرد","products":["id1","id2"],"action":null}
حيث action واحدة من: null, "diagnose", "repair", "cart". أقصى 4 منتجات.`;

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

  const catalog = await getCatalog();
  const context = messages.map((m) => m.content).join(" ");
  const list = shortlist(catalog, context, 40);
  const listText = list
    .map((p) => `${p.id} | ${p.name} | ${p.category} | ${p.price} د.ل | ${p.inStock ? "متوفر" : "غير متوفر"}`)
    .join("\n");

  const convo = messages.map((m) => `${m.role === "user" ? "الزبون" : "ترندي"}: ${m.content}`).join("\n");

  try {
    const raw = await aiComplete({
      system: SYSTEM,
      user: `قائمة المنتجات:\n${listText}\n\nالمحادثة:\n${convo}\n\nرد على آخر رسالة للزبون. JSON فقط.`,
      maxTokens: 700,
      temperature: 0.5,
    });
    let out: { reply?: string; products?: string[]; action?: string | null };
    try { out = parseJsonReply(raw); } catch { out = { reply: raw.slice(0, 800), products: [] }; }

    const byId = new Map(catalog.map((p) => [p.id, p]));
    const products = (out.products || [])
      .map((id) => byId.get(String(id)))
      .filter(Boolean)
      .slice(0, 4)
      .map((p) => ({ id: p!.id, name: p!.name, price: p!.price, image_url: p!.image_url, inStock: p!.inStock }));
    const action = ["diagnose", "repair", "cart"].includes(String(out.action)) ? out.action : null;

    return NextResponse.json({ reply: String(out.reply || "").slice(0, 1200), products, action });
  } catch {
    return NextResponse.json({ reply: "صار خلل بسيط، عاود بعد شوية.", products: [] }, { status: 502 });
  }
}
