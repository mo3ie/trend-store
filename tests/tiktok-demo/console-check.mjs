import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const p = await b.newPage();
const problems = [];
p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text().slice(0, 160)}`); });
p.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 160)}`));
for (const path of ["/tiktok", "/tiktok-demo/authorization", "/tiktok-bot/demo-account", "/tiktok-bot/demo-account/videos", "/tiktok-bot/demo-account/comments", "/tiktok-bot/demo-account/publish"]) {
  await p.goto(`http://localhost:3222${path}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1200);
}
const real = problems.filter((t) => !/Download the React DevTools|Fast Refresh|\[Fast Refresh\]/.test(t));
console.log(real.length ? real.join("\n") : "NO console errors or warnings on any prototype page");
await b.close();
