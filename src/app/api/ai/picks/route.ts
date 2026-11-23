import { NextResponse } from "next/server";
import { aiComplete, hasAI, parseJsonReply } from "@/services/ai";
import { getCatalog } from "@/lib/catalog";

/**
 * What the hologram robot presents on the homepage: a rotating set of real
 * products, each with a short AI-written pitch line. The AI pitch is made once
 * per hour (not per visitor) so it costs almost nothing; without AI the robot
 * still works with plain template lines.
 */
type Pick = { id: string; name: string; price: number; image_url: string | null; line: string; tag: string; has3d: boolean };

let cache: { at: number; picks: Pick[] } | null = null;
const TTL = 60 * 60 * 1000;

const TEMPLATES = [
  (n: string) => `شوف ${n} — من أكثر الطلبات هالأسبوع`,
  (n: string) => `${n} وصل جديد للمحل ✨`,
  (n: string) => `تبي ترقية؟ ${n} خيار ممتاز`,
  (n: string) => `${n} بسعر يستاهل`,
];

export async function GET() {
  if (cache && Date.now() - cache.at < TTL) return NextResponse.json({ picks: cache.picks });

  const all = (await getCatalog()).filter((p) => p.inStock && p.image_url);
  // Mix: newest, cheapest, 3D-ready, and a random spread across categories.
  const chosen = new Map<string, (typeof all)[number] & { tag: string }>();
  const add = (p: (typeof all)[number] | undefined, tag: string) => { if (p && !chosen.has(p.id)) chosen.set(p.id, { ...p, tag }); };
  all.slice(0, 3).forEach((p) => add(p, "جديد"));
  all.filter((p) => p.has3d).slice(0, 2).forEach((p) => add(p, "ثلاثي الأبعاد"));
  [...all].sort((a, b) => a.price - b.price).slice(0, 2).forEach((p) => add(p, "سعر مميز"));
  const cats = [...new Set(all.map((p) => p.category))];
  for (const c of cats) {
    const inCat = all.filter((p) => p.category === c);
    add(inCat[Math.floor(Math.random() * inCat.length)], c || "مقترح");
    if (chosen.size >= 10) break;
  }
  const list = [...chosen.values()].slice(0, 10);

  let lines: Record<string, string> = {};
  if (hasAI() && list.length) {
    try {
      const raw = await aiComplete({
        system: "أنت روبوت عرض في محل إلكترونيات ليبي. تكتب جملة ترويجية قصيرة جداً (أقل من 70 حرف) بالعربية لكل منتج، بدون أسعار وبدون وعود غير حقيقية. أرجع JSON فقط.",
        user: `اكتب جملة لكل منتج. الشكل: {"lines":{"id":"جملة"}}\n${list.map((p) => `${p.id} | ${p.name} | ${p.category}`).join("\n")}`,
        maxTokens: 900,
        temperature: 0.8,
      });
      lines = parseJsonReply<{ lines: Record<string, string> }>(raw).lines || {};
    } catch { lines = {}; }
  }

  const picks: Pick[] = list.map((p, i) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    image_url: p.image_url,
    tag: p.tag,
    has3d: p.has3d,
    line: (lines[p.id] || "").slice(0, 90) || TEMPLATES[i % TEMPLATES.length](p.name.split(" ").slice(0, 4).join(" ")),
  }));
  cache = { at: Date.now(), picks };
  return NextResponse.json({ picks });
}
