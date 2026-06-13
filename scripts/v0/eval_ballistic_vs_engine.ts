/**
 * eval_ballistic_vs_engine.ts — a CLEAN, controlled test of the airborne ballistic model
 * against the engine, isolating MODEL error from LAUNCH-READ error.
 *
 * Method: compile a track (big_air_ramp), take its engine, and for every airborne stretch:
 *   launch = readArrivalState(engine, f0)            // the EXACT engine state at the first airborne frame
 *   for dt = 0..len:
 *     pred = propagateBallisticArrivalState(launch, dt)   // the PRODUCTION ballistic model
 *     act  = readArrivalState(engine, f0 + dt)            // the SAME reader, engine truth
 *     compare pred vs act (vy, y)
 *
 * Why this is the decisive test:
 *  - SAME reader (readArrivalState) on both sides, SAME launch frame -> dt=0 error is EXACTLY 0
 *    (pred(launch,0) === launch === act(f0)). That kills the Verlet/frame-offset confound the
 *    previous agent hit, AND removes the launch-read smoothing/offset entirely (we feed the model
 *    the engine's own state, not the 4-frame gravity-corrected read).
 *  - So any dt>0 error is PURE MODEL error: does the engine's free flight actually follow the
 *    constant-gravity point-projectile the model assumes? If error stays ~0 -> model is exact and
 *    the golden air residual is entirely the LAUNCH READ (matches the propagateBallisticArrivalState
 *    comment). If error GROWS with dt -> there is a real in-flight model error (sled/CoM, drag, or
 *    an integration mismatch), and effective-g/model work is on the table after all.
 *
 * Run: LR_ENGINE=wasm npx tsx scripts/v0/eval_ballistic_vs_engine.ts
 */
import { loadGoldenSpec } from "./golden_suite.ts";
import { compileHandoff, type HandoffNode } from "./optimizer/handoff.ts";
import { isStrictlyBetter, type LeafKey } from "./optimizer/register.ts";
import { detectWindow } from "./core/candidate.ts";
import { airborneAt } from "./core/substrate.ts";
import { readArrivalState } from "./optimizer/arc_probe.ts";
import { propagateBallisticArrivalState } from "./optimizer/arc_model.ts";
import { FPS } from "./types.ts";

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

console.log(`eval_ballistic_vs_engine — PURE model error (exact engine state, exact alignment)`);
console.log(`spec=${SPEC} seed=${SEED} budget=${BUDGET}  durationFrames=${durationFrames}`);
console.log(`airborne stretches (>=${MIN_STRETCH}f): ${stretches.length}`);

// Aggregate the signed/abs vy error and abs y error by dt across all stretches.
const byDt = new Map<number, { vy: number[]; y: number[]; speed: number[] }>();
let g0vy = 0, g0y = 0, used = 0;
for (const [s0, s1] of stretches) {
  const launch = readArrivalState(engine, s0);
  if (launch === null) continue;
  used++;
  for (let dt = 0; dt <= s1 - s0; dt++) {
    const pred = propagateBallisticArrivalState(launch, dt);
    const act = readArrivalState(engine, s0 + dt);
    if (act === null) break;
    const vyErr = pred.vy - act.vy;
    const yErr = pred.y - act.y;
    const speedErr = pred.speed - act.speed;
    if (dt === 0) { g0vy = Math.max(g0vy, Math.abs(vyErr)); g0y = Math.max(g0y, Math.abs(yErr)); }
    const b = byDt.get(dt) ?? { vy: [], y: [], speed: [] };
    b.vy.push(vyErr); b.y.push(yErr); b.speed.push(speedErr);
    byDt.set(dt, b);
  }
}

const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const meanAbs = (a: number[]) => (a.length ? a.reduce((s, x) => s + Math.abs(x), 0) / a.length : 0);

console.log(`\nGUARDRAIL dt=0:  max|vyErr|=${g0vy.toExponential(2)}  max|yErr|=${g0y.toExponential(2)}  (MUST be ~0 by construction)`);
console.log(`\n  dt    n   mean(vyErr)  mean|vyErr|  mean|yErr|  mean|speedErr|   (pred − engine; vy/speed px/f, y px)`);
const DTS = [0, 1, 2, 3, 5, 8, 12, 16, 20, 25, 30, 40];
for (const dt of DTS) {
  const b = byDt.get(dt);
  if (!b) continue;
  console.log(
    `  ${String(dt).padStart(3)} ${String(b.vy.length).padStart(4)}  ` +
    `${mean(b.vy).toFixed(4).padStart(10)}  ${meanAbs(b.vy).toFixed(4).padStart(10)}  ` +
    `${meanAbs(b.y).toFixed(3).padStart(9)}  ${meanAbs(b.speed).toFixed(4).padStart(12)}`,
  );
}

// VERDICT — use the SIGNED error (mean|·| is misleading: it dips near the sign-crossover ~dt3-5,
// then rises, which masquerades as "growth"). The real question: AFTER the launch transient (~8f),
// is the SIGNED vy error a CONSTANT offset (launch/transition class — a per-frame effective-g
// correction would OVER-correct, the wrong lever) or still drifting per-frame (a true in-flight
// acceleration/model error — effective-g class)?
const sgn = (dt: number) => mean(byDt.get(dt)?.vy ?? []);
const s8 = sgn(8), s12 = sgn(12), s20 = sgn(20), s25 = sgn(25);
const driftPerFrame = Math.abs((s25 - s12) / 13);
console.log(`\nsigned vyErr after transient:  dt8=${s8.toFixed(4)}  dt12=${s12.toFixed(4)}  dt20=${s20.toFixed(4)}  dt25=${s25.toFixed(4)}`);
console.log(`drift dt12->25 = ${driftPerFrame.toFixed(5)} px/f per frame`);
console.log(driftPerFrame < 0.002
  ? `VERDICT: signed vy error = a launch TRANSIENT (first ~8f) settling to a ~CONSTANT offset (~${s20.toFixed(3)} px/f).\n` +
    `  NOT a per-frame acceleration -> effective-g is the WRONG lever (matches the falsified result\n` +
    `  documented in propagateBallisticArrivalState). The only lever is the launch/transition read.`
  : `VERDICT: signed vy error keeps drifting per-frame -> a real in-flight acceleration/model error (effective-g class).`);
