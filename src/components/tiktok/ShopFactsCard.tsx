"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import type { TikTokPalette } from "@/lib/tiktokTheme";

type TF = (ar: string, en: string) => string;

interface Brand {
  brand_name?: string | null;
  phones?: string[] | null;
  addresses?: string[] | null;
  links?: string[] | null;
  hours?: string | null;
  extra?: string | null;
}

/**
 * The shop's own facts, on the bot screen, feeding the bot's answers.
 *
 * ## Why it is here and not only in the Studio
 *
 * It was only in the Studio — `studio_brands`, filled in for the content planner.
 * The bot never read it. So a customer asking "وين محلكم؟" got "a representative
 * will follow up", while the address sat two screens away in the merchant's own
 * handwriting. The operator named the fix before I did: enter the data once, and
 * let everything read it.
 *
 * This edits the SAME row through the SAME endpoint the Studio uses. Not a copy
 * and not a second profile — improving the address for the bot improves it for
 * the Studio in the same keystroke, and there is no version of it that can be
 * stale relative to the other.
 *
 * ## Why no prices here
 *
 * These facts can end up in a reply posted PUBLICLY under a video, so everything
 * on this card is something the merchant is content to see on a billboard. The
 * address, the phone and the hours are. Prices are not: they live in the catalog,
 * which has its own gate and whose answers are treated as price answers and put
 * behind the code. Mixing the two here would quietly leak the thing the whole
 * mechanic exists to withhold.
 */
export function ShopFactsCard({
  pageId, c, t, rtl, cardStyle, inputStyle, primaryStyle,
}: {
  pageId: string;
  c: TikTokPalette;
  t: TF;
  rtl: boolean;
  cardStyle: React.CSSProperties;
  inputStyle: React.CSSProperties;
  primaryStyle: (busy: boolean) => React.CSSProperties;
}) {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [phones, setPhones] = useState("");
  const [addresses, setAddresses] = useState("");
  const [hours, setHours] = useState("");
  const [extra, setExtra] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/studio/brand?pageId=${encodeURIComponent(pageId)}`);
        const d = await r.json();
        if (!alive) return;
        const b: Brand = d.brand || {};
        setBrand(b);
        setName(b.brand_name || "");
        setPhones((b.phones || []).join("، "));
        setAddresses((b.addresses || []).join("، "));
        setHours(b.hours || "");
        setExtra(b.extra || "");
      } catch { /* an unreachable profile is not worth an error on this screen */ }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [pageId]);

  async function save() {
    setSaving(true);
    setSaved("");
    const split = (s: string) => s.split(/[،,\n]/).map((x) => x.trim()).filter(Boolean);
    try {
      const r = await fetch("/api/studio/brand", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId,
          // Everything the Studio also stores is sent back unchanged, because the
          // endpoint upserts the whole row: omitting a field would quietly erase
          // the merchant's tone, logo and language from the other screen.
          ...brand,
          brand_name: name.trim() || null,
          phones: split(phones),
          addresses: split(addresses),
          hours: hours.trim() || null,
          extra: extra.trim() || null,
        }),
      });
      const d = await r.json();
      if (d.brand) {
        setBrand(d.brand);
        setSaved(t("حُفظ ✓", "Saved ✓"));
      } else {
        setSaved(t("لم يُحفظ", "Not saved"));
      }
    } catch {
      setSaved(t("لم يُحفظ", "Not saved"));
    }
    setSaving(false);
    setTimeout(() => setSaved(""), 2600);
  }

  const filled = [name, phones, addresses, hours, extra].filter((x) => x.trim()).length;

  return (
    <div style={{ ...cardStyle, padding: 16, marginBottom: 14 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          all: "unset", cursor: "pointer", display: "flex", width: "100%",
          alignItems: "center", justifyContent: "space-between", gap: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            {t("بيانات متجرك — يجيب منها البوت", "Your shop's facts — the bot answers from these")}
          </div>
          <div style={{ fontSize: 11.5, color: c.muted, lineHeight: 1.7, marginTop: 4 }}>
            {loading
              ? t("جارٍ التحميل…", "Loading…")
              : filled === 0
                ? t("فارغة — فلا يستطيع البوت أن يجيب عن العنوان ولا التوصيل ولا الدوام.",
                     "Empty — so the bot cannot answer about your address, delivery or hours.")
                : t(`${filled} من ٥ مملوءة. نفس البيانات التي يستعملها «الموظف الذكي».`,
                     `${filled} of 5 filled. The same data the AI Employee uses.`)}
          </div>
        </div>
        <span style={{ fontSize: 12, color: c.muted, flexShrink: 0, fontWeight: 800 }}>
          {open ? t("إخفاء", "Hide") : t("تعديل", "Edit")}
        </span>
      </button>

      {open && !loading && (
        <div style={{ display: "grid", gap: 9, marginTop: 14 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle}
            placeholder={t("اسم المتجر", "Shop name")} />
          <input value={addresses} onChange={(e) => setAddresses(e.target.value)} style={inputStyle}
            placeholder={t("العنوان — افصل بفاصلة لو عندك أكثر من فرع", "Address — comma-separate for more than one branch")} />
          <input value={phones} onChange={(e) => setPhones(e.target.value)} style={{ ...inputStyle, direction: "ltr", textAlign: rtl ? "right" : "left" }}
            placeholder={t("أرقام الهاتف", "Phone numbers")} />
          <input value={hours} onChange={(e) => setHours(e.target.value)} style={inputStyle}
            placeholder={t("الدوام — مثال: يومياً ٩ صباحاً إلى ١٠ مساءً، الجمعة مغلق", "Hours — e.g. daily 9am to 10pm, closed Friday")} />
          <textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={4}
            style={{ ...inputStyle, resize: "vertical" }}
            placeholder={t("التوصيل وأي شيء آخر تريد البوت أن يقوله — مثال: نوصّل لكل ليبيا، ٢٥ ديناراً خارج بنغازي، ويصل خلال ٤٨ ساعة. الضمان سنة.",
                           "Delivery and anything else you want the bot to say — e.g. we deliver nationwide, 25 LYD outside the city, arrives within 48 hours. One-year warranty.")} />
          <div style={{ fontSize: 11, color: c.muted, lineHeight: 1.75 }}>
            {t("لا تكتب أسعاراً هنا. هذه البيانات قد تُنشر علناً تحت الفيديو — والأسعار مكانها الكتالوج، وتُرسل خلف الكود.",
               "Do not write prices here. These facts can be posted publicly under a video — prices belong in the catalog, and go out behind the code.")}
          </div>
          <button onClick={save} disabled={saving} style={{ ...primaryStyle(saving), width: "100%" }}>
            {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />} {t("حفظ", "Save")}
          </button>
          {saved && (
            <div style={{ textAlign: "center", fontSize: 12, color: c.ok, fontWeight: 700 }}>{saved}</div>
          )}
        </div>
      )}
    </div>
  );
}
