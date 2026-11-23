import { readFileSync } from "fs";
for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const { createClient } = await import("@supabase/supabase-js");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const [base, bp, dir] = process.argv.slice(2);
const email = `vis-test-${Date.now()}@example.invalid`, password = crypto.randomUUID();
const uid = (await admin.auth.admin.createUser({ email, password, email_confirm: true })).data.user!.id;
try {
  await admin.from("deep_scan_vouchers").insert({ user_id: uid, code: "DS-T" + Date.now().toString(36).toUpperCase(), amount: 5 });
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: s } = await anon.auth.signInWithPassword({ email, password });
  const ref = new URL(url).hostname.split(".")[0];
  const H = { cookie: `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(s.session)).toString("base64url")}`, "x-vercel-protection-bypass": bp, "content-type": "application/json" };
  const img = (f: string) => "data:image/png;base64," + readFileSync(`${dir}/${f}`).toString("base64");
  const r = await fetch(`${base}/api/deep-scan/analyze`, { method: "POST", headers: H, body: JSON.stringify({ images: [img("fake-batt.png"), img("fake-about.png")] }) });
  const j = await r.json(); console.log(r.status, JSON.stringify(j).slice(0, 700));
  if (j.id) {
    const rep = await (await fetch(`${base}/api/ai/diagnose?id=${j.id}`, { headers: H })).json();
    console.log("deep:", JSON.stringify({ battery: rep.results.deep.battery, parts: rep.results.deep.parts, device: rep.results.deep.device }));
    console.log("summary:", rep.report.summary);
    for (const i of rep.report.issues) console.log("-", i.severity, i.title);
  }
} finally {
  await admin.from("device_reports").delete().eq("user_id", uid);
  await admin.from("deep_scan_vouchers").delete().eq("user_id", uid);
  await admin.from("profiles").delete().eq("id", uid);
  await admin.auth.admin.deleteUser(uid);
}
