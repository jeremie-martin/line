/**
 * Thin CLI wrapper over `lib/export.ts:exportVideo`.
 *
 *   npx tsx scripts/export.ts --track=test.track.json --zoom=3 --1080p --hq
 *   npx tsx scripts/export.ts --track=test.track.json --out=shakedown/out.mp4
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { exportVideo, MirrorUnreachableError } from "./lib/export.ts";
import {
  cameraSidecarToRenderPlan,
  specZoomLaneToRenderPlan,
  type CameraSidecar,
  type RenderZoomPlan,
} from "./v0/core/camera.ts";
import type { Spec } from "./v0/types.ts";

const argv = process.argv.slice(2);
const arg = (name: string): string | null => {
  const m = argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.slice(name.length + 3) : null;
};
const has = (name: string) => argv.includes(`--${name}`);

const origin = arg("origin") ?? "http://127.0.0.1:8765";
const trackPath = arg("track");
const zoomArg = arg("zoom");
const zoomMode: "static" | "spec" =
  zoomArg?.startsWith("action") || zoomArg?.startsWith("spec") ? "spec" : "static";
// Default zoom=3 (well-framed for typical generated tracks). Override with --zoom=N
// or --zoom=action/--zoom=spec to read --spec=<path.ts> or <track>.camera.json.
const zoom = zoomMode === "static" && zoomArg !== null ? parseFloat(zoomArg) : 3;
// --res=720p|1080p|1440p|2160p (or legacy --1080p). 1440p/2160p render Line
// Rider's vector art natively at higher size = genuinely sharper, not upscaled.
const RES_CHOICES = ["720p", "1080p", "1440p", "2160p"] as const;
const resArg = arg("res");
if (resArg !== null && !(RES_CHOICES as readonly string[]).includes(resArg)) {
  console.error(`--res must be one of ${RES_CHOICES.join("|")} (got: ${resArg})`);
  process.exit(1);
}
const resolution = (resArg ?? (has("1080p") ? "1080p" : "720p")) as (typeof RES_CHOICES)[number];
const hq = has("hq");
// Explicit encoder QP (lower = higher quality; x264 sane range ~14-28). Overrides
// hq's built-in QP (22/28). e.g. --qp=17 for a crisp HQ render.
const qpArg = arg("qp");
const qp = qpArg !== null ? parseInt(qpArg, 10) : null;
if (qp !== null && (!Number.isInteger(qp) || qp < 0 || qp > 51)) {
  console.error(`--qp must be an integer in [0,51] (got: ${qpArg})`);
  process.exit(1);
}
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

function siblingCameraPath(path: string): string {
  const trackJson = path.replace(/\.track\.json$/i, ".camera.json");
  if (trackJson !== path) return trackJson;
  return path.replace(/\.json$/i, ".camera.json");
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

const trackJson = JSON.parse(readFileSync(trackPath, "utf8"));
let zoomPlan: RenderZoomPlan | null = null;
if (zoomMode === "spec") {
  try {
    const loaded = await loadSpecZoomPlan(trackPath);
    zoomPlan = loaded.plan;
    if (zoomPlan !== null) {
      console.log(`spec zoom=${loaded.source} (${zoomPlan.zoomKeyframes.length} keyframes, smoothing ${zoomPlan.zoomSmoothing})`);
    } else {
      console.warn("WARN: --zoom=action/spec requested but no spec camera zoom was found; using static zoom=3.");
    }
  } catch (e) {
    console.error(`\nERROR: ${String(e)}`);
    process.exit(1);
  }
}
console.log(
  `track=${trackPath} (${trackJson.lines?.length} lines, duration=${trackJson.duration})\n` +
    `resolution=${resolution}${hq ? " HQ" : ""}${qp !== null ? ` QP=${qp}` : ""} zoom=${zoomMode === "spec" && zoomPlan ? "spec" : zoom}\n` +
    `origin=${origin}\nout=${outPath}`,
);

try {
  await exportVideo({
    trackJson,
    outPath,
    origin,
    zoom,
    autoZoom: zoomPlan?.autoZoom,
    zoomKeyframes: zoomPlan?.zoomKeyframes,
    zoomSmoothing: zoomPlan?.zoomSmoothing ?? 0,
    resolution,
    hq,
    encoderSettings: qp !== null ? { quantizationParameter: qp } : undefined,
    headed,
  });
} catch (e) {
  if (e instanceof MirrorUnreachableError) {
    console.error(`\nERROR: cannot reach ${origin}`);
    console.error(`hint: run \`python3 -m http.server 8765 --bind 127.0.0.1\` from the mirror/ directory.`);
    process.exit(2);
  }
  console.error(`\nERROR: ${String(e)}`);
  process.exit(1);
}
