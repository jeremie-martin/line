/**
 * Rotation study harness — define & MEASURE rider rotation from the real motion,
 * before any steering. Rotation (flips/spins) is not in position/velocity; it's
 * the rider's *orientation* over time, recovered from body points via
 * engine.getRider(frame).get(name).pos.
 *
 * The SLED is rigid (NOSE–TAIL length ~constant), so the sled angle = atan2(NOSE−TAIL)
 * is a clean orientation. The BOSH (SHOULDER–BUTT) flops (ragdoll), so it's reported
 * but is not the primary rotation signal. On the ground the sled is constrained to
 * the surface (angle ≈ velocity direction — a validation check); rotation as a
 * *trick* lives in the AIR, where the sled tumbles freely.
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_rotation.ts --track track.json
 *   (or compile first: run.ts --out=generated/foo, then --track generated/foo.track.json)
 */
import { readFileSync } from "node:fs";
import { LineRiderEngine, createLineFromJson } from "../lib/_lr_engine.ts";
import { extractRawTrajectory, detect } from "../lib/detector.ts";
import { computeRotationTrace, computeStands } from "../lib/rotation.ts";
import { FPS } from "./types.ts";

const argv = process.argv.slice(2);
const trackPath = (argv.find((a) => a.startsWith("--track=")) ?? "--track=track.json").split("=")[1];

function ang(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return (Math.atan2(a.y - b.y, a.x - b.x) * 180) / Math.PI; // direction b→a, degrees
}

const track = JSON.parse(readFileSync(trackPath, "utf8"));
// Pass 1: detection (airborne + velocity).
let e1: any = new LineRiderEngine().setStart(track.startPosition, track.riders[0].startVelocity);
for (const l of track.lines) e1 = e1.addLine(createLineFromJson(l));
const det = detect(extractRawTrajectory(e1, track.duration));
const air = det.measurements.airborne;
const vel = det.measurements.velocity;
const F = det.terminus.frame;

// Pass 2: per-frame sled & body orientation from rider points.
let e2: any = new LineRiderEngine().setStart(track.startPosition, track.riders[0].startVelocity);
for (const l of track.lines) e2 = e2.addLine(createLineFromJson(l));
const sledAngRaw: number[] = [], bodyAngRaw: number[] = [], sledLen: number[] = [];
for (let f = 0; f <= F; f++) {
  const r = e2.getRider(f);
  const nose = r.get("NOSE")?.pos, tail = r.get("TAIL")?.pos;
  const sh = r.get("SHOULDER")?.pos, bt = r.get("BUTT")?.pos;
  sledAngRaw.push(nose && tail ? ang(nose, tail) : NaN);
  bodyAngRaw.push(sh && bt ? ang(sh, bt) : NaN);
  sledLen.push(nose && tail ? Math.hypot(nose.x - tail.x, nose.y - tail.y) : NaN);
}
// Reduce sled orientation to rotation features (shared with the trace emitter).
const rot = computeRotationTrace(sledAngRaw, air.slice(0, F + 1));
const sled = rot.cumulativeDeg;       // unwrapped cumulative orientation
const angVel = rot.angVelDegPerFrame; // per-frame angular velocity (deg/frame)
const totalAbs = rot.totalAbsRotationDeg;
const flips = rot.flipCount;
const arcRows = rot.arcs.map((a) => ({ f: a.endFrame, netDeg: a.netDeg, absDeg: a.absDeg, peak: a.peakDegPerFrame, len: a.lengthFrames }));
let maxArcNet = 0;
for (const a of rot.arcs) if (Math.abs(a.netDeg) > Math.abs(maxArcNet)) maxArcNet = a.netDeg;

// Ground validation: sled angle should track velocity direction on the ground.
let gdiff = 0, gn = 0;
for (let f = 0; f <= F; f++) {
  if (air[f]) continue;
  const v = vel[f]; if (!v) continue;
  const va = (Math.atan2(v.y, v.x) * 180) / Math.PI;
  let d = sledAngRaw[f] - va; while (d > 180) d -= 360; while (d < -180) d += 360;
  gdiff += Math.abs(d); gn++;
}

// Mean |angular speed| (the magnitude-only, rate-based candidate metric): overall,
// ground, air. Absolute so back-and-forth rocking counts (not just net spin).
let aAll = 0, nAll = 0, aG = 0, nG = 0, aAir = 0, nAir = 0;
for (let f = 1; f <= F; f++) {
  const s = Math.abs(angVel[f]);
  aAll += s; nAll++;
  if (air[f]) { aAir += s; nAir++; } else { aG += s; nG++; }
}
const dpf = (x: number, n: number) => n ? x / n : 0;
const revs = (degPerFrame: number) => (degPerFrame * FPS) / 360; // rev/s
console.log(`  mean |angular speed|: overall ${dpf(aAll, nAll).toFixed(2)}°/f (${revs(dpf(aAll, nAll)).toFixed(2)} rev/s)  ground ${dpf(aG, nG).toFixed(2)}°/f  air ${dpf(aAir, nAir).toFixed(2)}°/f`);

const lenMin = Math.min(...sledLen.filter((x) => !isNaN(x))), lenMax = Math.max(...sledLen.filter((x) => !isNaN(x)));
console.log(`\n=== rotation study: ${trackPath}  (${(F / FPS).toFixed(1)}s, ${F}f) ===`);
console.log(`  sled rigidity: NOSE–TAIL len ${lenMin.toFixed(1)}–${lenMax.toFixed(1)}px (should be ~constant ⇒ clean angle)`);
console.log(`  GROUND validation: mean |sledAngle − velocityAngle| = ${(gdiff / Math.max(1, gn)).toFixed(1)}°  (small ⇒ sled follows surface, measure sane)`);
console.log(`  total angular travel ${totalAbs.toFixed(0)}° (${(totalAbs / 360).toFixed(2)} revolutions)   net over track ${(sled[F] - sled[0]).toFixed(0)}°`);
console.log(`  airborne arcs ${arcRows.length}   FLIPS (|net|>180° in one arc) ${flips}   biggest arc net rotation ${maxArcNet.toFixed(0)}°`);
const peaks = arcRows.map((r) => r.peak).sort((a, b) => a - b);
console.log(`  per-arc |net rotation| median ${arcRows.length ? Math.abs(arcRows.map(r=>r.netDeg).sort((a,b)=>Math.abs(a)-Math.abs(b))[arcRows.length>>1]).toFixed(1) : "n/a"}°   peak ang.vel median ${peaks.length ? peaks[peaks.length>>1].toFixed(1) : "n/a"}°/f`);
const top = [...arcRows].sort((a, b) => Math.abs(b.netDeg) - Math.abs(a.netDeg)).slice(0, 5);
for (const r of top) console.log(`    arc@${(r.f / FPS).toFixed(1)}s  net ${r.netDeg.toFixed(0).padStart(5)}°  |travel| ${r.absDeg.toFixed(0).padStart(4)}°  peak ${r.peak.toFixed(1)}°/f  air ${r.len}f`);

// Tail-/nose-stands: the sled held near-vertical (balanced on an end) while BOUNCING
// — ≥2 landings in a row — without tumbling. The "bounce on the back of the sled"
// behavior. Distinct from flips; harder to get than cheap air-rotation.
const stands = computeStands(sledAngRaw.slice(0, F + 1), air.slice(0, F + 1));
const standFrames = stands.reduce((s, e) => s + e.lengthFrames, 0);
console.log(`  STANDS (locked within 20° of vertical on one end, ≥2 landings): ${stands.length}  ` +
  `total ${(standFrames / FPS).toFixed(1)}s (${(100 * standFrames / Math.max(1, F)).toFixed(0)}% of ride)`);
for (const e of [...stands].sort((a, b) => b.lengthFrames - a.lengthFrames).slice(0, 6)) {
  console.log(`    stand@${(e.startFrame / FPS).toFixed(1)}s  ${(e.lengthFrames / FPS).toFixed(2)}s  ` +
    `${e.side.padEnd(4)}  ${e.landings} landings  ${e.meanUprightDeg.toFixed(0)}° from flat  ` +
    `${(e.inBandFraction * 100).toFixed(0)}% locked`);
}
