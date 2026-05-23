/**
 * Extract a per-frame rider trajectory from the bundle (ground truth).
 *
 * Drives the local mirror via Playwright: load test.track.json, step the
 * player index frame by frame, dump `state.simulator.engine.engine.state.riders[0]`
 * to a JSON file.
 *
 * Output: shakedown/bundle-trajectory.json
 *   { frames: [{frame: 0, body: {...}, points: {NOSE: {x,y}, SHOULDER: {x,y}, ...}}, ...] }
 *
 * Frame selection (default): the same sample frames the lr-core smoke test
 * uses, so the two outputs are directly comparable.
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const ORIGIN = process.env.LR_ORIGIN ?? "http://127.0.0.1:8765";
const TRACK = process.argv[2] ?? "test.track.json";
const OUT = "shakedown/bundle-trajectory.json";
const FRAMES = [0, 1, 10, 30, 60, 100, 200, 300, 600, 900, 1200];

const track = JSON.parse(readFileSync(resolve(TRACK), "utf8"));
mkdirSync(resolve("shakedown"), { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error(`[pageerror] ${e.message}`));
page.on("console", (m) => { if (m.text().startsWith("[__lr]")) console.log(`[browser] ${m.text()}`); });

await page.goto(`${ORIGIN}/?forceMillions`, { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForTimeout(2000);

// Enter editor + load track via the helper we already built.
await page.evaluate(async (t) => {
  // deno-lint-ignore no-explicit-any
  const lr = (window as any).__lr;
  lr.enterEditor();
  await new Promise((r) => setTimeout(r, 600));
  lr.loadTrack(t);
  await new Promise((r) => setTimeout(r, 800));
}, track);

// Read rider position via window.Selectors.getSimulatorTrack().getRider(N) —
// the same call the bundle's camera follower uses (see unpacked/1054.js:87,
// unpacked/505.js:80). No player-state mutation; pure read at any frame.
const trajectory = await page.evaluate((frames) => {
  // deno-lint-ignore no-explicit-any
  const w = window as any;
  const Sel = w.Selectors;
  if (!Sel || typeof Sel.getSimulatorTrack !== "function") {
    return { error: "window.Selectors.getSimulatorTrack not available" };
  }
  const track = Sel.getSimulatorTrack();
  const out: Array<Record<string, unknown>> = [];
  // Point names — superset of what lr-core exposes and what the bundle
  // accepts via rider.get(name). Filter to ones actually present.
  const pointNames = [
    "NOSE", "SHOULDER", "BUTT", "BODY", "BODY_SLED_JOINT",
    "LFOOT", "RFOOT", "LHAND", "RHAND", "SLED_PEG", "TAIL",
    "LFOOT_NOSE", "BUTT_LFOOT", "BUTT_RFOOT",
  ];
  for (const f of frames) {
    const rider = track.getRider(f);
    const points: Record<string, { x: number; y: number }> = {};
    for (const name of pointNames) {
      const p = typeof rider.get === "function" ? rider.get(name) : null;
      if (p && p.pos && typeof p.pos.x === "number") {
        points[name] = { x: p.pos.x, y: p.pos.y };
      }
    }
    out.push({
      frame: f,
      position: rider.position ? { x: rider.position.x, y: rider.position.y } : null,
      velocity: rider.velocity ? { x: rider.velocity.x, y: rider.velocity.y } : null,
      points,
    });
  }
  return out;
}, FRAMES);

if (!Array.isArray(trajectory)) {
  console.error("trajectory extraction failed:", trajectory);
  await browser.close();
  process.exit(1);
}

console.log("\n=== rider trajectory (bundle) ===");
for (const f of trajectory as Array<Record<string, unknown>>) {
  console.log(JSON.stringify(f).slice(0, 220));
}

writeFileSync(OUT, JSON.stringify({ track: TRACK, frames: trajectory }, null, 2));
console.log(`\nwrote ${OUT}`);

await browser.close();
