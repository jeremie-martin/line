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
import { IMPACT_WINDOW, normImpact, type Spec } from "./v0/types.ts";
import { contactRedirArcPxAtLanding } from "./v0/core/substrate.ts";
import {
  cameraSidecarToRenderPlan,
  specZoomLaneToRenderPlan,
  siblingCameraPath,
  type CameraSidecar,
  type RenderZoomPlan,
} from "./v0/core/camera.ts";

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
//   --zoom=N          static zoom
//   --zoom=action     authored spec camera zoom (alias: --zoom=spec). Reads
//                     --spec=<path.ts> or sibling <track>.camera.json.
//   --zoom=trajectory legacy realized-path auto-frame: zoom OUT when there is
//                     big vertical action, IN when flat.
//   --zoom=speed      legacy: zoom by forward pace (fast ⇒ out). Looks odd on
//                     fast-but-flat stretches; kept for comparison.
// Tunable for trajectory/speed: append :IN,OUT,SMOOTH (e.g. --zoom=trajectory:3.4,1.9,30):
//   IN     zoom when calm/flat (larger = more zoomed in)
//   OUT    zoom when busy/big-air (smaller = more zoomed out)
//   SMOOTH smoothing window in frames (larger = calmer camera)
const zoomArg = arg("zoom");
const zoomMode: "static" | "spec" | "trajectory" | "speed" =
  zoomArg?.startsWith("action") || zoomArg?.startsWith("spec")
    ? "spec"
    : zoomArg?.startsWith("trajectory")
      ? "trajectory"
      : zoomArg?.startsWith("speed")
        ? "speed"
        : "static";
const zoomCfg = zoomMode === "speed"
  ? { zoomIn: 3.2, zoomOut: 2.0, smoothFrames: 35 }
  : { zoomIn: 3.4, zoomOut: 1.9, smoothFrames: 30 };
if ((zoomMode === "trajectory" || zoomMode === "speed") && zoomArg!.includes(":")) {
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

function downsampleAutoZoom(autoZoom: number[], step = 8): [number, number][] {
  const zoomKeyframes: [number, number][] = [];
  for (let i = 0; i < autoZoom.length; i += step) {
    zoomKeyframes.push([i, Math.log2(autoZoom[i])]);
  }
  const last = autoZoom.length - 1;
  if (last >= 0 && zoomKeyframes[zoomKeyframes.length - 1]?.[0] !== last) {
    zoomKeyframes.push([last, Math.log2(autoZoom[last])]);
  }
  return zoomKeyframes;
}

function zoomRange(autoZoom: number[]): string {
  const sorted = [...autoZoom].sort((a, b) => a - b);
  return `${sorted[0].toFixed(2)}-${sorted[sorted.length - 1].toFixed(2)}x`;
}

async function loadSpecZoomPlan(trackPath: string): Promise<{ plan: RenderZoomPlan | null; source: string | null }> {
  const specPath = arg("spec");
  if (specPath !== null) {
    if (!existsSync(specPath)) throw new Error(`--spec path not found: ${specPath}`);
    const mod = await import(resolve(specPath));
    const spec: Spec | undefined = mod.default;
    if (!spec) throw new Error(`spec module at ${specPath} did not default-export a Spec`);
    return {
      plan: specZoomLaneToRenderPlan(spec.camera?.zoom, spec.duration),
      source: specPath,
    };
  }

  const cameraPath = arg("camera") ?? siblingCameraPath(trackPath);
  if (!existsSync(cameraPath)) return { plan: null, source: null };
  const sidecar = JSON.parse(readFileSync(cameraPath, "utf8")) as CameraSidecar;
  return {
    plan: cameraSidecarToRenderPlan(sidecar),
    source: cameraPath,
  };
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
// per-beat intensity. Uses the shared contactRedirArcPxAtLanding (same definition as
// the scored core/measure.ts measureImpact) — the accumulated redirection impulse
// Σ v̄·|Δθ| over contacted frames of the impact window, mapped to felt [0,1] by
// normImpact (0=soft, 1=very strong). CoM-only: no resolver.
{
  let n = 0, sum = 0;
  for (const e of det.events) {
    if (e.type !== "landing") continue;
    const px = contactRedirArcPxAtLanding(det, e.frame, IMPACT_WINDOW);
    if (px === undefined) continue;
    const impact = normImpact(px);
    (e as { impact?: number }).impact = Math.round(impact * 1000) / 1000;
    n++; sum += impact;
  }
  if (n > 0) console.log(`impact: ${n} landings, mean ${(sum / n).toFixed(3)} (contact redirection impulse Σ v̄·|Δθ|, felt-normalized)`);
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
    let zoomKeyframes: [number, number][] | undefined;
    let zoomSmoothing = 0;
    if (zoomMode === "spec") {
      const { plan, source } = await loadSpecZoomPlan(trackPath);
      if (plan !== null) {
        autoZoom = plan.autoZoom;
        zoomKeyframes = plan.zoomKeyframes;
        zoomSmoothing = plan.zoomSmoothing;
        console.log(
          `spec zoom: ${zoomRange(autoZoom)} from ${source ?? "spec"} ` +
            `(${zoomKeyframes.length} keyframes, smoothing ${zoomSmoothing})`,
        );
      } else {
        console.warn("WARN: --zoom=action/spec requested but no spec camera zoom was found; using static zoom=3.");
      }
    } else if (zoomMode === "trajectory") {
      const ys = (det.measurements.position as { x: number; y: number }[]).map((p) => p.y);
      autoZoom = signalToAutoZoom(localYExtent(ys, 50), zoomCfg); // ±50f ≈ ±1.25s
    } else if (zoomMode === "speed") {
      const vx = (det.measurements.velocity as { x: number; y: number }[]).map((v) => Math.abs(v.x));
      autoZoom = signalToAutoZoom(vx, zoomCfg);
    }
    if (autoZoom && zoomKeyframes === undefined) {
      // Downsample legacy generated zoom for the engine's native createZoomer.
      // The dense array remains the fallback if createZoomer is not present.
      zoomKeyframes = downsampleAutoZoom(autoZoom);
      console.log(
        `rendering video.mp4 via mirror at ${origin}... (${zoomMode}-zoom ` +
          `${zoomRange(autoZoom)} via createZoomer)`,
      );
    } else if (autoZoom) {
      console.log(`rendering video.mp4 via mirror at ${origin}... (${zoomMode}-zoom via createZoomer)`);
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
      zoomSmoothing,
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
