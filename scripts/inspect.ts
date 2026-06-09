/**
 * Detect events on a track and (optionally) render its mp4, into a single
 * self-contained run directory ready for the dashboard.
 *
 *   npx tsx scripts/inspect.ts --track=path/to/anything.track.json
 *   npx tsx scripts/inspect.ts --track=foo.track.json --out=shakedown/foo --render
 *
 * Layout written to `shakedown/<name>/`:
 *   - detection.json   {measurements, events, terminus, params, meta}
 *   - track.json       copy of input track
 *   - video.mp4        rendered (auto if missing OR --render forced; otherwise
 *                      kept from a prior run)
 *   - video_with_audio.mp4 optional muxed media preferred by the dashboard
 *
 * Plus `shakedown/runs.json` — dashboard landing-page index.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, basename, dirname } from "node:path";
import {
  detect,
  extractRawTrajectory,
  DEFAULT_PARAMS,
} from "./lib/detector.ts";
import { exportVideo, MirrorUnreachableError } from "./lib/export.ts";
import { CALIB, IMPACT_WINDOW } from "./v0/types.ts";
import { redirImpactPxAtLanding } from "./v0/core/substrate.ts";

const argv = process.argv.slice(2);
const arg = (name: string): string | null => {
  const m = argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.slice(name.length + 3) : null;
};
const has = (name: string) => argv.includes(`--${name}`);

const trackPath = arg("track");
if (!trackPath || !existsSync(trackPath)) {
  console.error(`pass --track=path/to/track.json (got: ${trackPath})`);
  process.exit(1);
}

const runName = arg("name") ?? basename(trackPath).replace(/\.track\.json$|\.json$/i, "");
const outDir = resolve(arg("out") ?? `shakedown/${runName}`);
const origin = arg("origin") ?? "http://127.0.0.1:8765";
const forceRender = has("render");
const skipRender = has("no-render");
const headed = has("headed");
const resolution = has("1080p") ? "1080p" : "720p";
const hq = has("hq");
// Default zoom=3 (well-framed for typical generated tracks). Override with:
//   --zoom=N        static zoom
//   --zoom=action   auto-frame: zoom OUT when there is big vertical action
//                   (jumps/drops), zoom IN when the path is flat — regardless of
//                   speed. This is the "frame whatever is happening" camera.
//   --zoom=speed    legacy: zoom by forward pace (fast ⇒ out). Looks odd on
//                   fast-but-flat stretches; kept for comparison.
// Tunable: append :IN,OUT,SMOOTH (e.g. --zoom=action:3.4,1.9,30):
//   IN     zoom when calm/flat (larger = more zoomed in)
//   OUT    zoom when busy/big-air (smaller = more zoomed out)
//   SMOOTH smoothing window in frames (larger = calmer camera)
const zoomArg = arg("zoom");
const zoomMode: "static" | "action" | "speed" =
  zoomArg?.startsWith("action") ? "action" : zoomArg?.startsWith("speed") ? "speed" : "static";
const zoomCfg = zoomMode === "speed"
  ? { zoomIn: 3.2, zoomOut: 2.0, smoothFrames: 35 }
  : { zoomIn: 3.4, zoomOut: 1.9, smoothFrames: 30 };
if (zoomMode !== "static" && zoomArg!.includes(":")) {
  const [inS, outS, smS] = zoomArg!.slice(zoomArg!.indexOf(":") + 1).split(",");
  if (inS) zoomCfg.zoomIn = parseFloat(inS);
  if (outS) zoomCfg.zoomOut = parseFloat(outS);
  if (smS) zoomCfg.smoothFrames = parseInt(smS, 10);
}
const zoom = zoomMode !== "static" ? 3 : zoomArg !== null ? parseFloat(zoomArg) : 3;

/** Local vertical extent of the path: max−min of y over a ±halfWin window. This
 *  is the "how much is happening" signal — big over jumps/drops, ~0 on flat. */
function localYExtent(y: number[], halfWin: number): number[] {
  const n = y.length;
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let lo = Infinity, hi = -Infinity;
    for (let j = Math.max(0, i - halfWin); j <= Math.min(n - 1, i + halfWin); j++) {
      if (y[j] < lo) lo = y[j];
      if (y[j] > hi) hi = y[j];
    }
    out[i] = hi - lo;
  }
  return out;
}

// signal → per-frame zoom: smooth, normalize on a robust p10–p90 range, map
// low⇒zoomIn / high⇒zoomOut, then slew-limit so the camera eases rather than snaps.
function signalToAutoZoom(
  signal: number[],
  { zoomIn = 3.4, zoomOut = 1.9, smoothFrames = 30, maxSlewPerFrame = 0.012 } = {},
): number[] {
  const n = signal.length;
  if (n === 0) return [];
  const sm = new Array<number>(n);
  const h = Math.max(1, Math.floor(smoothFrames / 2));
  for (let i = 0; i < n; i++) {
    let sum = 0, c = 0;
    for (let j = Math.max(0, i - h); j <= Math.min(n - 1, i + h); j++) { sum += signal[j]; c++; }
    sm[i] = sum / c;
  }
  const sorted = [...sm].sort((a, b) => a - b);
  const pct = (p: number) => sorted[Math.min(n - 1, Math.max(0, Math.floor(p * (n - 1))))];
  const lo = pct(0.1), hi = pct(0.9);
  const span = hi - lo > 1e-6 ? hi - lo : 1;
  const raw = sm.map((v) => {
    const t = Math.min(1, Math.max(0, (v - lo) / span)); // 0 calm … 1 busy
    return zoomIn * Math.pow(zoomOut / zoomIn, t); // log2 / geometric interpolation (perceptually even)
  });
  const out = new Array<number>(n);
  out[0] = raw[0];
  for (let i = 1; i < n; i++) {
    const d = raw[i] - out[i - 1];
    out[i] = out[i - 1] + Math.max(-maxSlewPerFrame, Math.min(maxSlewPerFrame, d));
  }
  return out;
}

mkdirSync(outDir, { recursive: true });

function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function readJsonHash(path: string): string | null {
  if (!existsSync(path)) return null;
  try {
    return hashJson(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return null;
  }
}

function removeIfExists(path: string, reason: string): void {
  if (!existsSync(path)) return;
  rmSync(path, { force: true });
  console.log(`removed stale ${path} (${reason})`);
}

// ── 1. Load track, build lr-core engine ──────────────────────────────────
const trackJson = JSON.parse(readFileSync(trackPath, "utf8"));
const currentTrackHash = hashJson(trackJson);
const duration: number = trackJson.duration ?? 1200;
const siblingReportPath = trackPath.replace(/\.track\.json$/i, ".report.json");
const reportPath = siblingReportPath !== trackPath && existsSync(siblingReportPath)
  ? siblingReportPath
  : null;
console.log(`track=${trackPath} (${trackJson.lines?.length ?? 0} lines, duration=${duration} frames)`);
console.log(`run=${runName}, out=${outDir}`);

// deno-lint-ignore no-explicit-any
const lrCore: any = await import("lr-core/line-rider-engine/index.js");
const LineRiderEngine = lrCore.default;
const { createLineFromJson } = lrCore;

type Vec2 = { x: number; y: number };
const DEFAULT_START_POSITION: Vec2 = { x: 0, y: 0 };
const DEFAULT_START_VELOCITY: Vec2 = { x: 0.4, y: 0 };

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function trackStartState(track: any): { position: Vec2; velocity: Vec2 } {
  const rider = Array.isArray(track.riders) ? track.riders[0] : null;
  const rawPosition = rider?.startPosition ?? track.startPosition ?? DEFAULT_START_POSITION;
  const rawVelocity = rider?.startVelocity ?? DEFAULT_START_VELOCITY;
  return {
    position: {
      x: finiteNumber(rawPosition?.x, DEFAULT_START_POSITION.x),
      y: finiteNumber(rawPosition?.y, DEFAULT_START_POSITION.y),
    },
    velocity: {
      x: finiteNumber(rawVelocity?.x, DEFAULT_START_VELOCITY.x),
      y: finiteNumber(rawVelocity?.y, DEFAULT_START_VELOCITY.y),
    },
  };
}

// deno-lint-ignore no-explicit-any
const start = trackStartState(trackJson);
console.log(
  `start: pos=(${start.position.x.toFixed(3)}, ${start.position.y.toFixed(3)}) ` +
    `vel=(${start.velocity.x.toFixed(3)}, ${start.velocity.y.toFixed(3)})`,
);

// deno-lint-ignore no-explicit-any
let engine: any = new LineRiderEngine().setStart(start.position, start.velocity);
for (const line of trackJson.lines ?? []) {
  engine = engine.addLine(createLineFromJson(line));
}

// ── 2. Run detector ──────────────────────────────────────────────────────
console.time("extract");
const raw = extractRawTrajectory(engine, duration);
console.timeEnd("extract");
console.time("detect");
const det = detect(raw);
console.timeEnd("detect");

// Attach MEASURED landing impact to each landing event so the dashboard can show
// per-beat intensity. Uses the shared redirImpactPxAtLanding (same definition as the
// scored core/measure.ts measureImpact) — velocity REDIRECTION over the impact
// window, normalized by CALIB.REDIR_CAP → [0,1]. CoM-only: no line resolver needed.
{
  let n = 0, sum = 0;
  for (const e of det.events) {
    if (e.type !== "landing") continue;
    const px = redirImpactPxAtLanding(det, e.frame, IMPACT_WINDOW);
    if (px === undefined) continue;
    const impact = Math.min(1, px / CALIB.REDIR_CAP);
    (e as { impact?: number }).impact = Math.round(impact * 1000) / 1000;
    n++; sum += impact;
  }
  if (n > 0) console.log(`impact: ${n} landings, mean ${(sum / n).toFixed(3)} (redirection / ${CALIB.REDIR_CAP}px·f⁻¹)`);
}

const byType = det.events.reduce<Record<string, number>>((acc, e) => {
  acc[e.type] = (acc[e.type] ?? 0) + 1;
  return acc;
}, {});
console.log(
  `events: ${det.events.length} ` +
    `(landing=${byType.landing ?? 0}, bounce=${byType.bounce ?? 0}, ` +
    `kick=${byType.kick ?? 0}, flyThrough=${byType.flyThrough ?? 0})`,
);
console.log(`terminus: ${det.terminus.reason} @ frame ${det.terminus.frame}`);
const s = det.summary;
console.log(
  `sliding: ${(s.contactFractionSpec * 100).toFixed(1)}% of spec ` +
    `(${(s.contactFractionLive * 100).toFixed(1)}% of live) · ` +
    `longest slide ${s.longestContactRun}f (${(s.longestContactRun / 40).toFixed(2)}s) · ` +
    `${s.slideSegments.length} slide segments`,
);
console.log(
  `mean vx:  sliding ${s.meanVxSliding.toFixed(2)} · airborne ${s.meanVxAirborne.toFixed(2)}  |  ` +
    `mean |v|: sliding ${s.meanSpeedSliding.toFixed(2)} · airborne ${s.meanSpeedAirborne.toFixed(2)}`,
);

// ── 3. Write detection + track copy ──────────────────────────────────────
const detectionPath = resolve(outDir, "detection.json");
const trackCopyPath = resolve(outDir, "track.json");
const videoPath = resolve(outDir, "video.mp4");
const muxedVideoPath = resolve(outDir, "video_with_audio.mp4");
const previousTrackHash = readJsonHash(trackCopyPath);
const trackChanged = previousTrackHash !== null && previousTrackHash !== currentTrackHash;
if (trackChanged) {
  removeIfExists(videoPath, "track changed");
  removeIfExists(muxedVideoPath, "track changed");
} else if (!skipRender && forceRender) {
  removeIfExists(muxedVideoPath, "fresh render requested");
}
const generatedAt = new Date().toISOString();
writeFileSync(
  detectionPath,
  JSON.stringify(
    {
      meta: {
        track: trackPath,
        ...(reportPath ? { report: reportPath } : {}),
        run: runName,
        duration,
        fps: 40,
        generatedAt,
        trackHash: currentTrackHash,
      },
      ...det,
    },
    null,
    2,
  ),
);
console.log(`wrote ${detectionPath}`);

writeFileSync(trackCopyPath, JSON.stringify(trackJson, null, 2));

// ── 4. Render mp4 (auto if missing, or forced) ───────────────────────────
let videoRendered = false;
const haveVideo = existsSync(videoPath);

if (skipRender) {
  console.log("skip-render: --no-render");
} else if (haveVideo && !forceRender) {
  console.log(`video.mp4 already present — keeping (pass --render to overwrite)`);
} else {
  try {
    let autoZoom: number[] | undefined;
    if (zoomMode === "action") {
      const ys = (det.measurements.position as { x: number; y: number }[]).map((p) => p.y);
      autoZoom = signalToAutoZoom(localYExtent(ys, 50), zoomCfg); // ±50f ≈ ±1.25s
    } else if (zoomMode === "speed") {
      const vx = (det.measurements.velocity as { x: number; y: number }[]).map((v) => Math.abs(v.x));
      autoZoom = signalToAutoZoom(vx, zoomCfg);
    }
    // Downsample to log2 keyframes for the engine's native createZoomer (the dense
    // array is the fallback if createZoomer isn't present). Already smoothed above,
    // so createZoomer just log2-interpolates (zoomSmoothing: 0).
    let zoomKeyframes: [number, number][] | undefined;
    if (autoZoom) {
      const STEP = 8; // a keyframe every 8 frames (0.2s)
      zoomKeyframes = [];
      for (let i = 0; i < autoZoom.length; i += STEP) zoomKeyframes.push([i, Math.log2(autoZoom[i])]);
      const last = autoZoom.length - 1;
      if (zoomKeyframes[zoomKeyframes.length - 1]?.[0] !== last) zoomKeyframes.push([last, Math.log2(autoZoom[last])]);
      const zs = [...autoZoom].sort((a, b) => a - b);
      console.log(
        `rendering video.mp4 via mirror at ${origin}... (${zoomMode}-zoom ` +
          `${zs[0].toFixed(2)}–${zs[zs.length - 1].toFixed(2)}× via createZoomer)`,
      );
    } else {
      console.log(`rendering video.mp4 via mirror at ${origin}...`);
    }
    await exportVideo({
      trackJson,
      outPath: videoPath,
      origin,
      zoom,
      autoZoom,
      zoomKeyframes,
      zoomSmoothing: 0,
      resolution,
      hq,
      headed,
    });
    videoRendered = true;
  } catch (e) {
    if (e instanceof MirrorUnreachableError) {
      console.warn(`WARN: mirror unreachable at ${origin} — skipping render.`);
      console.warn(`      detector output is still usable; start the mirror and re-run --render to get video.`);
    } else {
      console.error(`render failed: ${String(e)}`);
      process.exitCode = 1;
    }
  }
}

// ── 5. Update shakedown/runs.json (dashboard landing-page index) ─────────
const runsIndexPath = resolve(dirname(outDir), "runs.json");
type RunEntry = {
  name: string;
  track: string;
  updatedAt: string;
  duration: number;
  hasVideo: boolean;
  eventCount: number;
};
let runs: RunEntry[] = [];
if (existsSync(runsIndexPath)) {
  try {
    const parsed = JSON.parse(readFileSync(runsIndexPath, "utf8"));
    if (Array.isArray(parsed)) runs = parsed;
  } catch {
    runs = [];
  }
}
runs = runs.filter((r) => r.name !== runName);
runs.unshift({
  name: runName,
  track: trackPath,
  updatedAt: new Date().toISOString(),
  duration,
  hasVideo: existsSync(videoPath) || existsSync(muxedVideoPath),
  eventCount: det.events.length,
});
writeFileSync(runsIndexPath, JSON.stringify(runs, null, 2));

// ── 6. Print dashboard URL ───────────────────────────────────────────────
const dashUrl = `http://127.0.0.1:8767/dashboard/?run=${encodeURIComponent(runName)}`;
console.log(`\nDashboard → ${dashUrl}`);
console.log(`(run \`npm run dash\` from project root if not already serving)`);

if (!videoRendered && !existsSync(videoPath) && !existsSync(muxedVideoPath)) {
  console.log(`(video.mp4 missing; the dashboard will show plots only until you re-run with --render)`);
}

// Suppress noisy "default params" line unless they were customized.
void DEFAULT_PARAMS;
