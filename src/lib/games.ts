import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { aiComplete, hasAI, parseJsonReply } from "@/services/ai";
import { libyaDay } from "@/lib/dailyGift";

/**
 * «تحديات ترند» — daily games with a weekly leaderboard.
 *   quiz   : 5 tech questions (same for everyone that day), one attempt
 *   price  : guess the price of 5 real store products, one attempt
 *   memory : match product pairs, one scored attempt a day
 * Answers/prices stay on the server until the attempt is submitted.
 */
export const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export type Q = { q: string; options: string[]; answer: number; explain?: string };

const BANK: Q[] = [
  { q: "شنو معنى الاختصار 5G؟", options: ["الجيل الخامس من شبكات الجوال", "خمس جيجابايت ذاكرة", "خمس كاميرات", "شاحن 5 واط"], answer: 0 },
  { q: "أي منفذ صار أساسي في آيفون 15 بدل Lightning؟", options: ["Micro USB", "USB-C", "MagSafe فقط", "HDMI"], answer: 1 },
  { q: "شنو وظيفة RAM في الجوال؟", options: ["تخزين الصور دائماً", "ذاكرة مؤقتة لتشغيل التطبيقات", "حماية الشاشة", "تقوية الإشارة"], answer: 1 },
  { q: "صحة البطارية في الآيفون تحت كم بالمية يُنصح بتبديلها؟", options: ["95%", "90%", "80%", "60%"], answer: 2 },
  { q: "شنو تعني mAh في البطاريات؟", options: ["سرعة الشحن", "سعة البطارية", "حرارة البطارية", "عمر الشاحن"], answer: 1 },
  { q: "أي شركة تصنع معالجات Snapdragon؟", options: ["Apple", "Samsung", "Qualcomm", "Huawei"], answer: 2 },
  { q: "شنو الفرق الأساسي بين SSD و HDD؟", options: ["SSD أسرع وبدون أجزاء متحركة", "HDD أسرع", "SSD للصوت فقط", "ما فيش فرق"], answer: 0 },
  { q: "شنو تعني 120Hz في الشاشة؟", options: ["الشاشة تتحدث 120 مرة في الثانية", "سطوع 120 شمعة", "حجم 120 مم", "120 لون"], answer: 0 },
  { q: "أي معيار يدل على مقاومة الجوال للماء؟", options: ["IP68", "4K", "OLED", "NFC"], answer: 0 },
  { q: "شنو تقنية NFC تستعمل فيها عادة؟", options: ["الدفع بالتقريب", "تصوير الليل", "تسريع الشحن", "تكبير الصوت"], answer: 0 },
  { q: "أي نوع شاشات يعطي أسود حقيقي لأن كل بكسل يطفي؟", options: ["LCD", "OLED", "TN", "CRT"], answer: 1 },
  { q: "شنو أفضل عادة للحفاظ على بطارية الجوال؟", options: ["تفريغها لصفر كل يوم", "تجنب الحرارة العالية والشحن الطويل جداً", "الشحن في الشمس", "استعمال أي شاحن رخيص"], answer: 1 },
];

/** Same pseudo-random order for everyone on a given day. */
function seeded(day: string, salt: string) {
  let x = parseInt(createHash("sha256").update(day + salt).digest("hex").slice(0, 8), 16);
  return () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; };
}

export async function getQuiz(day = libyaDay()): Promise<Q[]> {
  const { data } = await db.from("daily_quiz").select("questions").eq("day", day).maybeSingle();
  if (data?.questions) return data.questions as Q[];
  let qs: Q[] = [];
  if (hasAI()) {
    try {
      const raw = await aiComplete({
        system: `اكتب 5 أسئلة اختيار من متعدد بالعربي (لهجة ليبية بسيطة) عن التقنية والجوالات والإلكترونيات. معلومات عامة مؤكدة فقط، بدون أسئلة عن أسعار أو تواريخ دقيقة مشكوك فيها. كل سؤال 4 خيارات وواحد صحيح فقط.
أرجع JSON فقط: {"questions":[{"q":"...","options":["..","..","..",".."],"answer":0,"explain":"سطر قصير"}]}`,
        user: `أسئلة متنوعة ليوم ${day}. JSON فقط.`, maxTokens: 1500, temperature: 0.7,
      });
      qs = (parseJsonReply<{ questions: Q[] }>(raw).questions || []).filter((x) =>
        x && typeof x.q === "string" && Array.isArray(x.options) && x.options.length === 4 && Number.isInteger(x.answer) && x.answer >= 0 && x.answer < 4).slice(0, 5);
    } catch { qs = []; }
  }
  if (qs.length < 5) {
    const r = seeded(day, "bank");
    qs = [...BANK].sort(() => r() - 0.5).slice(0, 5);
  }
  await db.from("daily_quiz").insert({ day, questions: qs }).select("day").maybeSingle(); // race-safe (PK)
  const { data: again } = await db.from("daily_quiz").select("questions").eq("day", day).single();
  return again!.questions as Q[];
}
export const publicQuiz = (qs: Q[]) => qs.map(({ q, options }) => ({ q, options }));

export async function priceItems(day = libyaDay()) {
  const { data } = await db.from("products").select("id,name,price,image_url,quantity").gt("price", 0).not("image_url", "is", null).limit(400);
  const pool = (data || []).filter((p) => (p.quantity ?? 0) >= 0 && p.image_url && !String(p.image_url).startsWith("data:"));
  const src = pool.length >= 5 ? pool : (data || []);
  const r = seeded(day, "price");
  return [...src].sort(() => r() - 0.5).slice(0, 5).map((p) => ({ id: p.id as string, name: p.name as string, image_url: p.image_url as string, price: Number(p.price) }));
}
/** 20 points per item, minus 1 per 2.5% off; 0 when 50%+ off. */
export const priceScore = (guess: number, real: number) => Math.max(0, Math.round(20 - (Math.abs(guess - real) / real) * 100 / 2.5));

export async function memoryCards(day = libyaDay()) {
  const items = await priceItems(day);
  const { data } = await db.from("products").select("id,image_url").not("image_url", "is", null).limit(60);
  const imgs = [...new Set([...items.map((i) => i.image_url), ...(data || []).map((d) => d.image_url as string).filter((u) => u && !u.startsWith("data:"))])].slice(0, 6);
  const r = seeded(day, "memory");
  return [...imgs, ...imgs].map((img, i) => ({ k: i, img })).sort(() => r() - 0.5);
}
/** Fewer moves and less time = more points (max 100). Server re-checks plausibility. */
export function memoryScore(moves: number, seconds: number, pairs: number) {
  if (moves < pairs || seconds < pairs * 1.2) return 0; // physically impossible → bot
  return Math.max(10, Math.min(100, Math.round(100 - (moves - pairs) * 4 - Math.max(0, seconds - 20) * 0.6)));
}

/** Libya week starts Saturday. */
export function weekStart(day = libyaDay()): string {
  const d = new Date(`${day}T00:00:00Z`);
  const back = (d.getUTCDay() + 1) % 7; // Sat=6 → 0
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}
