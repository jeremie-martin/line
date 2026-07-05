/**
 * Track JSON → mp4. Drives the local linerider.com mirror via Playwright +
 * the `window.__lr` helper.
 *
 * Used as a library by `scripts/inspect.ts`; `scripts/export.ts` is a thin
 * CLI wrapper.
 *
 * Throws `MirrorUnreachableError` if the mirror origin doesn't respond — let
 * callers distinguish "server down, skip render" from "render itself failed".
 */
import { chromium, type Browser, type Page } from "playwright";
import { mkdirSync, writeFileSync, renameSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";

export type ExportOptions = {
  /** Parsed track JSON (already validated by caller). */
  trackJson: unknown;
  /** Absolute path for the mp4. */
  outPath: string;
  /** Mirror origin. */
  origin?: string;
  /** Linear playback zoom (UI level = log2). */
  zoom?: number;
  /** Optional per-frame zoom (indexed by simulator frame). When provided, it is
   *  installed as `window.getAutoZoom(frame)`, which the app's playback-camera
   *  selector honors per frame — overriding the static `zoom`. Used as the
   *  fallback when `zoomKeyframes` can't go through the native zoomer. Out-of-range
   *  indices clamp to the ends. */
  autoZoom?: number[];
  /** Preferred path: `[frameIndex, log2Zoom]` keyframes fed to the app's native
   *  `window.createZoomer(keyframes, smoothing)` — log2 interpolation + cosine
   *  smoothing, the engine's own camera tooling. Falls back to `autoZoom` if
   *  `window.createZoomer` is unavailable. */
  zoomKeyframes?: [number, number][];
  /** Smoothing window (frames) passed to `createZoomer`. */
  zoomSmoothing?: number;
  /** Video resolution. Preset strings or an explicit `{width,height}` (the mirror
   *  exporter renders Line Rider's vector art natively at any size — 1440p/2160p
   *  give genuinely sharper lines, not an upscale). */
  resolution?: "720p" | "1080p" | "1440p" | "2160p" | { width: number; height: number };
  /** High quality (QP=22 vs 28). */
  hq?: boolean;
  /** Encoder overrides forwarded to the app via `window.__lr.setEncoderSettings`,
   *  e.g. `{ quantizationParameter: 17 }`. Lower QP = higher quality; this is
   *  applied after `hq`, so it overrides hq's built-in QP. */
  encoderSettings?: Record<string, number>;
  /** Run browser visibly (debugging). */
  headed?: boolean;
  /** Optional progress-line printer (defaults to console.log). */
  log?: (msg: string) => void;
};

export class MirrorUnreachableError extends Error {
  constructor(public origin: string, cause: unknown) {
    super(`mirror origin unreachable: ${origin} (${String(cause)})`);
    this.name = "MirrorUnreachableError";
  }
}

function chromiumArgs(): string[] {
  const args = [
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    // Chromium 137+ requires this before it will fall back to SwiftShader WebGL.
    "--enable-unsafe-swiftshader",
  ];
  const extra = process.env.LR_CHROMIUM_ARGS?.trim();
  if (extra) args.push(...extra.split(/\s+/));
  return args;
}

export async function exportVideo(opts: ExportOptions): Promise<void> {
  const origin = opts.origin ?? "http://127.0.0.1:8765";
  const log = opts.log ?? ((m: string) => console.log(m));

  // helper.js's exportVideo understands "720p"/"1080p" presets and an explicit
  // {width,height} object (Custom preset). Map the higher presets to objects.
  const RES_OBJ: Record<string, { width: number; height: number }> = {
    "1440p": { width: 2560, height: 1440 },
    "2160p": { width: 3840, height: 2160 },
  };
  const resInput = opts.resolution ?? "720p";
  const resolutionArg =
    typeof resInput === "string" && resInput in RES_OBJ ? RES_OBJ[resInput] : resInput;

  mkdirSync(dirname(opts.outPath), { recursive: true });

  // Preflight: friendly error if mirror server is down.
  try {
    const r = await fetch(`${origin}/index.html`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  } catch (e) {
    throw new MirrorUnreachableError(origin, e);
  }

  const consoleBuf: string[] = [];
  const pageErrors: string[] = [];

  let browser: Browser | null = null;
  let page: Page | null = null;
  try {
    browser = await chromium.launch({ headless: !opts.headed, args: chromiumArgs() });
    const ctx = await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1280, height: 720 },
    });
    page = await ctx.newPage();

    page.on("pageerror", (e) => {
      const line = `[pageerror] ${e.message}`;
      pageErrors.push(line);
      console.error(line);
    });
    page.on("console", (m) => {
      const line = `[browser ${m.type()}] ${m.text()}`;
      consoleBuf.push(line);
      if (m.text().startsWith("[__lr]") || m.type() === "error") log(line);
    });

    await page.goto(`${origin}/?forceMillions`, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(2000);

    log("[node] launching exportVideo in page...");
    const blobUrl = await page.evaluate(
      async ({ track, zoom, resolution, hq, encoderSettings, autoZoom, zoomKeyframes, zoomSmoothing }) => {
        // deno-lint-ignore no-explicit-any
        const w = window as any;
        const lr = w.__lr;
        if (!lr) throw new Error("window.__lr not installed");
        // Install the per-frame zoom the app's playback camera reads
        // (getPlaybackZoom → window.getAutoZoom(index)). Prefer the engine's own
        // createZoomer (log2 interpolation + cosine smoothing); fall back to a
        // dense lookup; clear when nothing is supplied.
        if (zoomKeyframes && zoomKeyframes.length && typeof w.createZoomer === "function") {
          w.getAutoZoom = w.createZoomer(zoomKeyframes, zoomSmoothing ?? 20);
          console.log(`[__lr] zoom: createZoomer (${zoomKeyframes.length} keyframes, smoothing ${zoomSmoothing ?? 20})`);
        } else if (autoZoom && autoZoom.length) {
          const n = autoZoom.length;
          w.getAutoZoom = (i: number) => autoZoom[i < 0 ? 0 : i >= n ? n - 1 : (i | 0)];
          console.log(`[__lr] zoom: dense getAutoZoom (createZoomer ${w.createZoomer ? "unused" : "unavailable"})`);
        } else {
          delete w.getAutoZoom;
        }
        return await lr.exportVideo({ track, zoom, resolution, hq, encoderSettings: encoderSettings ?? undefined, download: false });
      },
      {
        track: opts.trackJson,
        zoom: opts.zoom,
        resolution: resolutionArg,
        hq: !!opts.hq,
        encoderSettings: opts.encoderSettings ?? null,
        autoZoom: opts.autoZoom ?? null,
        zoomKeyframes: opts.zoomKeyframes ?? null,
        zoomSmoothing: opts.zoomSmoothing ?? null,
      },
    );
    log(`[node] page-side render complete (blob: ${String(blobUrl).slice(0, 60)}...)`);

    const downloadPromise = page.waitForEvent("download", { timeout: 600_000 });
    await page.evaluate((url) => {
      // deno-lint-ignore no-explicit-any
      (window as any).__lr.triggerDownload(url, "lr-render.mp4");
    }, blobUrl);

    const download = await Promise.race([
      downloadPromise,
      new Promise<never>((_, rej) =>
        setTimeout(
          () =>
            rej(
              new Error(
                "render completed in-page but download event never fired (CSP, headless flag, or blob revoked too early)",
              ),
            ),
          15_000,
        ),
      ),
    ]);
    const tmpPath = `${opts.outPath}.tmp-${process.pid}-${Date.now()}`;
    try {
      await download.saveAs(tmpPath);
      renameSync(tmpPath, opts.outPath);
    } finally {
      rmSync(tmpPath, { force: true });
    }
    log(`saved ${opts.outPath}`);
  } catch (e) {
    if (page) {
      try {
        const dir = await dumpForensics(page, e, consoleBuf, pageErrors);
        console.error(`forensics dumped to: ${dir}`);
      } catch {
        // ignore secondary failures
      }
    }
    throw e;
  } finally {
    if (browser) await browser.close().catch(() => { /* already closed */ });
  }
}

async function dumpForensics(
  page: Page,
  err: unknown,
  consoleBuf: string[],
  pageErrors: string[],
): Promise<string> {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = resolve("shakedown/debug", ts);
  mkdirSync(dir, { recursive: true });
  try {
    await page.screenshot({ path: resolve(dir, "screenshot.png"), fullPage: false });
  } catch {
    // page closed
  }
  try {
    const state = await page.evaluate(() => {
      // deno-lint-ignore no-explicit-any
      const w = window as any;
      const s = w.store?.getState();
      return {
        url: location.href,
        views: s?.views ?? null,
        camera: s?.camera ?? null,
        trackData: s?.trackData
          ? { ...s.trackData, lines: undefined, linesArr: undefined }
          : null,
        videoExporterStatus: (function () {
          const root = document.querySelectorAll("*");
          for (let i = 0; i < root.length; i++) {
            const el = root[i];
            for (const k of Object.keys(el)) {
              if (k.startsWith("__react")) {
                // deno-lint-ignore no-explicit-any
                let f = (el as any)[k];
                let safety = 0;
                while (f?.return && safety++ < 500) f = f.return;
                const stack = [f];
                while (stack.length) {
                  const fi = stack.pop();
                  if (!fi) continue;
                  const n = fi.stateNode;
                  if (
                    n?.state &&
                    n?.props &&
                    typeof n.setState === "function" &&
                    "resolutionOption" in n.state &&
                    "resolutionWidth" in n.state
                  ) {
                    const canvas = n.canvas;
                    const webgl = (function () {
                      const c = document.createElement("canvas");
                      const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
                      if (!gl) return { ok: false };
                      const dbg = gl.getExtension && gl.getExtension("WEBGL_debug_renderer_info");
                      return {
                        ok: true,
                        vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
                        renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
                      };
                    })();
                    return {
                      status: n.state.status,
                      index: n.state.index,
                      hq: n.state.hq,
                      hardwareAcceleration: n.props?.hardwareAcceleration,
                      canvasMounted: !!canvas,
                      canvasSize: canvas ? { width: canvas.width, height: canvas.height } : null,
                      webgl,
                    };
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
  } catch {
    // page may be closed
  }
  writeFileSync(resolve(dir, "console.log"), consoleBuf.join("\n"));
  writeFileSync(resolve(dir, "page-errors.log"), pageErrors.join("\n"));
  writeFileSync(resolve(dir, "error.txt"), `${err}\n\n${(err as Error)?.stack ?? ""}`);
  return dir;
}
