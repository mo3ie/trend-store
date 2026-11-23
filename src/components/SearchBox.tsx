"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Loader2, ArrowLeft, X } from "lucide-react";

type P = { id: string; name: string; price: number; image_url?: string | null; category?: string };

// Arabic ↔ English brand words so «ايفون» finds "iPhone" and vice versa.
const SYN: [RegExp, string][] = [
  [/اي ?فون|آيفون|ايفون/g, "iphone"], [/سامسونج|سامسونغ/g, "samsung"], [/شاومي|ريدمي/g, "redmi"], [/هونر|هونور/g, "honor"],
  [/ايباد|آيباد/g, "ipad"], [/ماك ?بوك/g, "macbook"], [/بلايستيشن|بلي ستيشن/g, "playstation"], [/ايربودز|إيربودز/g, "airpods"],
  [/\biphone\b/gi, "ايفون"], [/\bsamsung\b/gi, "سامسونج"], [/\bcharger\b/gi, "شاحن"], [/\bcable\b/gi, "كابل"],
];
const alt = (q: string) => { let x = q; for (const [re, to] of SYN) x = x.replace(re, to); return x !== q ? x : ""; };

// Site sections that match a query (shown above products).
const PAGES = [
  { k: /فحص|عطل|بطاري|diagnos/i, t: "افحص جهازك", href: "/diagnose" },
  { k: /عميق|deep/i, t: "الفحص العميق للآيفون", href: "/deep-scan" },
  { k: /كرت|كروت|رصيد|ليبيانا|المدار|ببجي|pubg|itunes|بلايستيشن ستور|card/i, t: "الكروت والخدمات الرقمية", href: "/cards" },
  { k: /مستعمل|بيع جهاز|سوق|used/i, t: "سوق المستعمل بضمان", href: "/market" },
  { k: /شي ?ان|شين|shein/i, t: "اطلب من شي إن", href: "https://order.trendstore-ly.com" },
  { k: /هدي|سحب|gift/i, t: "هدية اليوم", href: "/gift" },
  { k: /لعب|تحدي|مسابق|game/i, t: "تحديات ترند", href: "/games" },
  { k: /صيان|تصليح|repair/i, t: "طلب صيانة", href: "/?repair=1" },
];

export default function SearchBox({ placeholder }: { placeholder: string }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<P[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setItems(null); return; }
    setBusy(true);
    const t = setTimeout(async () => {
      const urls = [term, alt(term)].filter(Boolean).map((s) => `/api/products?limit=8&search=${encodeURIComponent(s)}`);
      const res = await Promise.all(urls.map((u) => fetch(u).then((r) => r.json()).catch(() => [])));
      const seen = new Set<string>(), merged: P[] = [];
      for (const list of res) for (const p of Array.isArray(list) ? list : []) if (!seen.has(p.id)) { seen.add(p.id); merged.push(p); }
      setItems(merged.slice(0, 8)); setBusy(false); setHi(-1);
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const pages = q.trim().length >= 2 ? PAGES.filter((p) => p.k.test(q)) : [];
  const links = [...pages.map((p) => ({ href: p.href, label: p.t })), ...(items || []).map((p) => ({ href: `/products/${p.id}`, label: p.name }))];
  const submit = () => {
    if (hi >= 0 && links[hi]) { window.location.href = links[hi].href; return; }
    if (q.trim()) window.location.href = `/products?search=${encodeURIComponent(q.trim())}`;
  };

  return (
    <div ref={box} className="sbx">
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="sbx-in">
        <Search size={16} />
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(links.length - 1, h + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(-1, h - 1)); }
            if (e.key === "Escape") setOpen(false);
          }} aria-label={placeholder} />
        {busy ? <Loader2 size={15} className="animate-spin" /> : q ? <button type="button" onClick={() => { setQ(""); setItems(null); }} aria-label="مسح"><X size={15} /></button> : null}
      </form>
      {open && q.trim().length >= 2 && (
        <div className="sbx-drop">
          {pages.map((p, k) => (
            <a key={p.href} href={p.href} className={`sbx-page ${hi === k ? "hi" : ""}`}><ArrowLeft size={14} /> {p.t}</a>
          ))}
          {items?.map((p, k) => (
            <a key={p.id} href={`/products/${p.id}`} className={`sbx-item ${hi === pages.length + k ? "hi" : ""}`}>
              {p.image_url ? <img src={p.image_url} alt="" /> : <span className="sbx-noimg" />}
              <span className="sbx-name">{p.name}{p.category ? <small>{p.category}</small> : null}</span>
              <b>{p.price} د.ل</b>
            </a>
          ))}
          {items && !items.length && !pages.length && <p className="sbx-empty">ما لقيناش «{q}» — جرّب كلمة ثانية أو <a href="https://order.trendstore-ly.com">اطلبه من شي إن</a></p>}
          {!!items?.length && <button className="sbx-all" onClick={submit}>كل النتائج لـ «{q}» <ArrowLeft size={14} /></button>}
        </div>
      )}
    </div>
  );
}
