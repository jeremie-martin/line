/**
 * Export a Line Rider track to mp4 via the local mirror + window.__lr helper.
 *
 * Examples:
 *   npx tsx scripts/export.ts --track=test.track.json --zoom=3 --1080p --hq
 *   npx tsx scripts/export.ts --track=test.track.json --out=shakedown/out.mp4
 */
import { chromium, type Browser, type Page } from "playwright";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
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
if (zoom !== undefined && !Number.isFinite(zoom)) {
  console.error(`--zoom must be a number (got: ${arg("zoom")})`);
  process.exit(1);
}
const trackJson = JSON.parse(readFileSync(trackPath, "utf8"));
mkdirSync(dirname(outPath), { recursive: true });

console.log(
  `track=${trackPath} (${trackJson.lines?.length} lines, duration=${trackJson.duration})\n` +
  `resolution=${resolution}${hq ? " HQ" : ""} zoom=${zoom ?? "default"}\n` +
  `origin=${origin}\nout=${outPath}`,
);

// C3-ish: preflight the origin so the user gets "the mirror server isn't
// running" instead of a raw chromium net::ERR_CONNECTION_REFUSED.
try {
  const r = await fetch(`${origin}/index.html`, { signal: AbortSignal.timeout(3000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
} catch (e) {
  console.error(`\nERROR: cannot reach ${origin} — ${String(e)}`);
  console.error(`hint: run \`python3 -m http.server 8765 --bind 127.0.0.1\` from the mirror/ directory.`);
  process.exit(2);
}

// C4: forensics buffer (console + page errors) collected for the whole run,
// dumped on failure under shakedown/debug/<timestamp>/.
const consoleBuf: string[] = [];
const pageErrors: string[] = [];

async function dumpForensics(page: Page, err: unknown): Promise<string> {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = resolve("shakedown/debug", ts);
  mkdirSync(dir, { recursive: true });
  try { await page.screenshot({ path: resolve(dir, "screenshot.png"), fullPage: false }); } catch { /* page closed */ }
  try {
    const state = await page.evaluate(() => {
      // deno-lint-ignore no-explicit-any
      const w = window as any;
      const s = w.store?.getState();
      const inst = w.__lr?.getState ? null : null; // placeholder
      return {
        url: location.href,
        views: s?.views ?? null,
        camera: s?.camera ?? null,
        trackData: s?.trackData ? { ...s.trackData, lines: undefined, linesArr: undefined } : null,
        videoExporterStatus: (function () {
          // Inline fiber walk to find VideoExporter state
          const root = document.querySelectorAll("*");
          for (let i = 0; i < root.length; i++) {
            const el = root[i];
            for (const k of Object.keys(el)) {
              if (k.startsWith("__react")) {
                let f = (el as any)[k];
                let safety = 0; while (f?.return && safety++ < 500) f = f.return;
                const stack = [f]; while (stack.length) {
                  const fi = stack.pop(); if (!fi) continue;
                  const n = fi.stateNode;
                  if (n?.state && n?.props && typeof n.setState === "function" &&
                      "resolutionOption" in n.state && "resolutionWidth" in n.state) {
                    return { status: n.state.status, index: n.state.index, hq: n.state.hq };
                  }
                  if (fi.child) stack.push(fi.child);
                  if (fi.sibling) stack.push(fi.sibling);
                }
                return null;
              }
            }
          }
          return null;
        })(),
      };
    });
    writeFileSync(resolve(dir, "state.json"), JSON.stringify(state, null, 2));
  } catch { /* page may be closed */ }
  writeFileSync(resolve(dir, "console.log"), consoleBuf.join("\n"));
  writeFileSync(resolve(dir, "page-errors.log"), pageErrors.join("\n"));
  writeFileSync(resolve(dir, "error.txt"), `${err}\n\n${(err as Error)?.stack ?? ""}`);
  return dir;
}

// C1: wrap browser lifecycle so any failure (preflight passed but page goto
// fails, evaluate throws, download is suppressed, etc.) still cleans up the
// chromium subprocess instead of leaving a 300 MB orphan.
let browser: Browser | null = null;
let page: Page | null = null;
try {
  browser = await chromium.launch({ headless: !headed });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 720 } });
  page = await ctx.newPage();

  page.on("pageerror", (e) => {
    const line = `[pageerror] ${e.message}`;
    pageErrors.push(line);
    console.error(line);
  });
  page.on("console", (m) => {
    const line = `[browser ${m.type()}] ${m.text()}`;
    consoleBuf.push(line);
    if (m.text().startsWith("[__lr]") || m.type() === "error") console.log(line);
  });

  await page.goto(`${origin}/?forceMillions`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(2000);

  // C2: separate "render finished in the page" from "download was captured".
  // page.evaluate(exportVideo) only resolves *after* triggerDownload fires
  // inside the page, so by the time it returns the click already happened.
  // A second waitForEvent after evaluate resolves with a shorter window lets
  // us distinguish "render hung" (evaluate timed out) from "render OK but
  // download suppressed" (download didn't fire after the click).
  const downloadPromise = page.waitForEvent("download", { timeout: 600_000 });

  console.log("[node] launching exportVideo in page...");
  const blobUrl = await page.evaluate(
    async ({ track, zoom, resolution, hq }) => {
      // deno-lint-ignore no-explicit-any
      const lr = (window as any).__lr;
      if (!lr) throw new Error("window.__lr not installed");
      return await lr.exportVideo({ track, zoom, resolution, hq, filename: "lr-render.mp4" });
    },
    { track: trackJson, zoom, resolution, hq },
  );
  console.log(`[node] page-side render complete (blob: ${blobUrl?.slice(0, 60)}...)`);

  // Download click already fired inside the page (triggerDownload). Short
  // window now — anything longer than 15s here means the click didn't take.
  const download = await Promise.race([
    downloadPromise,
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error(
        "render completed in-page but download event never fired (CSP, headless flag, or blob revoked too early)"
      )), 15_000)
    ),
  ]);
  await download.saveAs(outPath);
  console.log(`saved ${outPath}`);
} catch (e) {
  const dir = page ? await dumpForensics(page, e) : null;
  console.error(`\nERROR: ${String(e)}`);
  if (dir) console.error(`forensics dumped to: ${dir}`);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => { /* already closed */ });
}
