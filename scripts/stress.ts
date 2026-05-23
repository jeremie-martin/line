/**
 * Stress-test the __lr helper beyond the default 720p/1080p paths.
 *
 * Tests:
 *   1. Custom resolution (1024×768)
 *   2. Custom encoder QP=15 (ultra HQ)
 *   3. Three back-to-back renders in one Playwright session (varied zoom)
 *   4. Track switch mid-session (two different tracks, one page)
 *
 * Each test produces an mp4 under shakedown/stress/. Final summary
 * tabulates outcomes.
 */
import { chromium, type Page, type BrowserContext, type Browser } from "playwright";
import { mkdirSync, readFileSync, statSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const ORIGIN = process.env.LR_ORIGIN ?? "http://127.0.0.1:8765";
const STRESS_DIR = resolve("shakedown/stress");
mkdirSync(STRESS_DIR, { recursive: true });

if (!existsSync("test.track.json")) {
  console.error("need test.track.json in cwd"); process.exit(1);
}
const trackA = JSON.parse(readFileSync("test.track.json", "utf8"));

// Build a synthetic alternate "track B" by mirroring track A's lines vertically.
// This produces a structurally different track but uses the same schema.
const trackB = {
  ...trackA,
  label: "stress-track-B",
  lines: trackA.lines.map((l: { y1: number; y2: number }) => ({ ...l, y1: -l.y1, y2: -l.y2 })),
};
writeFileSync(resolve(STRESS_DIR, "trackB.json"), JSON.stringify(trackB, null, 2));

type Result = { name: string; ok: boolean; outPath?: string; size?: number; ffprobe?: string; error?: string; elapsedMs: number };
const results: Result[] = [];

function ffprobeSummary(path: string): string {
  try {
    return execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,nb_frames,duration -of csv=p=0 "${path}"`).toString().trim();
  } catch (e) {
    return `ffprobe failed: ${String(e).slice(0, 120)}`;
  }
}

async function runOneRender(page: Page, cfg: Record<string, unknown>, outFilename: string): Promise<{ outPath: string; size: number; ffprobe: string }> {
  if (page.isClosed()) throw new Error("page closed before render");
  console.log(`  > render: ${outFilename}`);
  const outPath = resolve(STRESS_DIR, outFilename);
  const dlPromise = page.waitForEvent("download", { timeout: 600_000 });
  await page.evaluate(async (c) => {
    // deno-lint-ignore no-explicit-any
    await (window as any).__lr.exportVideo(c);
  }, cfg);
  const dl = await dlPromise;
  await dl.saveAs(outPath);
  const size = statSync(outPath).size;
  return { outPath, size, ffprobe: ffprobeSummary(outPath) };
}

const browser: Browser = await chromium.launch({ headless: true });

// =========================================================================
// Test 1: Custom resolution (1024×768)
// =========================================================================
{
  const t0 = Date.now();
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error(`[pageerror] ${e.message}`));
  try {
    await page.goto(`${ORIGIN}/?forceMillions`, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(2000);
    const { outPath, size, ffprobe } = await runOneRender(page, {
      track: trackA,
      zoom: 3,
      resolution: { width: 1024, height: 768 },
      hq: false,
      filename: "stress1-custom-res.mp4",
    }, "stress1-custom-res.mp4");
    results.push({ name: "1. Custom resolution 1024x768", ok: true, outPath, size, ffprobe, elapsedMs: Date.now() - t0 });
  } catch (e) {
    results.push({ name: "1. Custom resolution 1024x768", ok: false, error: String(e), elapsedMs: Date.now() - t0 });
  }
  await ctx.close();
}

// =========================================================================
// Test 2: Ultra-HQ encoder (QP=15) at 1080p
// =========================================================================
{
  const t0 = Date.now();
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error(`[pageerror] ${e.message}`));
  try {
    await page.goto(`${ORIGIN}/?forceMillions`, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(2000);
    const { outPath, size, ffprobe } = await runOneRender(page, {
      track: trackA,
      zoom: 3,
      resolution: "1080p",
      hq: false, // disable HQ flag so QP comes from encoderSettings
      encoderSettings: { quantizationParameter: 15 },
      filename: "stress2-qp15.mp4",
    }, "stress2-qp15.mp4");
    results.push({ name: "2. Custom encoder QP=15", ok: true, outPath, size, ffprobe, elapsedMs: Date.now() - t0 });
  } catch (e) {
    results.push({ name: "2. Custom encoder QP=15", ok: false, error: String(e), elapsedMs: Date.now() - t0 });
  }
  await ctx.close();
}

// =========================================================================
// Test 3: Three back-to-back renders in one Playwright session
// =========================================================================
{
  const t0 = Date.now();
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error(`[pageerror] ${e.message}`));
  page.on("close", () => console.error("[page closed]"));
  page.on("crash", () => console.error("[page crashed]"));
  page.on("console", (m) => {
    if (m.text().startsWith("[__lr]")) console.log(`  [browser] ${m.text()}`);
  });
  const localResults: { name: string; size: number; ffprobe: string }[] = [];
  try {
    await page.goto(`${ORIGIN}/?forceMillions`, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(2000);
    for (const cfg of [
      { name: "3a-zoom2-720p", zoom: 2, resolution: "720p", hq: false },
      { name: "3b-zoom4-720p", zoom: 4, resolution: "720p", hq: false },
      { name: "3c-zoom3-1080p-hq", zoom: 3, resolution: "1080p", hq: true },
    ]) {
      const { outPath, size, ffprobe } = await runOneRender(page, {
        track: trackA, zoom: cfg.zoom, resolution: cfg.resolution, hq: cfg.hq,
        filename: cfg.name + ".mp4",
      }, cfg.name + ".mp4");
      localResults.push({ name: cfg.name, size, ffprobe });
      console.log(`  ${cfg.name} -> ${size} bytes / ${ffprobe}`);
    }
    const allDistinct = new Set(localResults.map((r) => r.size)).size === localResults.length;
    results.push({
      name: "3. Three back-to-back renders (one session)",
      ok: allDistinct,
      elapsedMs: Date.now() - t0,
      ffprobe: localResults.map((r) => `${r.name}=${r.size}`).join(" | "),
      error: allDistinct ? undefined : "outputs not all distinct — state didn't fully reset",
    });
  } catch (e) {
    results.push({ name: "3. Three back-to-back renders (one session)", ok: false, error: String(e), elapsedMs: Date.now() - t0 });
  }
  await ctx.close();
}

// =========================================================================
// Test 4: Track switch between renders (same session)
// =========================================================================
{
  const t0 = Date.now();
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error(`[pageerror] ${e.message}`));
  try {
    await page.goto(`${ORIGIN}/?forceMillions`, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(2000);
    const r1 = await runOneRender(page, { track: trackA, zoom: 3, resolution: "720p", hq: false, filename: "stress4-trackA.mp4" }, "stress4-trackA.mp4");
    const r2 = await runOneRender(page, { track: trackB, zoom: 3, resolution: "720p", hq: false, filename: "stress4-trackB.mp4" }, "stress4-trackB.mp4");
    console.log(`  trackA: ${r1.size} bytes / ${r1.ffprobe}`);
    console.log(`  trackB: ${r2.size} bytes / ${r2.ffprobe}`);
    const distinct = r1.size !== r2.size;
    results.push({
      name: "4. Track switch in same session",
      ok: distinct,
      ffprobe: `A=${r1.size} B=${r2.size}`,
      error: distinct ? undefined : "track switch produced identical outputs",
      elapsedMs: Date.now() - t0,
    });
  } catch (e) {
    results.push({ name: "4. Track switch in same session", ok: false, error: String(e), elapsedMs: Date.now() - t0 });
  }
  await ctx.close();
}

await browser.close();

// =========================================================================
// Summary
// =========================================================================
console.log("\n" + "=".repeat(70));
console.log("STRESS TEST SUMMARY");
console.log("=".repeat(70));
for (const r of results) {
  const status = r.ok ? "PASS" : "FAIL";
  console.log(`\n[${status}] ${r.name}  (${(r.elapsedMs / 1000).toFixed(1)}s)`);
  if (r.ffprobe) console.log(`       ${r.ffprobe}`);
  if (r.size !== undefined) console.log(`       size=${r.size} bytes`);
  if (r.error) console.log(`       error: ${r.error}`);
}
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
