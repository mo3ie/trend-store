import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const OUT = process.env.SHOT_DIR || "shots";
// Set the site's own theme flag before load (the dev overlay blocks clicking the toggle).
await p.goto("http://localhost:3222/tiktok", { waitUntil: "domcontentloaded" });
await p.evaluate(() => {
  localStorage.setItem("theme", "light");
  document.documentElement.classList.add("light");
});
await p.goto("http://localhost:3222/tiktok-bot", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1500);
await p.screenshot({ path: `${OUT}/12-light-accounts.png`, fullPage: true });
await p.goto("http://localhost:3222/tiktok-bot/demo-account/comments", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1200);
await p.screenshot({ path: `${OUT}/13-light-comments.png`, fullPage: true });
console.log("light shots captured");
await b.close();
