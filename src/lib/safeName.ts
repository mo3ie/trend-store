/**
 * Storage keys only accept plain ASCII. Customer/admin file names are often
 * Arabic ("هاتف HONOR.png") → "Invalid key". Keep latin letters/digits and the
 * extension; fall back to a random stem when nothing usable is left.
 */
export function safeName(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = (dot > 0 ? name.slice(dot + 1) : "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6) || "bin";
  const stem = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFKD").replace(/[^A-Za-z0-9_-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 60);
  return `${stem || Math.random().toString(36).slice(2, 10)}.${ext}`;
}
