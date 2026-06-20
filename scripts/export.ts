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
  denseLinearZoomFromLog2Keyframes,
  type CameraSidecar,
  type RenderZoomPlan,
} from "./v0/core/camera.ts";
import { secToFrame, type Contact, type Spec, type SpecBeatPunch } from "./v0/types.ts";
import { applyJolt } from "./produce/seed.ts";

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
// Beat-punch is authored in the SPEC (`spec.camera.beatPunch`) as the source of
// truth; the CLI flags below only OVERRIDE individual fields for experimentation.
// It's enabled when the spec authors it OR `--beat-punch` is passed. The resolved
// config is built after the spec loads (resolveBeatPunch), since the spec carries
// the per-field defaults.
const cliBeatPunchFlag = has("beat-punch");
const cliNum = (name: string): number | undefined => {
  const v = arg(name);
  return v === null ? undefined : Number(v);
};
const cliBP = {
  amp: cliNum("beat-punch-amp"),
  pct: cliNum("beat-punch-pct"),
  threshold: cliNum("beat-punch-threshold"),
  floor: cliNum("beat-punch-floor"),
  decay: cliNum("beat-punch-decay"),
  attack: cliNum("beat-punch-attack"),
  dir: arg("beat-punch-dir") ?? undefined,
};
// --jolt-ms: the same felt-jolt authoring shift the producer compiles the track with
// (seed.ts applyJolt). The track lands on the JOLTED contact times, so beat-punch must
// read those same shifted times — otherwise every punch peak trails the felt slam by
// the jolt amount. Default 0 (no shift) keeps the dashboard/run.ts paths byte-identical.
const joltMs = cliNum("jolt-ms") ?? 0;

type ResolvedBeatPunch = {
  amp: number; pct: number; threshold: number; floor: number;
  decay: number; attack: number; dir: 1 | -1;
};

/** Merge spec.camera.beatPunch with CLI overrides → the active config, or null if
 *  beat-punch isn't enabled (neither the spec nor --beat-punch asked for it). */
function resolveBeatPunch(specBP: SpecBeatPunch | undefined): ResolvedBeatPunch | null {
  if (!cliBeatPunchFlag && specBP === undefined) return null;
  const dir = cliBP.dir ?? specBP?.dir ?? "in";
  return {
    amp: cliBP.amp ?? specBP?.amp ?? 0.13,
    pct: cliBP.pct ?? specBP?.percentile ?? 70,
    threshold: cliBP.threshold ?? specBP?.threshold ?? 0,
    floor: cliBP.floor ?? specBP?.floor ?? 0.5,
    decay: cliBP.decay ?? specBP?.decay ?? 4,
    attack: cliBP.attack ?? specBP?.attack ?? 1,
    dir: dir === "out" ? -1 : 1,
  };
}

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

// Overlay a decaying zoom punch on a dense per-frame zoom array. Gating is RELATIVE:
// only beats at/above the bpPct percentile of this spec's impacts punch, and each
// punch's strength scales from `bpFloor·amp` (at the cutoff) to `amp` (at the song's
// max impact) — so bunched impacts still get contrast and the biggest hit pops. An
// optional absolute floor (bpThreshold) can raise the gate. Punches take the max per
// frame (no accumulation) so clusters stay bounded.
function applyBeatPunch(autoZoom: number[], contacts: Contact[], bp: ResolvedBeatPunch): number[] {
  const impacts = contacts.map((c) => c.impact ?? 0).filter((v) => v > 0).sort((a, b) => a - b);
  if (impacts.length === 0) {
    console.log("beat-punch: skipped (no positive authored impacts)");
    return autoZoom;
  }
  // Gate: an absolute `threshold` (every beat at/above it punches) takes precedence;
  // otherwise the top (100-pct)% by impact. Strength scales from `floor·amp` at the
  // gate to `amp` at the song's max impact — i.e. proportional to impact.
  const pctVal = impacts[Math.min(impacts.length - 1, Math.floor((bp.pct / 100) * impacts.length))];
  const gate = bp.threshold > 0 ? bp.threshold : pctVal;
  const maxImp = impacts[impacts.length - 1];
  const span = Math.max(1e-6, maxImp - gate);

  const punch = new Array<number>(autoZoom.length).fill(0); // peak zoom fraction per frame
  let hits = 0;
  for (const c of contacts) {
    const imp = c.impact ?? 0;
    if (imp < gate) continue;
    hits++;
    const norm = Math.max(0, Math.min(1, (imp - gate) / span));
    const strength = bp.amp * (bp.floor + (1 - bp.floor) * norm);
    const f0 = secToFrame(c.t);
    const lo = Math.max(0, f0 - Math.ceil(bp.attack));
    const hi = Math.min(autoZoom.length - 1, f0 + Math.ceil(bp.decay * 5));
    for (let f = lo; f <= hi; f++) {
      const shape = f < f0
        ? (bp.attack <= 0 ? 1 : zoomEase(Math.max(0, Math.min(1, (f - (f0 - bp.attack)) / bp.attack)))) // eased ramp into the hit
        : Math.exp(-(f - f0) / bp.decay);                          // decay after
      punch[f] = Math.max(punch[f], strength * Math.max(0, shape));
    }
  }
  const gateLabel = bp.threshold > 0 ? `impact ≥ ${bp.threshold.toFixed(2)}` : `top ${(100 - bp.pct).toFixed(0)}% (≥ p${bp.pct}=${gate.toFixed(2)})`;
  console.log(`beat-punch: ${gateLabel} → ${hits} beats, amp ${bp.amp} (floor ${bp.floor}), decay ${bp.decay}f, dir ${bp.dir > 0 ? "in" : "out"}`);
  // Clamp the multiplier to a small positive floor: a large `out` punch (amp > 1) would
  // otherwise drive `1 + dir·punch` negative and invert/collapse the camera.
  return autoZoom.map((z, f) => z * Math.max(0.05, 1 + bp.dir * punch[f]));
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
let specBeatPunch: SpecBeatPunch | undefined;
if (zoomMode === "spec") {
  try {
    const loaded = await loadSpecZoomPlan(trackPath);
    zoomPlan = loaded.plan;
    // Shift contacts by the same jolt the track was compiled with, so beat-punch
    // peaks land on the jolted contacts (i.e. the felt slam) the ride actually hits.
    specContacts = loaded.spec ? applyJolt(loaded.spec, joltMs).contacts : [];
    specBeatPunch = loaded.spec?.camera?.beatPunch;
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
const resolvedBeatPunch = resolveBeatPunch(specBeatPunch);
if (resolvedBeatPunch && specBeatPunch !== undefined && !cliBeatPunchFlag) {
  console.log("beat-punch: from spec.camera.beatPunch");
}
const forceDense = resolvedBeatPunch !== null || arg("zoom-ease") !== null;
if (forceDense && zoomPlan) {
  const durF = zoomPlan.zoomKeyframes.at(-1)?.[0] ?? zoomPlan.autoZoom.length - 1;
  let dense = denseLinearZoomFromLog2Keyframes(zoomPlan.zoomKeyframes, durF, zoomEase);
  console.log(`zoom-ease=${zoomEaseName} (dense path)`);
  if (resolvedBeatPunch) {
    if (specContacts.length) dense = applyBeatPunch(dense, specContacts, resolvedBeatPunch);
    else console.warn("WARN: beat-punch needs --zoom=action/spec with --spec=<path> (authored contacts); skipping punch.");
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
