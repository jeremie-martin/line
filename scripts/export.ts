/**
 * Export a Line Rider track to mp4 via the local mirror + window.__lr helper.
 *
 * Examples:
 *   npx tsx scripts/export.ts --track=test.track.json --zoom=3 --1080p --hq
 *   npx tsx scripts/export.ts --track=test.track.json --out=shakedown/out.mp4
 */
import { chromium } from "playwright";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const argv = process.argv.slice(2);
const arg = (name: string): string | null => {
  const m = argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.slice(name.length + 3) : null;
};
const has = (name: string) => argv.includes(`--${name}`);

const origin = arg("origin") ?? "http://127.0.0.1:8765";
const trackPath = arg("track");
const zoom = arg("zoom") !== null ? parseFloat(arg("zoom")!) : undefined;
const resolution = has("1080p") ? "1080p" : "720p";
const hq = has("hq");
const outPath = resolve(arg("out") ?? "shakedown/out.mp4");
const headed = has("headed");

if (!trackPath || !existsSync(trackPath)) {
  console.error(`pass --track=path/to/track.json (got: ${trackPath})`);
  process.exit(1);
}
const trackJson = JSON.parse(readFileSync(trackPath, "utf8"));
mkdirSync(dirname(outPath), { recursive: true });

console.log(
  `track=${trackPath} (${trackJson.lines?.length} lines, duration=${trackJson.duration})\n` +
  `resolution=${resolution}${hq ? " HQ" : ""} zoom=${zoom ?? "default"}\n` +
  `origin=${origin}\nout=${outPath}`,
);

const browser = await chromium.launch({ headless: !headed });
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error(`[pageerror] ${e.message}`));
page.on("console", (m) => {
  const t = m.text();
  if (t.startsWith("[__lr]") || m.type() === "error") console.log(`[browser ${m.type()}] ${t}`);
});

await page.goto(`${origin}/?forceMillions`, { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForTimeout(2000);

// Set up the download wait BEFORE triggering export so we don't miss it.
const downloadPromise = page.waitForEvent("download", { timeout: 600_000 });

// One round-trip into the page: the helper does the whole flow.
await page.evaluate(
  async ({ track, zoom, resolution, hq }) => {
    // deno-lint-ignore no-explicit-any
    const lr = (window as any).__lr;
    if (!lr) throw new Error("window.__lr not installed");
    await lr.exportVideo({ track, zoom, resolution, hq, filename: "lr-render.mp4" });
  },
  { track: trackJson, zoom, resolution, hq },
);

const download = await downloadPromise;
await download.saveAs(outPath);
console.log(`saved ${outPath}`);

await browser.close();
