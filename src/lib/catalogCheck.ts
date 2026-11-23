import { createClient } from "@supabase/supabase-js";
import { hasAI } from "@/services/ai";

/**
 * Daily catalog health check («فحص المنتجات»).
 *
 * 1. Programmatic checks on every product (no AI needed): missing/broken
 *    images, heavy inline images, watermarked stock sites, bad prices,
 *    missing category, short names, duplicates, negative stock, empty
 *    variant groups, missing descriptions.
 * 2. AI fix: writes an Arabic description for products that have none
 *    (capped per run), and flags it (`description_ai`) so the owner can review.
 * 3. Saves one report row in `catalog_reports` for the admin page.
 */
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export type Issue = { product_id: string; name: string; severity: "high" | "medium" | "low"; code: string; message: string };
export type Fix = { product_id: string; name: string; action: string; detail: string; sources?: { title: string; url: string }[] };

const AI_PER_RUN = 6; // web search takes ~5-15s each; the route has 60s
const WATERMARK_HOSTS = /citypng|pngtree|freepik|shutterstock|alamy|dreamstime|istockphoto|depositphotos|123rf|pngwing|kindpng|pngegg/i;

type Row = {
  id: string; name: string | null; description: string | null; price: number | null; category: string | null;
  image_url: string | null; images: string[] | null; quantity: number | null; stock: number | null;
  variants: { name?: string; options?: string[] }[] | null; description_ai: boolean | null;
};

async function imageOk(url: string): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    let r = await fetch(url, { method: "HEAD", signal: ctl.signal, cache: "no-store" });
    if (r.status === 405 || r.status === 403) r = await fetch(url, { method: "GET", signal: ctl.signal, cache: "no-store", headers: { range: "bytes=0-0" } });
    clearTimeout(t);
    return r.ok || r.status === 206;
  } catch { return false; }
}

type Grounded = { text: string; sources: { title: string; url: string }[] } | { error: string };

/**
 * Description grounded in the web — never written from the model's memory.
 *
 * Uses Groq Compound (a model with a built-in web-search tool). The model must
 * search first and write ONLY facts found in the pages it read. We then verify
 * on our side that every cited link really came from its search results; a
 * description with no verified source is rejected and NOT saved.
 */
async function writeDescription(p: Row): Promise<Grounded> {
  const key = (process.env.GROQ_API_KEY || "").trim();
  if (!key) return { error: "no_search" };
  const variants = (p.variants || []).map((v) => `${v.name}: ${(v.options || []).join("، ")}`).join(" | ");
  const model = process.env.GROQ_SEARCH_MODEL || "groq/compound-mini";
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    cache: "no-store",
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 1200,
      messages: [
        { role: "system", content: `You write product descriptions for an electronics shop in Libya. You MUST use web search first.
Search the official manufacturer page and trusted spec sites (gsmarena.com, apple.com, samsung.com, hihonor.com, mi.com, the brand's own site, Amazon listing).
Write ONLY facts that appear in the pages you read. Never use memory. If the search does not identify this exact product, return {"found":false}.
Output JSON only:
{"found":true,"description_ar":"3-6 short Arabic lines with the key verified specs, separated by newlines, no price/stock/warranty/delivery, no markdown","sources":[{"title":"...","url":"https://..."}]}` },
        { role: "user", content: `Product name: ${p.name}\nCategory: ${p.category || "-"}${variants ? `\nOptions: ${variants}` : ""}` },
      ],
    }),
  });
  if (!res.ok) return { error: `search_http_${res.status}` };
  const data = await res.json() as { choices?: { message?: { content?: string; executed_tools?: { search_results?: { results?: { url?: string; title?: string }[] } }[] } }[] };
  const msg = data.choices?.[0]?.message;
  const searched = new Set<string>();
  for (const t of msg?.executed_tools || []) for (const r of t.search_results?.results || []) if (r.url) searched.add(r.url.replace(/\/$/, ""));
  if (!searched.size) return { error: "no_search_results" };

  let out: { found?: boolean; description_ar?: string; sources?: { title?: string; url?: string }[] };
  try {
    const raw = (msg?.content || "").replace(/^```json\s*|```$/gm, "").trim();
    out = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
  } catch { return { error: "bad_json" }; }
  if (!out.found) return { error: "not_found" };

  const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
  const searchedHosts = new Set([...searched].map(host));
  // A cited source counts only if it (or at least its site) was really in the search results.
  const sources = (out.sources || [])
    .filter((s) => s.url && /^https?:\/\//.test(s.url) && (searched.has(s.url.replace(/\/$/, "")) || searchedHosts.has(host(s.url))))
    .slice(0, 5).map((s) => ({ title: String(s.title || host(s.url!)).slice(0, 120), url: s.url! }));
  if (!sources.length) return { error: "unverified_sources" };

  const text = String(out.description_ar || "").replace(/\*\*/g, "").trim();
  if (text.length < 20) return { error: "empty" };
  return { text: text.slice(0, 1200), sources };
}

export async function runCatalogCheck(trigger: "cron" | "manual") {
  const started = Date.now();
  const { data, error } = await db.from("products")
    .select("id,name,description,price,category,image_url,images,quantity,stock,variants,description_ai")
    .order("created_at", { ascending: false }).limit(2000);
  if (error) throw new Error(error.message);
  const rows = (data || []) as Row[];
  const issues: Issue[] = [];
  const fixes: Fix[] = [];
  const add = (p: Row, severity: Issue["severity"], code: string, message: string) =>
    issues.push({ product_id: p.id, name: p.name || "(بدون اسم)", severity, code, message });

  // Duplicate names
  const seen = new Map<string, string>();
  for (const p of rows) {
    const k = (p.name || "").trim().toLowerCase().replace(/\s+/g, " ");
    if (k && seen.has(k)) add(p, "medium", "duplicate", "اسم مكرر مع منتج آخر — تأكد إنه مش نفس المنتج مضاف مرتين");
    else if (k) seen.set(k, p.id);
  }

  // Programmatic checks (image HEADs run in parallel, small batches)
  const httpImages: { p: Row; url: string }[] = [];
  for (const p of rows) {
    const name = (p.name || "").trim();
    const imgs = [...(p.images || []), ...(p.image_url ? [p.image_url] : [])].filter(Boolean);
    const qty = Number(p.quantity ?? p.stock ?? 0);

    if (name.length < 3) add(p, "high", "name", "اسم المنتج قصير جداً أو فارغ");
    if (p.price == null || !(Number(p.price) > 0)) add(p, "high", "price", "السعر فارغ أو صفر — الزبون ما يقدرش يطلبه صح");
    else if (Number(p.price) > 100000) add(p, "medium", "price", `السعر ${p.price} كبير بشكل غير طبيعي — تأكد من الأصفار`);
    if (!p.category?.trim()) add(p, "medium", "category", "بدون تصنيف — ما يظهرش في فلاتر المتجر");
    if (qty < 0) add(p, "high", "stock", `الكمية بالسالب (${qty})`);
    if (!imgs.length) add(p, "high", "image", "بدون صورة");
    for (const u of new Set(imgs)) {
      if (u.startsWith("data:")) {
        const kb = Math.round((u.length * 0.75) / 1024);
        if (kb > 350) add(p, "low", "heavy_image", `صورة مضمّنة ثقيلة (${kb}KB) — تبطّئ تحميل المتجر`);
      } else if (/^https?:\/\//.test(u)) {
        if (WATERMARK_HOSTS.test(u)) add(p, "medium", "watermark", "الصورة من موقع صور مجانية وغالباً عليها علامة مائية — بدّلها بصورة نظيفة");
        httpImages.push({ p, url: u });
      } else add(p, "medium", "image_url", "رابط صورة غير صالح");
    }
    for (const v of p.variants || []) if (!v?.options?.length) add(p, "low", "variants", `مجموعة خيارات «${v?.name || "?"}» بدون خيارات`);
    if (!p.description?.trim()) add(p, "medium", "no_description", "بدون وصف");
    else if (p.description.trim().length < 25) add(p, "low", "short_description", "الوصف قصير جداً");
    if (p.description_ai) add(p, "low", "ai_description", "الوصف مكتوب بالذكاء من مصادر على الإنترنت — راجعه مرة وحدة");
  }
  for (let i = 0; i < httpImages.length; i += 8) {
    const batch = httpImages.slice(i, i + 8);
    const ok = await Promise.all(batch.map((b) => imageOk(b.url)));
    ok.forEach((good, j) => { if (!good) add(batch[j].p, "high", "broken_image", "رابط الصورة لا يفتح (صورة مكسورة)"); });
  }

  // AI: fill missing descriptions
  let aiDone = 0;
  const NOT_FOUND: Record<string, string> = {
    not_found: "ما لقيناش المنتج بالضبط في المصادر على الإنترنت — ما كتبناش وصف (اكتبه يدوياً أو صحّح الاسم)",
    unverified_sources: "الذكاء ما قدرش يثبت مصادر حقيقية — رفضنا الوصف وما حفظناهوش",
    no_search_results: "البحث على الإنترنت ما رجّعش نتائج — بنحاول مرة ثانية في الفحص الجاي",
  };
  if (hasAI()) {
    for (const p of rows.filter((r) => !r.description?.trim() && (r.name || "").trim().length >= 3).slice(0, AI_PER_RUN)) {
      if (Date.now() - started > 42_000) break; // leave time to save the report
      try {
        const d = await writeDescription(p);
        if ("error" in d) {
          if (NOT_FOUND[d.error]) add(p, "low", "ai_no_source", NOT_FOUND[d.error]);
          else add(p, "low", "ai_error", "تعذّر الوصول لخدمة البحث (" + d.error + ") — بنحاول في الفحص الجاي");
          continue;
        }
        const { error: e } = await db.from("products").update({ description: d.text, description_ai: true, description_sources: d.sources }).eq("id", p.id);
        if (e) continue;
        aiDone++;
        fixes.push({ product_id: p.id, name: p.name || "", action: "ai_description", detail: d.text, sources: d.sources });
        const k = issues.findIndex((x) => x.product_id === p.id && x.code === "no_description");
        if (k >= 0) issues.splice(k, 1);
      } catch { /* provider busy: try again next run */ }
    }
  }

  const order = { high: 0, medium: 1, low: 2 } as const;
  issues.sort((a, b) => order[a.severity] - order[b.severity]);
  const summary = {
    high: issues.filter((i) => i.severity === "high").length,
    medium: issues.filter((i) => i.severity === "medium").length,
    low: issues.filter((i) => i.severity === "low").length,
    ai_descriptions: aiDone,
    ai_available: hasAI(),
    still_missing_descriptions: rows.filter((r) => !r.description?.trim()).length - aiDone,
  };
  const { data: rep } = await db.from("catalog_reports")
    .insert({ trigger, checked: rows.length, issues, fixes, summary }).select("id,created_at").single();
  // Keep ~90 days of history
  await db.from("catalog_reports").delete().lt("created_at", new Date(Date.now() - 90 * 864e5).toISOString());
  return { id: rep?.id, created_at: rep?.created_at, checked: rows.length, summary, issues, fixes };
}
