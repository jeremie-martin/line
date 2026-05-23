/**
 * Capture every network request linerider.com makes during a full session:
 * boot, enter editor, load track, video export. Used to decide if it's
 * cloneable as a static site.
 */
import { chromium } from "playwright";
import { writeFileSync, readFileSync } from "node:fs";

type Req = { url: string; method: string; resourceType: string; status?: number; fromCache?: boolean; size?: number };
const reqs: Req[] = [];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

page.on("request", (r) => {
  reqs.push({ url: r.url(), method: r.method(), resourceType: r.resourceType() });
});
page.on("response", async (resp) => {
  const matching = reqs.find((r) => r.url === resp.url() && r.status === undefined);
  if (matching) {
    matching.status = resp.status();
    matching.fromCache = resp.fromServiceWorker() || resp.fromCache?.() || false;
    try {
      const cl = resp.headers()["content-length"];
      if (cl) matching.size = parseInt(cl, 10);
    } catch { /* */ }
  }
});

await page.goto("https://www.linerider.com/?forceMillions", { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForTimeout(2000);
await page.locator("text=/^\\s*PLAY\\s*$/i").first().click({ timeout: 10_000 });
await page.waitForTimeout(3000);

// Load track + open export modal
const trackJson = JSON.parse(readFileSync("test.track.json", "utf8"));
await page.evaluate((t) => {
  // deno-lint-ignore no-explicit-any
  const w = window as any;
  w.loadTrackFromString(JSON.stringify(t));
}, trackJson);
await page.waitForTimeout(1000);

await page.evaluate(() => {
  for (const btn of Array.from(document.querySelectorAll("button"))) {
    const d = btn.querySelector("path")?.getAttribute("d") ?? "";
    if (d.startsWith("M17,10.5V7C17,6.45")) { (btn as HTMLButtonElement).click(); return; }
  }
});
await page.waitForTimeout(2000);

await browser.close();

// Categorize by origin
const origins = new Map<string, Req[]>();
for (const r of reqs) {
  try {
    const o = new URL(r.url).origin;
    if (!origins.has(o)) origins.set(o, []);
    origins.get(o)!.push(r);
  } catch { /* */ }
}

console.log(`\n=== Total requests: ${reqs.length} ===\n`);
for (const [origin, list] of origins) {
  console.log(`${origin}: ${list.length} requests`);
  const types = new Map<string, number>();
  for (const r of list) types.set(r.resourceType, (types.get(r.resourceType) ?? 0) + 1);
  for (const [t, n] of types) console.log(`    ${t}: ${n}`);
}

console.log(`\n=== Non-linerider.com requests ===`);
for (const r of reqs) {
  if (!r.url.includes("linerider.com")) {
    console.log(`  ${r.method} ${r.url.slice(0, 100)} [${r.resourceType}] ${r.status ?? "-"}`);
  }
}

console.log(`\n=== XHR / fetch on linerider.com ===`);
for (const r of reqs) {
  if (r.url.includes("linerider.com") && (r.resourceType === "xhr" || r.resourceType === "fetch")) {
    console.log(`  ${r.method} ${r.url} [${r.status ?? "-"}]`);
  }
}

writeFileSync("shakedown/network-log.json", JSON.stringify(reqs, null, 2));
