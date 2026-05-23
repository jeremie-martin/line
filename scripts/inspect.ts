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
 *
 * Plus `shakedown/runs.json` — dashboard landing-page index.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, basename, dirname } from "node:path";
import {
  detect,
  extractRawTrajectory,
  DEFAULT_PARAMS,
} from "./lib/detector.ts";
import { exportVideo, MirrorUnreachableError } from "./lib/export.ts";

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
const zoom = arg("zoom") !== null ? parseFloat(arg("zoom")!) : undefined;

mkdirSync(outDir, { recursive: true });

// ── 1. Load track, build lr-core engine ──────────────────────────────────
const trackJson = JSON.parse(readFileSync(trackPath, "utf8"));
const duration: number = trackJson.duration ?? 1200;
console.log(`track=${trackPath} (${trackJson.lines?.length ?? 0} lines, duration=${duration} frames)`);
console.log(`run=${runName}, out=${outDir}`);

// deno-lint-ignore no-explicit-any
const lrCore: any = await import("lr-core/line-rider-engine/index.js");
const LineRiderEngine = lrCore.default;
const { createLineFromJson } = lrCore;

// deno-lint-ignore no-explicit-any
let engine: any = new LineRiderEngine();
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
writeFileSync(
  detectionPath,
  JSON.stringify(
    {
      meta: {
        track: trackPath,
        run: runName,
        duration,
        fps: 40,
        generatedAt: new Date().toISOString(),
      },
      ...det,
    },
    null,
    2,
  ),
);
console.log(`wrote ${detectionPath}`);

writeFileSync(resolve(outDir, "track.json"), JSON.stringify(trackJson, null, 2));

// ── 4. Render mp4 (auto if missing, or forced) ───────────────────────────
const videoPath = resolve(outDir, "video.mp4");
let videoRendered = false;
const haveVideo = existsSync(videoPath);

if (skipRender) {
  console.log("skip-render: --no-render");
} else if (haveVideo && !forceRender) {
  console.log(`video.mp4 already present — keeping (pass --render to overwrite)`);
} else {
  try {
    console.log(`rendering video.mp4 via mirror at ${origin}...`);
    await exportVideo({
      trackJson,
      outPath: videoPath,
      origin,
      zoom,
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
  hasVideo: existsSync(videoPath),
  eventCount: det.events.length,
});
writeFileSync(runsIndexPath, JSON.stringify(runs, null, 2));

// ── 6. Print dashboard URL ───────────────────────────────────────────────
const dashUrl = `http://127.0.0.1:8767/dashboard/?run=${encodeURIComponent(runName)}`;
console.log(`\nDashboard → ${dashUrl}`);
console.log(`(run \`npm run dash\` from project root if not already serving)`);

if (!videoRendered && !haveVideo) {
  console.log(`(video.mp4 missing; the dashboard will show plots only until you re-run with --render)`);
}

// Suppress noisy "default params" line unless they were customized.
void DEFAULT_PARAMS;
