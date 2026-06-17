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
import { secToFrame, type Contact, type Spec } from "./v0/types.ts";

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
// --res also accepts an explicit WxH (e.g. 1080x1920 for vertical/Shorts): the
// mirror exporter renders any custom canvas size natively (Custom preset).
const RES_CHOICES = ["720p", "1080p", "1440p", "2160p"] as const;
const resArg = arg("res");
const customRes = resArg !== null ? /^(\d+)x(\d+)$/.exec(resArg) : null;
if (resArg !== null && !customRes && !(RES_CHOICES as readonly string[]).includes(resArg)) {
  console.error(`--res must be one of ${RES_CHOICES.join("|")} or WxH (e.g. 1080x1920) (got: ${resArg})`);
  process.exit(1);
}
const resolution: (typeof RES_CHOICES)[number] | { width: number; height: number } = customRes
  ? { width: Number(customRes[1]), height: Number(customRes[2]) }
  : (resArg ?? (has("1080p") ? "1080p" : "720p")) as (typeof RES_CHOICES)[number];
const resLabel = typeof resolution === "string" ? resolution : `${resolution.width}x${resolution.height}`;
// --zoom-mult=N scales the camera zoom by N (>1 = tighter / rider bigger). For
// --zoom=action/spec it multiplies every keyframe of the authored plan, preserving
// its zoom-in/out dynamics; otherwise it scales the static zoom. Useful for vertical
// renders, where the 16:9-authored plan is too zoomed-out (rider tiny in a tall frame).
const zoomMultArg = arg("zoom-mult");
const zoomMult = zoomMultArg !== null ? parseFloat(zoomMultArg) : 1;
if (!Number.isFinite(zoomMult) || zoomMult <= 0) {
  console.error(`--zoom-mult must be a positive number (got: ${zoomMultArg})`);
  process.exit(1);
}
// --beat-punch: a per-beat zoom "punch" reacting to the spec's authored impact —
// the camera snaps in (or out) on each strong landing, then eases back. Pure
// generation-side: it's baked into the per-frame zoom the renderer reads, not
// post-processing. Gated by impact threshold so weak beats don't twitch the camera.
const beatPunch = has("beat-punch");
const bpAmp = Number(arg("beat-punch-amp") ?? "0.13");        // peak zoom delta at the song's max impact
const bpPct = Number(arg("beat-punch-pct") ?? "70");          // gate: punch beats at/above this percentile of THIS spec's impacts (top 100-P%)
const bpThreshold = Number(arg("beat-punch-threshold") ?? "0"); // optional extra ABSOLUTE floor (0 = off, percentile drives)
const bpFloor = Number(arg("beat-punch-floor") ?? "0.5");     // amplitude of the weakest selected beat, as a fraction of amp (1 = uniform)
const bpDecay = Number(arg("beat-punch-decay") ?? "4");        // exp decay time constant, frames (snappy)
const bpAttack = Number(arg("beat-punch-attack") ?? "2");      // ramp-in, frames
const bpDir = (arg("beat-punch-dir") ?? "in") === "out" ? -1 : 1; // in = zoom toward rider

// Easing for the camera ramps (the in/out between zoom levels) and the punch attack.
// Linear ramps look mechanical; quad/cubic/expo/cosine read much smoother. Used only
// on the dense per-frame path (beat-punch or explicit --zoom-ease); the non-punch path
// already eases via the engine's cosine createZoomer.
const EASE: Record<string, (u: number) => number> = {
  linear: (u) => u,
  quad: (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2),
  cubic: (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2),
  cosine: (u) => (1 - Math.cos(Math.PI * u)) / 2,
  expo: (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u < 0.5 ? 2 ** (20 * u - 10) / 2 : (2 - 2 ** (-20 * u + 10)) / 2),
};
const zoomEaseName = arg("zoom-ease") ?? "cubic";
const zoomEase = EASE[zoomEaseName] ?? EASE.cubic;

// Dense per-frame zoom from log2 keyframes, easing each segment's interpolation param
// (vs the engine's linear denseLinearZoomFromLog2Keyframes).
function denseZoomEased(kf: readonly [number, number][], durationFrames: number): number[] {
  const n = Math.max(1, durationFrames + 1);
  const out = new Array<number>(n);
  let seg = 0;
  for (let f = 0; f < n; f++) {
    while (seg < kf.length - 2 && f > kf[seg + 1][0]) seg++;
    const [f0, z0] = kf[seg];
    const [f1, z1] = kf[Math.min(seg + 1, kf.length - 1)];
    const u = f1 === f0 ? 0 : Math.max(0, Math.min(1, (f - f0) / (f1 - f0)));
    out[f] = 2 ** (z0 + (z1 - z0) * zoomEase(u));
  }
  return out;
}

// Overlay a decaying zoom punch on a dense per-frame zoom array. Gating is RELATIVE:
// only beats at/above the bpPct percentile of this spec's impacts punch, and each
// punch's strength scales from `bpFloor·amp` (at the cutoff) to `amp` (at the song's
// max impact) — so bunched impacts still get contrast and the biggest hit pops. An
// optional absolute floor (bpThreshold) can raise the gate. Punches take the max per
// frame (no accumulation) so clusters stay bounded.
function applyBeatPunch(autoZoom: number[], contacts: Contact[]): number[] {
  const impacts = contacts.map((c) => c.impact ?? 0).filter((v) => v > 0).sort((a, b) => a - b);
  if (impacts.length === 0) {
    console.log("beat-punch: skipped (no positive authored impacts)");
    return autoZoom;
  }
  const pctVal = impacts[Math.min(impacts.length - 1, Math.floor((bpPct / 100) * impacts.length))];
  const gate = Math.max(pctVal, bpThreshold);
  const maxImp = impacts[impacts.length - 1];
  const span = Math.max(1e-6, maxImp - gate);

  const punch = new Array<number>(autoZoom.length).fill(0); // peak zoom fraction per frame
  let hits = 0;
  for (const c of contacts) {
    const imp = c.impact ?? 0;
    if (imp < gate) continue;
    hits++;
    const norm = Math.max(0, Math.min(1, (imp - gate) / span));
    const strength = bpAmp * (bpFloor + (1 - bpFloor) * norm);
    const f0 = secToFrame(c.t);
    const lo = Math.max(0, f0 - Math.ceil(bpAttack));
    const hi = Math.min(autoZoom.length - 1, f0 + Math.ceil(bpDecay * 5));
    for (let f = lo; f <= hi; f++) {
      const shape = f < f0
        ? (bpAttack <= 0 ? 1 : zoomEase(Math.max(0, Math.min(1, (f - (f0 - bpAttack)) / bpAttack)))) // eased ramp into the hit
        : Math.exp(-(f - f0) / bpDecay);                          // decay after
      punch[f] = Math.max(punch[f], strength * Math.max(0, shape));
    }
  }
  console.log(`beat-punch: top ${(100 - bpPct).toFixed(0)}% (impact ≥ p${bpPct}=${gate.toFixed(2)}) → ${hits} beats, amp ${bpAmp} (floor ${bpFloor}), decay ${bpDecay}f, dir ${bpDir > 0 ? "in" : "out"}`);
  return autoZoom.map((z, f) => z * (1 + bpDir * punch[f]));
}

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

async function loadSpecZoomPlan(trackPath: string): Promise<{ plan: RenderZoomPlan | null; source: string | null; spec: Spec | null }> {
  const specPath = arg("spec");
  if (specPath !== null) {
    if (!existsSync(specPath)) throw new Error(`--spec path not found: ${specPath}`);
    const mod = await import(resolve(specPath));
    const spec: Spec | undefined = mod.default;
    if (!spec) throw new Error(`spec module at ${specPath} did not default-export a Spec`);
    return {
      plan: specZoomLaneToRenderPlan(spec.camera?.zoom, spec.duration),
      source: specPath,
      spec,
    };
  }

  const cameraPath = arg("camera") ?? siblingCameraPath(trackPath);
  if (!existsSync(cameraPath)) return { plan: null, source: null, spec: null };
  const sidecar = JSON.parse(readFileSync(cameraPath, "utf8")) as CameraSidecar;
  return {
    plan: cameraSidecarToRenderPlan(sidecar),
    source: cameraPath,
    spec: null,
  };
}

const trackJson = JSON.parse(readFileSync(trackPath, "utf8"));
let zoomPlan: RenderZoomPlan | null = null;
let specContacts: Contact[] = [];
if (zoomMode === "spec") {
  try {
    const loaded = await loadSpecZoomPlan(trackPath);
    zoomPlan = loaded.plan;
    specContacts = loaded.spec?.contacts ?? [];
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
// Scale the camera by --zoom-mult: the log2 keyframes shift by log2(mult), the dense
// fallback and the static zoom scale linearly.
if (zoomMult !== 1 && zoomPlan) {
  const dLog2 = Math.log2(zoomMult);
  zoomPlan = {
    ...zoomPlan,
    zoomKeyframes: zoomPlan.zoomKeyframes.map(([f, l]) => [f, l + dLog2] as [number, number]),
    autoZoom: zoomPlan.autoZoom?.map((z) => z * zoomMult),
  };
}
// Dense per-frame path: needed for the beat punch (so the engine's smoother doesn't
// erase it) and whenever a non-default --zoom-ease is requested. Rebuild the base
// curve with the chosen easing, then overlay the impact punch. Clearing the keyframes
// forces the renderer onto this dense array instead of createZoomer.
const forceDense = beatPunch || arg("zoom-ease") !== null;
if (forceDense && zoomPlan) {
  const durF = zoomPlan.zoomKeyframes.at(-1)?.[0] ?? zoomPlan.autoZoom.length - 1;
  let dense = denseZoomEased(zoomPlan.zoomKeyframes, durF);
  console.log(`zoom-ease=${zoomEaseName} (dense path)`);
  if (beatPunch) {
    if (specContacts.length) dense = applyBeatPunch(dense, specContacts);
    else console.warn("WARN: --beat-punch needs --zoom=action/spec with --spec=<path> (authored contacts); skipping punch.");
  }
  zoomPlan = { ...zoomPlan, autoZoom: dense, zoomKeyframes: [] };
}
const effectiveZoom = zoom * zoomMult;
console.log(
  `track=${trackPath} (${trackJson.lines?.length} lines, duration=${trackJson.duration})\n` +
    `resolution=${resLabel}${hq ? " HQ" : ""}${qp !== null ? ` QP=${qp}` : ""} ` +
    `zoom=${zoomMode === "spec" && zoomPlan ? "spec" : effectiveZoom}${zoomMult !== 1 ? ` (mult ${zoomMult})` : ""}\n` +
    `origin=${origin}\nout=${outPath}`,
);

try {
  await exportVideo({
    trackJson,
    outPath,
    origin,
    zoom: effectiveZoom,
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
