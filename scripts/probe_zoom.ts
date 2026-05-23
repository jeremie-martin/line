import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto("https://www.linerider.com/?forceMillions", { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForTimeout(2000);
await page.locator("text=/^\\s*PLAY\\s*$/i").first().click({ timeout: 10_000 });
await page.waitForTimeout(3000);
const camera = await page.evaluate(() => {
  // deno-lint-ignore no-explicit-any
  const w = window as any;
  const c = w.store.getState().camera;
  return { playbackZoom: c.playbackZoom, editorZoom: c.editorZoom };
});
console.log("default camera state (fresh load):", JSON.stringify(camera));
await browser.close();
