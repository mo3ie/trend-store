import { createClient } from "@supabase/supabase-js";
import { aiComplete, hasAI } from "@/services/ai";

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
export type Fix = { product_id: string; name: string; action: string; detail: string };

const AI_PER_RUN = 12;
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

async function writeDescription(p: Row): Promise<string | null> {
  const variants = (p.variants || []).map((v) => `${v.name}: ${(v.options || []).join("، ")}`).join(" | ");
  const out = await aiComplete({
    system: `أنت كاتب وصف منتجات لمحل إلكترونيات ليبي (محل ترند). اكتب وصف عربي احترافي وقصير (3 إلى 6 أسطر).
قواعد صارمة:
- اذكر المواصفات فقط إذا كانت معروفة ومؤكدة لهذا الطراز بالضبط (مثل الشاشة، المعالج، الكاميرا، البطارية، القدرة بالواط).
- إذا لم تكن متأكداً من رقم، لا تكتبه. لا تخترع مواصفات.
- لا تذكر السعر ولا المخزون ولا الضمان ولا وعود توصيل.
- بدون مقدمات، بدون عناوين Markdown. أسطر قصيرة يفصلها " · " أو أسطر جديدة.`,
    user: `المنتج: ${p.name}\nالتصنيف: ${p.category || "-"}${variants ? `\nالخيارات: ${variants}` : ""}\nاكتب الوصف فقط.`,
    maxTokens: 500,
    temperature: 0.3,
  });
  const text = out.replace(/^["'\s]+|["'\s]+$/g, "").replace(/\*\*/g, "").trim();
  return text.length >= 20 ? text.slice(0, 1200) : null;
}

export async function runCatalogCheck(trigger: "cron" | "manual") {
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
    if (p.description_ai) add(p, "low", "ai_description", "الوصف مكتوب بالذكاء الاصطناعي — راجعه مرة وحدة وعدّله لو لزم");
  }
  for (let i = 0; i < httpImages.length; i += 8) {
    const batch = httpImages.slice(i, i + 8);
    const ok = await Promise.all(batch.map((b) => imageOk(b.url)));
    ok.forEach((good, j) => { if (!good) add(batch[j].p, "high", "broken_image", "رابط الصورة لا يفتح (صورة مكسورة)"); });
  }

  // AI: fill missing descriptions
  let aiDone = 0;
  if (hasAI()) {
    for (const p of rows.filter((r) => !r.description?.trim() && (r.name || "").trim().length >= 3).slice(0, AI_PER_RUN)) {
      try {
        const d = await writeDescription(p);
        if (!d) continue;
        const { error: e } = await db.from("products").update({ description: d, description_ai: true }).eq("id", p.id);
        if (e) continue;
        aiDone++;
        fixes.push({ product_id: p.id, name: p.name || "", action: "ai_description", detail: d });
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
