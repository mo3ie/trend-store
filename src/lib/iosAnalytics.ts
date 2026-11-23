/**
 * Reads iPhone «Analytics Data» files (Settings → Privacy & Security →
 * Analytics & Improvements → Analytics Data) IN THE BROWSER and returns a small
 * summary. Raw logs never leave the customer's device — only the numbers below.
 *
 * File kinds (by name / bug_type in the first-line JSON header):
 *   Analytics-*.ips.ca.synced / log-aggregated-*  (211)  battery health, cycles, capacities
 *   panic-full-*.ips                             (210)  kernel panics + panicString
 *   JetsamEvent-*.ips                            (298)  memory-pressure kills
 *   <App>-*.ips                                  (309)  app crashes
 * Apple renames analytics keys between iOS versions, so battery values are
 * matched by several known key names and the most recent value wins.
 */
export type AnalyticsSummary = {
  files: number;
  device: { productType?: string; model?: string; ios?: string };
  battery: { healthPct?: number; cycles?: number; designMah?: number; fullMah?: number; source?: string };
  panics: { total: number; last30d: number; reasons: string[]; latest?: string };
  appCrashes: { total: number; top: { app: string; count: number }[] };
  jetsam: number;
  period: { from?: string; to?: string };
};

const MODELS: Record<string, string> = {
  "iPhone12,1": "iPhone 11", "iPhone12,3": "iPhone 11 Pro", "iPhone12,5": "iPhone 11 Pro Max", "iPhone12,8": "iPhone SE (2nd gen)",
  "iPhone13,1": "iPhone 12 mini", "iPhone13,2": "iPhone 12", "iPhone13,3": "iPhone 12 Pro", "iPhone13,4": "iPhone 12 Pro Max",
  "iPhone14,4": "iPhone 13 mini", "iPhone14,5": "iPhone 13", "iPhone14,2": "iPhone 13 Pro", "iPhone14,3": "iPhone 13 Pro Max", "iPhone14,6": "iPhone SE (3rd gen)",
  "iPhone14,7": "iPhone 14", "iPhone14,8": "iPhone 14 Plus", "iPhone15,2": "iPhone 14 Pro", "iPhone15,3": "iPhone 14 Pro Max",
  "iPhone15,4": "iPhone 15", "iPhone15,5": "iPhone 15 Plus", "iPhone16,1": "iPhone 15 Pro", "iPhone16,2": "iPhone 15 Pro Max",
  "iPhone17,3": "iPhone 16", "iPhone17,4": "iPhone 16 Plus", "iPhone17,1": "iPhone 16 Pro", "iPhone17,2": "iPhone 16 Pro Max", "iPhone17,5": "iPhone 16e",
  "iPhone18,3": "iPhone 17", "iPhone18,1": "iPhone 17 Pro", "iPhone18,2": "iPhone 17 Pro Max", "iPhone18,4": "iPhone Air",
  "iPhone10,3": "iPhone X", "iPhone10,6": "iPhone X", "iPhone11,2": "iPhone XS", "iPhone11,6": "iPhone XS Max", "iPhone11,8": "iPhone XR",
};

const lastNum = (text: string, keys: string[]): number | undefined => {
  let best: number | undefined;
  for (const k of keys) {
    const re = new RegExp(`"${k}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) best = Number(m[1]);
    if (best !== undefined) return best;
  }
  return best;
};

function header(text: string): Record<string, unknown> {
  const first = text.slice(0, text.indexOf("\n") > 0 ? text.indexOf("\n") : 2000).trim();
  try { return JSON.parse(first); } catch { return {}; }
}
const tsOf = (h: Record<string, unknown>, name: string) => {
  const t = String(h.timestamp || "");
  const d = t ? Date.parse(t.replace(" ", "T").replace(/ ([+-]\d{2})(\d{2})$/, "$1:$2").replace(/\.\d+/, "")) : NaN;
  if (isFinite(d)) return d;
  const m = name.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? Date.parse(m[1]) : NaN;
};

export async function summarize(files: File[]): Promise<AnalyticsSummary> {
  const out: AnalyticsSummary = { files: files.length, device: {}, battery: {}, panics: { total: 0, last30d: 0, reasons: [] }, appCrashes: { total: 0, top: [] }, jetsam: 0, period: {} };
  const reasons = new Map<string, number>(), apps = new Map<string, number>();
  let batteryTs = -Infinity, minTs = Infinity, maxTs = -Infinity, latestPanic = -Infinity;
  const month = Date.now() - 30 * 864e5;

  for (const f of files) {
    if (f.size > 40 * 1024 * 1024) continue;
    const text = await f.text();
    const h = header(text);
    const bug = String(h.bug_type ?? "");
    const ts = tsOf(h, f.name);
    if (isFinite(ts)) { minTs = Math.min(minTs, ts); maxTs = Math.max(maxTs, ts); }
    const os = String(h.os_version || "").match(/(?:iPhone OS|iOS)\s+([\d.]+)/)?.[1];
    if (os && (!out.device.ios || ts >= maxTs)) out.device.ios = os;
    const pt = text.match(/"(?:product|modelCode|machine_config|deviceModel|device_model|hardware_model|model)"\s*:\s*"(iPhone\d+,\d+)"/)?.[1] || text.match(/\b(iPhone\d{1,2},\d)\b/)?.[1];
    if (pt) { out.device.productType = pt; out.device.model = MODELS[pt] || pt; }

    if (bug === "210" || /panic-full|panic-base/i.test(f.name)) {
      out.panics.total++;
      if (ts >= month) out.panics.last30d++;
      if (ts > latestPanic) { latestPanic = ts; out.panics.latest = new Date(ts).toISOString(); }
      const ps = text.match(/"panicString"\s*:\s*"((?:[^"\\]|\\.){8,400})/)?.[1] || text.match(/panic\(cpu \d+ caller [^)]+\):\s*(.{8,200})/)?.[1];
      if (ps) {
        const k = ps.split("\\n")[0].replace(/\\t/g, " ").replace(/0x[0-9a-f]+/gi, "…").replace(/\s+/g, " ").trim().slice(0, 120);
        reasons.set(k, (reasons.get(k) || 0) + 1);
      }
      continue;
    }
    if (bug === "298" || /JetsamEvent/i.test(f.name)) { out.jetsam++; continue; }
    if (bug === "309" || bug === "109" || /\.ips$/i.test(f.name) && h.app_name) {
      const app = String(h.app_name || h.name || f.name.split("-")[0]).slice(0, 40);
      out.appCrashes.total++; apps.set(app, (apps.get(app) || 0) + 1);
      continue;
    }
    // Analytics / aggregated logs → battery
    const health = lastNum(text, ["last_value_MaximumCapacityPercent", "MaximumCapacityPercent", "maximumCapacityPercent", "BatteryHealthMaxCapacity", "last_value_BatteryHealth"]);
    const cycles = lastNum(text, ["last_value_CycleCount", "CycleCount", "cycleCount", "BatteryCycleCount"]);
    const design = lastNum(text, ["last_value_DesignCapacity", "DesignCapacity", "designCapacity"]);
    const full = lastNum(text, ["last_value_NominalChargeCapacity", "NominalChargeCapacity", "AppleRawMaxCapacity", "last_value_AppleRawMaxCapacity", "MaxCapacity"]);
    if ((health !== undefined || cycles !== undefined) && (isFinite(ts) ? ts >= batteryTs : true)) {
      batteryTs = isFinite(ts) ? ts : batteryTs;
      if (cycles !== undefined && cycles >= 0 && cycles < 5000) out.battery.cycles = cycles;
      if (design && design > 500) out.battery.designMah = design;
      if (full && full > 300 && full < 10000) out.battery.fullMah = full;
      if (health !== undefined && health > 30 && health <= 110) out.battery.healthPct = Math.min(100, Math.round(health));
      else if (out.battery.designMah && out.battery.fullMah) out.battery.healthPct = Math.min(100, Math.round((out.battery.fullMah / out.battery.designMah) * 100));
      out.battery.source = f.name.slice(0, 60);
    }
  }
  out.panics.reasons = [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => `${n}× ${k}`);
  out.appCrashes.top = [...apps.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([app, count]) => ({ app, count }));
  if (isFinite(minTs)) out.period.from = new Date(minTs).toISOString().slice(0, 10);
  if (isFinite(maxTs)) out.period.to = new Date(maxTs).toISOString().slice(0, 10);
  return out;
}

export const hasUsefulData = (s: AnalyticsSummary) => s.battery.healthPct !== undefined || s.battery.cycles !== undefined || s.panics.total > 0 || s.appCrashes.total > 0 || s.jetsam > 0;
