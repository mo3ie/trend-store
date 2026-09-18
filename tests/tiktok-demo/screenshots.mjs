/**
 * Captures the prototype screens for visual review (and as reference stills for the
 * screen recording). Local prototype only — never opens TikTok.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.DEMO_BASE || "http://localhost:3222";
const OUT = process.env.SHOT_DIR || "shots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function shot(name) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log("captured", name);
}

// 1. Hub (disconnected)
await page.goto(`${BASE}/tiktok`, { waitUntil: "domcontentloaded" });
await shot("01-hub-disconnected");

// 2. Authorization preview
await page.goto(`${BASE}/tiktok-demo/authorization`, { waitUntil: "domcontentloaded" });
await shot("02-authorization");

// 3. Success
await page.getByRole("button", { name: /تصريح لمحل ترند|Authorize Trend Store/ }).click();
await page.waitForURL("**/tiktok-demo/success", { timeout: 15000 });
await shot("03-success");

// 4. Dashboard
await page.goto(`${BASE}/tiktok-bot/demo-account`, { waitUntil: "domcontentloaded" });
await shot("04-dashboard");

// 5. Videos
await page.goto(`${BASE}/tiktok-bot/demo-account/videos`, { waitUntil: "domcontentloaded" });
await shot("05-videos");

// 6. Comments
await page.goto(`${BASE}/tiktok-bot/demo-account/comments`, { waitUntil: "domcontentloaded" });
await shot("06-comments");

// 7. Reply modal
await page.getByRole("button", { name: /^رد$|^Reply$/ }).first().click();
await shot("07-reply-modal");
await page.keyboard.press("Escape");

// 8. Publish
await page.goto(`${BASE}/tiktok-bot/demo-account/publish`, { waitUntil: "domcontentloaded" });
await shot("08-publish-video");

// 9. Hub connected
await page.goto(`${BASE}/tiktok`, { waitUntil: "domcontentloaded" });
await shot("09-hub-connected");

// 10. Accounts page with demo card
await page.goto(`${BASE}/tiktok-bot`, { waitUntil: "domcontentloaded" });
await shot("10-accounts");

// 11. Mobile
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/tiktok-bot/demo-account`, { waitUntil: "domcontentloaded" });
await shot("11-mobile-dashboard");

await browser.close();
