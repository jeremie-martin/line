/**
 * eval_ballistic_vs_engine.ts — controlled decomposition of airborne
 * ballistic-prediction error against the engine.
 *
 * For every detector-airborne stretch, compare the production propagation law
 * under several launch/readout definitions:
 *   - the public six-body-point rider aggregate used by production;
 *   - the equal ten-point body+sled assembly aggregate;
 *   - the production four-frame smoothed launch read;
 *   - diagnostic body-from-assembly rotation reconstructions.
 *
 * Each method uses the same reader for launch and truth, so its dt=0 error is
 * exactly zero. The ten-point aggregate is a physics oracle only during truly
 * collision-free flight: detector `airborne` excludes sled contact, but body
 * points can still collide with track. This distinction is why an exact
 * assembly-center result must not be treated as an automatic production-state
 * replacement.
 *
 * Run: LR_ENGINE=wasm npx tsx scripts/v0/eval_ballistic_vs_engine.ts
 */
import { loadGoldenSpec } from "./golden_suite.ts";
import { compileHandoff, type HandoffNode } from "./optimizer/handoff.ts";
import { isStrictlyBetter, type LeafKey } from "./optimizer/register.ts";
import { detectWindow } from "./core/candidate.ts";
import { airborneAt } from "./core/substrate.ts";
import { getRiderMetered, sledPoseDegFromRider } from "../lib/detector.ts";
import { readArrivalState } from "./optimizer/arc_probe.ts";
import {
  propagateBallisticArrivalState,
  type RiderArrivalState,
} from "./optimizer/arc_model.ts";
import { gravityCorrectedLaunchAverage } from "./core/launch_read.ts";
import { ELEVATION, FPS } from "./types.ts";

const SPEC = process.env.SPEC ?? "big_air_ramp";
const SEED = Number(process.env.SEED ?? "0");
const BUDGET = Number(process.env.BUDGET ?? "200000");
const MIN_STRETCH = 6; // ignore tiny hops; we care about real flights

const spec = await loadGoldenSpec(SPEC, "base");

// Compile normally; keep the best COMPLETE track (its engine has the whole simulated track).
let winning: HandoffNode | null = null;
let winningKey: LeafKey | null = null;
compileHandoff(spec, SEED, {
  budget: BUDGET,
  onNode: (node, key, event) => {
    if (!event.fullDuration) return;
    if (winningKey === null || isStrictlyBetter(key, winningKey)) {
      winning = node;
      winningKey = key;
    }
  },
});
if (winning === null) throw new Error(`no complete track for ${SPEC} seed=${SEED} budget=${BUDGET}`);
const engine = (winning as HandoffNode).search.prefixEngine;

const durationFrames = Math.round(spec.duration * FPS);
const det = detectWindow(engine, 0, durationFrames + 20);

// Find airborne stretches (maximal runs of airborne frames).
const stretches: Array<[number, number]> = [];
let start = -1;
for (let f = 0; f <= durationFrames; f++) {
  const air = airborneAt(det, f);
  if (air && start < 0) start = f;
  else if (!air && start >= 0) {
    if (f - 1 - start + 1 >= MIN_STRETCH) stretches.push([start, f - 1]);
    start = -1;
  }
}
if (start >= 0 && durationFrames - start + 1 >= MIN_STRETCH) stretches.push([start, durationFrames]);

console.log(`eval_ballistic_vs_engine — readout/model decomposition (exact frame alignment)`);
console.log(`spec=${SPEC} seed=${SEED} budget=${BUDGET}  durationFrames=${durationFrames}`);
console.log(`airborne stretches (>=${MIN_STRETCH}f): ${stretches.length}`);

const BALLISTIC_POINT_IDS = [
  "PEG", "TAIL", "NOSE", "STRING",
  "BUTT", "SHOULDER", "RHAND", "LHAND", "LFOOT", "RFOOT",
] as const;

function readAssemblyState(frame: number): RiderArrivalState | null {
  const rider = getRiderMetered(engine, frame);
  const points = BALLISTIC_POINT_IDS.map((id) => rider.get?.(id));
  if (points.some((point) =>
    point === undefined ||
    !Number.isFinite(point.pos?.x) ||
    !Number.isFinite(point.pos?.y) ||
    !Number.isFinite(point.vel?.x) ||
    !Number.isFinite(point.vel?.y)
  )) return null;
  let x = 0, y = 0, vx = 0, vy = 0;
  for (const point of points) {
    x += point.pos.x;
    y += point.pos.y;
    vx += point.vel.x;
    vy += point.vel.y;
  }
  x /= points.length;
  y /= points.length;
  vx /= points.length;
  vy /= points.length;
  const speed = Math.hypot(vx, vy);
  const pose = sledPoseDegFromRider(rider);
  const prevPose = frame > 0 ? sledPoseDegFromRider(getRiderMetered(engine, frame - 1)) : null;
  return {
    x, y, vx, vy, speed,
    comAngleDeg: speed > 0 ? Math.atan2(vy, vx) * 180 / Math.PI : null,
    sledPoseDeg: pose,
    sledPoseRateDegPerFrame: pose !== null && prevPose !== null
      ? normalizeAngleDeg(pose - prevPose)
      : null,
  };
}

function normalizeAngleDeg(value: number): number {
  let out = value % 360;
  if (out > 180) out -= 360;
  if (out <= -180) out += 360;
  return out;
}

function rotate(x: number, y: number, degrees: number): { x: number; y: number } {
  const radians = degrees * Math.PI / 180;
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return { x: x * c - y * s, y: x * s + y * c };
}

function rotationalBodyPrediction(frame: number, dt: number): RiderArrivalState | null {
  const body = readArrivalState(engine, frame);
  const assembly = readAssemblyState(frame);
  const prevBody = frame > 0 ? readArrivalState(engine, frame - 1) : null;
  const prevAssembly = frame > 0 ? readAssemblyState(frame - 1) : null;
  const omega = assembly?.sledPoseRateDegPerFrame;
  if (body === null || assembly === null || omega === null) return null;
  if (dt === 0) return body;
  const center = propagateBallisticArrivalState(assembly, dt);
  const rx = body.x - assembly.x;
  const ry = body.y - assembly.y;
  const relativeAt = (offset: number): { x: number; y: number } | null => {
    if (offset === 0) return { x: rx, y: ry };
    if (offset === -1 && prevBody !== null && prevAssembly !== null) {
      return { x: prevBody.x - prevAssembly.x, y: prevBody.y - prevAssembly.y };
    }
    return rotate(rx, ry, omega * offset);
  };
  const r = relativeAt(dt);
  const r1 = relativeAt(dt - 1);
  const r2 = relativeAt(dt - 2);
  if (r === null || r1 === null || r2 === null) return null;
  const vx = center.vx + r1.x - r2.x;
  const vy = center.vy + r1.y - r2.y;
  const speed = Math.hypot(vx, vy);
  return {
    x: center.x + r.x,
    y: center.y + r.y,
    vx,
    vy,
    speed,
    comAngleDeg: speed > 0 ? Math.atan2(vy, vx) * 180 / Math.PI : null,
    sledPoseDeg: center.sledPoseDeg,
    sledPoseRateDegPerFrame: omega,
  };
}

function rotationalVelocityPrediction(frame: number, dt: number): RiderArrivalState | null {
  const body = readArrivalState(engine, frame);
  const assembly = readAssemblyState(frame);
  const omega = assembly?.sledPoseRateDegPerFrame;
  if (body === null || assembly === null || omega === null) return null;
  if (dt === 0) return body;
  const center = propagateBallisticArrivalState(assembly, dt);
  const r = rotate(body.x - assembly.x, body.y - assembly.y, omega * dt);
  const relativeVelocity = rotate(body.vx - assembly.vx, body.vy - assembly.vy, omega * dt);
  const vx = center.vx + relativeVelocity.x;
  const vy = center.vy + relativeVelocity.y;
  const speed = Math.hypot(vx, vy);
  return {
    x: center.x + r.x,
    y: center.y + r.y,
    vx,
    vy,
    speed,
    comAngleDeg: speed > 0 ? Math.atan2(vy, vx) * 180 / Math.PI : null,
    sledPoseDeg: center.sledPoseDeg,
    sledPoseRateDegPerFrame: omega,
  };
}

function productionSmoothedBodyPrediction(frame: number, dt: number): RiderArrivalState | null {
  const body = readArrivalState(engine, frame);
  if (body === null) return null;
  const { vx, vy } = gravityCorrectedLaunchAverage(
    { x: body.vx, y: body.vy },
    ELEVATION.GRAVITY_PX_PER_FRAME2,
    () => true,
    (k) => {
      const state = readArrivalState(engine, frame + k);
      return state === null ? null : { x: state.vx, y: state.vy };
    },
  );
  return propagateBallisticArrivalState({
    ...body,
    vx,
    vy,
    speed: Math.hypot(vx, vy),
    comAngleDeg: Math.atan2(vy, vx) * 180 / Math.PI,
  }, dt);
}

function conservedCenterVelocityPrediction(frame: number, dt: number): RiderArrivalState | null {
  const body = readArrivalState(engine, frame);
  const center = readAssemblyState(frame);
  if (body === null || center === null) return null;
  if (dt === 0) return body;
  const arrived = propagateBallisticArrivalState(center, dt);
  return { ...arrived, x: body.x + body.vx * dt, y: body.y + body.vy * dt +
    0.5 * ELEVATION.GRAVITY_PX_PER_FRAME2 * dt * (dt + 1) };
}

function futureCalibratedRotationalPrediction(frame: number, dt: number): RiderArrivalState | null {
  const bodies: RiderArrivalState[] = [];
  const centers: RiderArrivalState[] = [];
  const relative: Array<{ x: number; y: number }> = [];
  for (let k = 0; k < 4; k++) {
    const body = readArrivalState(engine, frame + k);
    const center = readAssemblyState(frame + k);
    if (body === null || center === null) return null;
    bodies.push(body);
    centers.push(center);
    relative.push({ x: body.x - center.x, y: body.y - center.y });
  }
  if (dt < 4) return bodies[dt];
  const a2 = Math.atan2(relative[2].y, relative[2].x) * 180 / Math.PI;
  const a3 = Math.atan2(relative[3].y, relative[3].x) * 180 / Math.PI;
  const omega = normalizeAngleDeg(a3 - a2);
  const center = propagateBallisticArrivalState(centers[0], dt);
  const relativeAt = (offset: number): { x: number; y: number } =>
    offset <= 3 ? relative[offset] : rotate(relative[3].x, relative[3].y, omega * (offset - 3));
  const r = relativeAt(dt);
  const r1 = relativeAt(dt - 1);
  const r2 = relativeAt(dt - 2);
  const vx = center.vx + r1.x - r2.x;
  const vy = center.vy + r1.y - r2.y;
  const speed = Math.hypot(vx, vy);
  return {
    x: center.x + r.x,
    y: center.y + r.y,
    vx,
    vy,
    speed,
    comAngleDeg: speed > 0 ? Math.atan2(vy, vx) * 180 / Math.PI : null,
    sledPoseDeg: null,
    sledPoseRateDegPerFrame: omega,
  };
}

function futureCalibratedRelativeVelocityPrediction(frame: number, dt: number): RiderArrivalState | null {
  const bodies: RiderArrivalState[] = [];
  const centers: RiderArrivalState[] = [];
  const relative: Array<{ x: number; y: number }> = [];
  for (let k = 0; k < 4; k++) {
    const body = readArrivalState(engine, frame + k);
    const center = readAssemblyState(frame + k);
    if (body === null || center === null) return null;
    bodies.push(body);
    centers.push(center);
    relative.push({ x: body.x - center.x, y: body.y - center.y });
  }
  if (dt < 4) return bodies[dt];
  const a2 = Math.atan2(relative[2].y, relative[2].x) * 180 / Math.PI;
  const a3 = Math.atan2(relative[3].y, relative[3].x) * 180 / Math.PI;
  const omega = normalizeAngleDeg(a3 - a2);
  const center = propagateBallisticArrivalState(centers[0], dt);
  const r = rotate(relative[3].x, relative[3].y, omega * (dt - 3));
  const q = rotate(
    bodies[3].vx - centers[3].vx,
    bodies[3].vy - centers[3].vy,
    omega * (dt - 3),
  );
  const vx = center.vx + q.x;
  const vy = center.vy + q.y;
  const speed = Math.hypot(vx, vy);
  return {
    x: center.x + r.x,
    y: center.y + r.y,
    vx,
    vy,
    speed,
    comAngleDeg: speed > 0 ? Math.atan2(vy, vx) * 180 / Math.PI : null,
    sledPoseDeg: null,
    sledPoseRateDegPerFrame: omega,
  };
}

type ErrorBucket = { vy: number[]; y: number[]; speed: number[]; angle: number[] };
type ReadoutStats = {
  label: string;
  byDt: Map<number, ErrorBucket>;
  g0vy: number;
  g0y: number;
  used: number;
};
type PredictionMethod = {
  stats: ReadoutStats;
  read: (frame: number) => RiderArrivalState | null;
  predict?: (frame: number, dt: number) => RiderArrivalState | null;
};
const readouts: PredictionMethod[] = [
  {
    stats: { label: "body-only rider readout", byDt: new Map(), g0vy: 0, g0y: 0, used: 0 },
    read: (frame) => readArrivalState(engine, frame),
  },
  {
    stats: { label: "body+sled conserved aggregate", byDt: new Map(), g0vy: 0, g0y: 0, used: 0 },
    read: readAssemblyState,
  },
  {
    stats: { label: "conserved aggregate + rotating body offset", byDt: new Map(), g0vy: 0, g0y: 0, used: 0 },
    read: (frame) => readArrivalState(engine, frame),
    predict: rotationalBodyPrediction,
  },
  {
    stats: { label: "conserved aggregate + rotated launch relative velocity", byDt: new Map(), g0vy: 0, g0y: 0, used: 0 },
    read: (frame) => readArrivalState(engine, frame),
    predict: rotationalVelocityPrediction,
  },
  {
    stats: { label: "production 4-frame smoothed body launch", byDt: new Map(), g0vy: 0, g0y: 0, used: 0 },
    read: (frame) => readArrivalState(engine, frame),
    predict: productionSmoothedBodyPrediction,
  },
  {
    stats: { label: "conserved-center velocity as body arrival", byDt: new Map(), g0vy: 0, g0y: 0, used: 0 },
    read: (frame) => readArrivalState(engine, frame),
    predict: conservedCenterVelocityPrediction,
  },
  {
    stats: { label: "4-frame calibrated conserved+rotation model", byDt: new Map(), g0vy: 0, g0y: 0, used: 0 },
    read: (frame) => readArrivalState(engine, frame),
    predict: futureCalibratedRotationalPrediction,
  },
  {
    stats: { label: "4-frame calibrated relative-velocity rotation", byDt: new Map(), g0vy: 0, g0y: 0, used: 0 },
    read: (frame) => readArrivalState(engine, frame),
    predict: futureCalibratedRelativeVelocityPrediction,
  },
];

// Aggregate signed/absolute errors by dt for each launch/readout definition.
for (const [s0, s1] of stretches) {
  for (const { stats, read, predict } of readouts) {
    const launch = read(s0);
    if (launch === null) continue;
    stats.used++;
    for (let dt = 0; dt <= s1 - s0; dt++) {
      const pred = predict === undefined
        ? propagateBallisticArrivalState(launch, dt)
        : predict(s0, dt);
      if (pred === null) break;
      const act = read(s0 + dt);
      if (act === null) break;
      const vyErr = pred.vy - act.vy;
      const yErr = pred.y - act.y;
      const speedErr = pred.speed - act.speed;
      const angleErr = pred.comAngleDeg === null || act.comAngleDeg === null
        ? NaN
        : normalizeAngleDeg(pred.comAngleDeg - act.comAngleDeg);
      if (dt === 0) {
        stats.g0vy = Math.max(stats.g0vy, Math.abs(vyErr));
        stats.g0y = Math.max(stats.g0y, Math.abs(yErr));
      }
      const b = stats.byDt.get(dt) ?? { vy: [], y: [], speed: [], angle: [] };
      b.vy.push(vyErr);
      b.y.push(yErr);
      b.speed.push(speedErr);
      if (Number.isFinite(angleErr)) b.angle.push(angleErr);
      stats.byDt.set(dt, b);
    }
  }
}

const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const meanAbs = (a: number[]) => (a.length ? a.reduce((s, x) => s + Math.abs(x), 0) / a.length : 0);

const DTS = [0, 1, 2, 3, 5, 8, 12, 16, 20, 25, 30, 40];
for (const { stats } of readouts) {
  console.log(`\n=== ${stats.label} (runs=${stats.used})`);
  console.log(`GUARDRAIL dt=0: max|vyErr|=${stats.g0vy.toExponential(2)} max|yErr|=${stats.g0y.toExponential(2)}`);
  console.log(`  dt    n   mean(vyErr)  mean|vyErr|  mean|yErr|  mean|speedErr| mean|angleErr|`);
  for (const dt of DTS) {
    const b = stats.byDt.get(dt);
    if (!b) continue;
    console.log(
      `  ${String(dt).padStart(3)} ${String(b.vy.length).padStart(4)}  ` +
      `${mean(b.vy).toFixed(4).padStart(10)}  ${meanAbs(b.vy).toFixed(4).padStart(10)}  ` +
      `${meanAbs(b.y).toFixed(3).padStart(9)}  ${meanAbs(b.speed).toFixed(4).padStart(12)}  ` +
      `${meanAbs(b.angle).toFixed(3).padStart(13)}`,
    );
  }
  const signed = (dt: number) => mean(stats.byDt.get(dt)?.vy ?? []);
  const s8 = signed(8), s12 = signed(12), s20 = signed(20), s25 = signed(25);
  const driftPerFrame = Math.abs((s25 - s12) / 13);
  console.log(
    `signed vyErr: dt8=${s8.toFixed(4)} dt12=${s12.toFixed(4)} ` +
    `dt20=${s20.toFixed(4)} dt25=${s25.toFixed(4)}; drift12→25=${driftPerFrame.toFixed(5)}`,
  );
}
