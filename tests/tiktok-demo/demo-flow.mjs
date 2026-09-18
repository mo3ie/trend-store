/**
 * Drives the exact screen-recording sequence against the local dev server and asserts each
 * step. This tests OUR OWN prototype UI only — it never opens TikTok.
 */
import { chromium } from "playwright-core";

const BASE = process.env.DEMO_BASE || "http://localhost:3220";
const results = [];
let failures = 0;

function check(name, ok, detail = "") {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failures++;
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// Fail loudly if the prototype ever talks to a production TikTok route.
// Only the PROTOTYPE surfaces are under test here. The pre-existing /tiktok-bot accounts
// page legitimately calls /api/tiktok/configs, and the flow passes through it on disconnect,
// so a call is only a violation when it originates from a prototype route.
const apiCalls = [];
const PROTOTYPE_ROUTE = /\/tiktok-demo\/|\/tiktok-bot\/demo-account/;
page.on("request", (r) => {
  const u = r.url();
  const from = page.url();
  const hitsTikTok = u.includes("/api/tiktok") || u.includes("tiktok.com");
  if (hitsTikTok && PROTOTYPE_ROUTE.test(from)) apiCalls.push(`${from} -> ${u}`);
});

try {
  // STEP 1 — hub
  await page.goto(`${BASE}/tiktok`, { waitUntil: "networkidle" });
  check("1 hub loads with Accounts API section", await page.getByRole("heading", { name: /TikTok Accounts & Content|حسابات TikTok والمحتوى/ }).isVisible());
  check("1b hub shows Not connected", (await page.getByText(/غير متصل|Not connected/).count()) > 0);

  // STEP 2 — connect
  await page.getByRole("link", { name: /ربط حساب TikTok|Connect TikTok Account/ }).last().click();
  await page.waitForURL("**/tiktok-demo/authorization");

  // STEP 3 — authorization preview with permissions
  check("3 authorization preview labelled", (await page.getByText(/معاينة التصريح|Authorization Preview/).count()) > 0);
  const permCount = await page.locator("ul li").filter({ hasText: /./ }).count();
  check("3b six permissions listed", permCount >= 6, `found ${permCount}`);

  // STEP 4/5 — authorize → success
  await page.getByRole("button", { name: /تصريح لمحل ترند|Authorize Trend Store/ }).click();
  await page.waitForURL("**/tiktok-demo/success", { timeout: 15000 });
  check("5 success screen", (await page.getByText(/تم ربط حساب TikTok|TikTok account connected/).count()) > 0);

  // STEP 6 — dashboard + account information
  await page.getByRole("button", { name: /فتح لوحة TikTok|Open TikTok Dashboard/ }).click();
  await page.waitForURL("**/tiktok-bot/demo-account");
  check("6 account information shown", (await page.getByText(/معلومات الحساب|Account Information/).count()) > 0);
  check("6b demo badge visible", (await page.getByText(/نموذج أولي|Prototype \/ Demo/).count()) > 0);
  check("6c demo data labelled", (await page.getByText(/بيانات تجريبية|Demo data/).count()) > 0);

  // STEP 7 — videos
  await page.getByRole("link", { name: /^الفيديوهات$|^Videos$/ }).first().click();
  await page.waitForURL("**/demo-account/videos");
  const cards = await page.getByRole("button", { name: /عرض التعليقات|View Comments/ }).count();
  check("7 video grid has 6 cards", cards === 6, `found ${cards}`);
  await page.getByRole("button", { name: /^تحديث$|^Refresh$/ }).click();
  check("7b refresh shows loading", (await page.getByText(/جارٍ تحديث الفيديوهات|Refreshing videos/).count()) > 0);
  await page.waitForTimeout(1500);

  // STEP 8 — comments
  await page.getByRole("link", { name: /^التعليقات$|^Comments$/ }).first().click();
  await page.waitForURL("**/demo-account/comments");
  const before = await page.locator("article").count();
  check("8 comments listed", before >= 3, `found ${before}`);

  // STEP 9 — reply
  await page.getByRole("button", { name: /^رد$|^Reply$/ }).first().click();
  await page.getByRole("textbox", { name: /ردّك|Your reply/ }).fill("شكراً لتواصلك! السعر متوفر في الوصف.");
  await page.getByRole("button", { name: /إرسال الرد|Send Reply/ }).click();
  await page.waitForTimeout(1400);
  check("9 reply toast", (await page.getByText(/تمت إضافة الرد بنجاح|Reply added successfully/).count()) > 0);
  check("9b reply rendered under comment", (await page.getByText("شكراً لتواصلك! السعر متوفر في الوصف.").count()) > 0);

  // LIKE
  const likeBtn = page.getByRole("button", { name: /إعجاب|Like/ }).first();
  const likeBefore = await likeBtn.innerText();
  await likeBtn.click();
  await page.waitForTimeout(300);
  const likeAfter = await page.getByRole("button", { name: /إعجاب|Like/ }).first().innerText();
  check("like count changes", likeBefore !== likeAfter, `${likeBefore.trim()} -> ${likeAfter.trim()}`);

  // STEP 10 — hide with confirmation
  await page.getByRole("button", { name: /^إخفاء$|^Hide$/ }).first().click();
  check("10 hide confirmation dialog", await page.getByRole("dialog").isVisible());
  await page.getByRole("dialog").getByRole("button", { name: /^إخفاء$|^Hide$/ }).click();
  await page.waitForTimeout(1000);
  check("10b hide toast", (await page.getByText(/تم إخفاء التعليق بنجاح|Comment hidden successfully/).count()) > 0);

  // DELETE
  await page.getByRole("button", { name: /^حذف$|^Delete$/ }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: /^حذف$|^Delete$/ }).click();
  await page.waitForTimeout(1000);
  const after = await page.locator("article").count();
  check("delete removes a comment", after === before - 1, `${before} -> ${after}`);
  check("delete toast", (await page.getByText(/تم حذف التعليق بنجاح|Comment deleted successfully/).count()) > 0);

  // STEP 11/12 — publish video
  await page.getByRole("link", { name: /نشر المحتوى|^Publish$/ }).first().click();
  await page.waitForURL("**/demo-account/publish");
  await page.getByRole("textbox", { name: /^الوصف$|^Caption$/ }).fill("عرض اليوم على السماعات");
  await page.getByRole("button", { name: /نشر إلى TikTok|Publish to TikTok/ }).click();
  await page.waitForTimeout(600);
  check("12 publish shows preparing", (await page.getByText(/جارٍ تجهيز الفيديو|Preparing video/).count()) > 0);
  await page.waitForTimeout(3000);
  check("12b publish success card", (await page.getByText(/تم نشر الفيديو|Video published/).count()) > 0);

  // publishing history got the new row
  await page.reload({ waitUntil: "networkidle" });
  check("history records the publish", (await page.getByText("عرض اليوم على السماعات").count()) > 0);

  // photo mode renders
  await page.getByRole("tab", { name: /نشر صور|Publish Photo/ }).click();
  check("17 photo publish UI", (await page.getByText(/اسحب الصور هنا|Drag your photos here/).count()) > 0);

  // STEP 14 — disconnect
  await page.getByRole("link", { name: /لوحة الحساب|^Dashboard$/ }).first().click();
  await page.waitForURL("**/tiktok-bot/demo-account");
  await page.getByRole("button", { name: /فصل الحساب|Disconnect/ }).first().click();
  check("14 disconnect confirmation", (await page.getByText(/سيؤدي الفصل إلى إزالة|Disconnecting will remove/).count()) > 0);
  await page.getByRole("dialog").getByRole("button", { name: /فصل الحساب|Disconnect/ }).click();
  await page.waitForURL("**/tiktok-bot", { timeout: 15000 });
  await page.waitForTimeout(500);

  // back to hub: disconnected again
  await page.goto(`${BASE}/tiktok`, { waitUntil: "networkidle" });
  check("14b hub back to Not connected", (await page.getByText(/غير متصل|Not connected/).count()) > 0);

  // mobile viewport
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/tiktok-bot/demo-account/comments`, { waitUntil: "networkidle" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  check("16 mobile layout has no horizontal overflow", !overflow);

  check("17 no production TikTok API calls from the prototype", apiCalls.length === 0, apiCalls.join(", "));
} catch (err) {
  check("flow completed without exception", false, String(err).slice(0, 300));
} finally {
  console.log(results.join("\n"));
  console.log(`\n${results.length - failures}/${results.length} checks passed`);
  await browser.close();
  process.exit(failures ? 1 : 0);
}
