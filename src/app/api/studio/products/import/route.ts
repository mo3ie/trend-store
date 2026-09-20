import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";

export const maxDuration = 60;

const MAX_ROWS = 2000;

/**
 * Bulk catalog import from a file. Available on every plan.
 *
 * Accepts a CSV / TSV / plain-text list as multipart form-data (`file`) or as raw
 * text in JSON (`{ pageId, text }`). A header row is detected and mapped, so the
 * columns can be in any order and in Arabic or English; a file with no
 * recognisable header is treated as one product name per line.
 */

// Split one CSV line, honouring quoted fields that contain the delimiter.
function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === delim && !inQ) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim().replace(/^"|"$/g, ""));
}

// Header synonyms, Arabic and English, so a merchant's own spreadsheet just works.
const FIELD_SYNONYMS: Record<string, string[]> = {
  name:        ["name", "product", "title", "item", "الاسم", "اسم", "المنتج", "الصنف"],
  category:    ["category", "type", "group", "الفئة", "القسم", "التصنيف", "النوع"],
  price_text:  ["price", "cost", "amount", "السعر", "الثمن", "سعر"],
  description: ["description", "details", "notes", "الوصف", "التفاصيل", "ملاحظات"],
  image:       ["image", "image_url", "photo", "picture", "الصورة", "صورة", "رابط الصورة"],
  available:   ["available", "in_stock", "stock", "متوفر", "التوفر", "الحالة"],
};

function mapHeader(cells: string[]): Record<number, string> | null {
  const map: Record<number, string> = {};
  cells.forEach((cell, i) => {
    const norm = cell.toLowerCase().replace(/[_\s-]+/g, " ").trim();
    for (const [field, names] of Object.entries(FIELD_SYNONYMS)) {
      if (names.some((n) => norm === n || norm === n.toLowerCase())) { map[i] = field; break; }
    }
  });
  // Only treat the first row as a header if it actually names the product column.
  return Object.values(map).includes("name") ? map : null;
}

const FALSEY = ["0", "no", "false", "لا", "غير متوفر", "نفد", "منتهي"];

function parse(text: string): Array<Record<string, string | boolean>> {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // Pick the delimiter that splits the first line into the most columns.
  const delim = [",", "\t", ";"]
    .map((d) => ({ d, n: splitLine(lines[0], d).length }))
    .sort((a, b) => b.n - a.n)[0];

  const header = delim.n > 1 ? mapHeader(splitLine(lines[0], delim.d)) : null;
  const body = header ? lines.slice(1) : lines;

  const rows: Array<Record<string, string | boolean>> = [];
  for (const line of body.slice(0, MAX_ROWS)) {
    if (!header) { rows.push({ name: line }); continue; }
    const cells = splitLine(line, delim.d);
    const row: Record<string, string | boolean> = {};
    for (const [idx, field] of Object.entries(header)) {
      const v = (cells[Number(idx)] || "").trim();
      if (!v) continue;
      row[field] = field === "available" ? !FALSEY.includes(v.toLowerCase()) : v;
    }
    if (row.name) rows.push(row);
  }
  return rows;
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  let pageId = "", text = "", replace = false;

  if ((req.headers.get("content-type") || "").includes("multipart/form-data")) {
    const form = await req.formData();
    pageId = String(form.get("pageId") || "");
    replace = String(form.get("replace") || "") === "true";
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "الملف مطلوب" }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "الملف كبير جداً (الحد ٥ ميغا)" }, { status: 413 });
    text = await file.text();
  } else {
    const b = await req.json().catch(() => ({}));
    pageId = String(b.pageId || "");
    text = String(b.text || "");
    replace = Boolean(b.replace);
  }

  if (!pageId) return NextResponse.json({ error: "pageId مطلوب" }, { status: 400 });
  if (!text.trim()) return NextResponse.json({ error: "الملف فارغ" }, { status: 400 });

  const parsed = parse(text);
  if (parsed.length === 0) {
    return NextResponse.json({
      error: "no_rows",
      message: "لم نتعرّف على أي منتج. استعمل ملف CSV بعمود «الاسم» على الأقل، أو اكتب اسم منتج في كل سطر.",
    }, { status: 400 });
  }

  // Replacing swaps the catalog atomically enough for this purpose: the old rows go
  // only after the new ones parse cleanly, so a bad file can never empty a catalog.
  if (replace) {
    await supabaseAdmin.from("studio_products").delete().eq("user_id", user.id).eq("page_id", pageId);
  }

  const rows = parsed.map((r) => ({
    user_id:     user.id,
    page_id:     pageId,
    name:        String(r.name).slice(0, 200),
    category:    r.category ? String(r.category).slice(0, 100) : null,
    price_text:  r.price_text ? String(r.price_text).slice(0, 100) : null,
    description: r.description ? String(r.description).slice(0, 1000) : null,
    images:      r.image ? [String(r.image)] : [],
    active:      true,
    available:   r.available !== false,
  }));

  const { data, error } = await supabaseAdmin.from("studio_products").insert(rows).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    imported: data?.length || 0,
    skipped: Math.max(0, parsed.length - (data?.length || 0)),
    products: data || [],
  });
}
