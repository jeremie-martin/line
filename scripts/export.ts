/**
 * End-to-end: load track from file → set zoom (optional) → click Video Export → capture mp4.
 *
 * Run examples:
 *   npm run export -- --track=test.track.json --1080p --hq --zoom=2
 *   npx tsx scripts/export.ts --track=test.track.json --1080p --hq --zoom=2
 */
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const OUT_DIR = resolve("shakedown");
mkdirSync(OUT_DIR, { recursive: true });

const argv = process.argv.slice(2);
const arg = (name: string) => {
  const m = argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.slice(name.length + 3) : null;
};
const has = (name: string) => argv.includes(`--${name}`);

const headed = has("headed");
const want1080 = has("1080p");
const wantHQ = has("hq");
const zoomArg = arg("zoom");
const targetZoom = zoomArg ? parseFloat(zoomArg) : null;
const trackPath = arg("track");
const outName = arg("out") ?? "out.mp4";
const origin = arg("origin") ?? "https://www.linerider.com";

const HARDCODED_TRACK = {
  version: "6.2", label: "shakedown", creator: "automation",
  description: "minimal", duration: 240,
  startPosition: { x: 0, y: 0 },
  riders: [{ startPosition: { x: 0, y: 0 }, startVelocity: { x: 0.4, y: 0 }, remountable: 1 }],
  lines: [{ id: 0, type: 0, x1: -20, y1: 20, x2: 400, y2: 200 }],
};

const trackJson = trackPath && existsSync(trackPath)
  ? JSON.parse(readFileSync(trackPath, "utf8"))
  : HARDCODED_TRACK;

console.log(`track: ${trackPath ?? "(hardcoded)"}, lines=${trackJson.lines?.length}, duration=${trackJson.duration}`);
console.log(`resolution: ${want1080 ? "1080p" : "720p"}${wantHQ ? " + HQ" : ""}, zoom=${targetZoom ?? "default"}`);

const browser = await chromium.launch({ headless: !headed });
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

const consoleLines: string[] = [];
page.on("console", (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => consoleLines.push(`[pageerror] ${err.message}`));

const downloads: { url: string; name: string; savedTo: string }[] = [];
page.on("download", async (dl) => {
  const savedTo = resolve(OUT_DIR, outName);
  await dl.saveAs(savedTo);
  downloads.push({ url: dl.url(), name: dl.suggestedFilename(), savedTo });
  console.log("download saved:", savedTo);
});

console.log("navigating...");
const startUrl = `${origin}/?forceMillions`;
console.log(`origin: ${startUrl}`);
await page.goto(startUrl, { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForTimeout(2000);

await page.locator("text=/^\\s*PLAY\\s*$/i").first().click({ timeout: 10_000 });
await page.waitForTimeout(3000);

// Instrument dispatch BEFORE loading track so we capture every action.
await page.evaluate(() => {
  // deno-lint-ignore no-explicit-any
  const w = window as any;
  if (!w.__dispatchLog) w.__dispatchLog = [];
  if (!w.__origDispatch) {
    w.__origDispatch = w.store.dispatch;
    w.store.dispatch = (action: unknown) => {
      try {
        // deno-lint-ignore no-explicit-any
        const a = action as any;
        const summary = { type: a?.type ?? typeof a, keys: a && typeof a === "object" ? Object.keys(a) : [] };
        w.__dispatchLog.push(summary);
      } catch { /* ignore */ }
      return w.__origDispatch(action);
    };
  }
});

console.log("loading track...");
const loadResult = await page.evaluate((trackJson) => {
  // deno-lint-ignore no-explicit-any
  const w = window as any;
  try {
    w.loadTrackFromString(JSON.stringify(trackJson));
    const state = w.store.getState();
    return {
      ok: true,
      lineCountTrackData: state.trackData?.lines?.length ?? null,
      cameraBefore: state.camera,
    };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}, trackJson);
console.log("load:", JSON.stringify({ ok: loadResult.ok, lineCount: loadResult.lineCountTrackData, lineCountFromFile: trackJson.lines?.length }));
await page.waitForTimeout(1500);

if (targetZoom !== null) {
  const zoomResult = await page.evaluate(function (target) {
    // deno-lint-ignore no-explicit-any
    const w = window as any;
    const before = w.store.getState().camera;
    w.store.dispatch({ type: "SET_PLAYBACK_ZOOM", payload: target });
    const after = w.store.getState().camera;
    return {
      before: { playbackZoom: before.playbackZoom, editorZoom: before.editorZoom },
      after: { playbackZoom: after.playbackZoom, editorZoom: after.editorZoom },
    };
  }, targetZoom);
  console.log(`zoom: ${JSON.stringify(zoomResult)}`);
}

await page.screenshot({ path: resolve(OUT_DIR, "export-1-loaded.png"), fullPage: false });

// Open Video Export sidebar
await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll("button"));
  for (const btn of buttons) {
    const d = btn.querySelector("path")?.getAttribute("d") ?? "";
    if (d.startsWith("M17,10.5V7C17,6.45")) { (btn as HTMLButtonElement).click(); return; }
  }
});
await page.waitForTimeout(2000);

// Apply resolution + HQ
await page.evaluate(({ want1080, wantHQ }) => {
  const labels = Array.from(document.querySelectorAll("label, span, p, div"));
  if (want1080) {
    for (const el of labels) {
      if ((el.textContent || "").trim() === "1080p") { (el as HTMLElement).click(); break; }
    }
  }
  if (wantHQ) {
    let switchEl: HTMLInputElement | null = null;
    for (const el of labels) {
      if ((el.textContent || "").trim() === "High Quality") {
        let row: Element | null = el;
        for (let i = 0; i < 5 && row; i++) {
          const input = row.querySelector("input[type=checkbox]") as HTMLInputElement | null;
          if (input) { switchEl = input; break; }
          row = row.parentElement;
        }
        break;
      }
    }
    if (switchEl && !switchEl.checked) switchEl.click();
  }
}, { want1080, wantHQ });
await page.waitForTimeout(1000);
await page.screenshot({ path: resolve(OUT_DIR, "export-2-modal.png"), fullPage: false });

// Click RENDER
const rendered = await page.evaluate(() => {
  for (const el of Array.from(document.querySelectorAll("button, [role=button]"))) {
    if ((el.textContent || "").trim().toUpperCase() === "RENDER") {
      (el as HTMLElement).click();
      return true;
    }
  }
  return false;
});
console.log("render clicked:", rendered);

if (rendered) {
  // Real-time render: track duration + generous slack.
  const durSec = (trackJson.duration ?? 240) / 40;
  const waitMs = Math.max(60_000, Math.ceil(durSec * 3 + 60) * 1000);
  console.log(`waiting up to ${(waitMs / 1000) | 0}s for render (track duration ${durSec.toFixed(1)}s)...`);
  let saved = false;
  const startedAt = Date.now();
  let lastReport = 0;
  while (Date.now() - startedAt < waitMs) {
    await page.waitForTimeout(2000);
    const elapsed = ((Date.now() - startedAt) / 1000) | 0;
    if (elapsed - lastReport >= 10) {
      lastReport = elapsed;
      console.log(`  ...${elapsed}s elapsed`);
    }
    const sc = await page.evaluate(() => {
      for (const el of Array.from(document.querySelectorAll("button, [role=button]"))) {
        const t = (el.textContent || "").trim().toUpperCase();
        if (t === "SAVE" || t === "DOWNLOAD") {
          const btn = el as HTMLButtonElement;
          const r = btn.getBoundingClientRect();
          if (r.width > 0 && !btn.disabled) {
            btn.click();
            return true;
          }
        }
      }
      return false;
    });
    if (sc) { saved = true; break; }
  }
  console.log("save clicked:", saved);
  await page.waitForTimeout(10_000);
}

// Dump dispatched actions so we can mine them for zoom hints later
const dispatchLog = await page.evaluate(() => {
  // deno-lint-ignore no-explicit-any
  const w = window as any;
  return (w.__dispatchLog ?? []).slice(-200);
});
writeFileSync(resolve(OUT_DIR, "dispatch-log.json"), JSON.stringify(dispatchLog, null, 2));
writeFileSync(resolve(OUT_DIR, "export-console.log"), consoleLines.join("\n"));

await browser.close();
console.log(`\ndownloads:`, JSON.stringify(downloads, null, 2));
