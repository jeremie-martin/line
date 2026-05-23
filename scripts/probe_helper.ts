/**
 * Verify __lr helper installs and its surface is callable.
 */
import { chromium } from "playwright";

const ORIGIN = process.env.LR_ORIGIN ?? "http://127.0.0.1:8765";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
page.on("console", (m) => console.log(`[browser ${m.type()}] ${m.text()}`));

await page.goto(`${ORIGIN}/?forceMillions`, { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForTimeout(2000);

const surface = await page.evaluate(() => {
  // deno-lint-ignore no-explicit-any
  const w = window as any;
  if (!w.__lr) return { installed: false };
  return {
    installed: true,
    methodNames: Object.keys(w.__lr).sort(),
    storeAvailable: typeof w.store?.dispatch === "function",
    loadTrackAvailable: typeof w.loadTrackFromString === "function",
  };
});
console.log("\nhelper surface:", JSON.stringify(surface, null, 2));

await browser.close();
