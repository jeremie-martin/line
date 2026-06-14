/**
 * Exit-state readout study (read-only).
 *
 * Three questions about the rider state the short probe launches its
 * ballistic completion from (docs/ARC_AIMING_FORMALIZATION.md):
 *
 *  1. Is the engine's `rider.velocity` readout exactly ballistic in free
 *     flight? (It is not: it oscillates with internal constraint dynamics,
 *     and carries a systematic extra downward acceleration.)
 *  2. How large and how systematic is the deviation? The per-run mean of
 *     `dvy - g` measures an effective-gravity correction; its one-sidedness
 *     across runs says whether a single constant can calibrate it.
 *  3. How much does a K-frame gravity-corrected launch estimator (average of
 *     K consecutive velocity READS, each compensated by g·k — engine states
 *     combined, no position differencing of our own) plus the calibrated
 *     constant improve launch→far-end velocity prediction?
 *
 * CAUTION (learned 2026-06-11): the per-run mean of `dvy - g` telescopes to
 * (vy(b) - vy(a)) / (b - a) — a decaying post-launch transient in the
 * velocity READ masquerades here as a per-frame acceleration bias. On probe
 * trajectories the signed error vs full-sim truth is CONSTANT in dt, so the
 * production correction is a constant launch-vy offset at the read
 * (arc_probe.ts LAUNCH_VY_OFFSET_PX), NOT the per-frame `--g-extra` this
 * study suggests. Keep this instrument for the per-frame oscillation and
 * estimator comparisons; do not promote its constant to propagation again.
 *
 * Calibrate and validate on DISJOINT spec sets: run once on the calibration
 * set (reads the recommended constant off the output), then again on the
 * validation set with `--g-extra=<constant>` to price it out-of-sample.
 *
 *   npm run study:exit-readout -- --specs=a,b,c --seeds=0,1 --budget=100000
 *   npm run study:exit-readout -- --specs=d,e,f --g-extra=0.0093
 */
import { loadGoldenSpec, GOLDEN_SPECS, type GoldenSpecName } from "./golden_suite.ts";
import { compileHandoff } from "./optimizer/handoff.ts";
import { detectWindow } from "./core/candidate.ts";
import { airborneAt } from "./core/substrate.ts";
import { getRiderMetered } from "../lib/detector.ts";
import { ELEVATION, type TrackLine } from "./types.ts";
import { LineRiderEngine, createLineFromJson } from "../lib/_lr_engine.ts";

const argv = process.argv.slice(2);
const argValue = (name: string): string | undefined =>
  argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const specNames = (argValue("specs") ?? "cold_start,verse_chorus,drums_dropout").split(",").filter(Boolean) as GoldenSpecName[];
const seeds = (argValue("seeds") ?? "0").split(",").filter(Boolean).map(Number);
const budget = Number(argValue("budget") ?? "100000");
const K = Number(argValue("k") ?? "4");
const MIN_RUN = Number(argValue("min-run") ?? "12");
const gExtraArg = argValue("g-extra");
const gExtraGiven = gExtraArg === undefined ? null : Number(gExtraArg);

for (const s of specNames) {
  if (!(GOLDEN_SPECS as readonly string[]).includes(s)) {
    console.error(`unknown spec "${s}"`);
    process.exit(1);
  }
}

const g = ELEVATION.GRAVITY_PX_PER_FRAME2;
const mean = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;
const rms = (xs: number[]): number => Math.sqrt(mean(xs.map((x) => x * x)));

type TrackJson = {
  startPosition?: { x: number; y: number };
  riders?: { startVelocity?: { x: number; y: number } }[];
  lines?: TrackLine[];
};

const devX: number[] = [];
const devY: number[] = [];
const runBiasY: number[] = [];
const launchErr = new Map<string, { dv: number[]; ang: number[] }>();
const addErr = (key: string, dv: number, ang: number): void => {
  const e = launchErr.get(key) ?? { dv: [], ang: [] };
  e.dv.push(dv);
  e.ang.push(ang);
  launchErr.set(key, e);
};
let totalRuns = 0;

for (const name of specNames) {
  const spec = await loadGoldenSpec(name, "base");
  for (const seed of seeds) {
    const track = (compileHandoff(spec, seed, { budget }) as { track: TrackJson }).track;
    let engine = new LineRiderEngine().setStart(
      track.startPosition ?? { x: 0, y: 0 },
      track.riders?.[0]?.startVelocity ?? { x: 0.4, y: 0 },
    );
    engine = engine.addLine((track.lines ?? []).map(createLineFromJson));
    const END = 3600;
    const det = detectWindow(engine, 0, END);

    const runs: Array<[number, number]> = [];
    let start: number | null = null;
    for (let f = 1; f <= END; f++) {
      const air = airborneAt(det, f) === true;
      if (air && start === null) start = f;
      if (!air && start !== null) {
        if (f - start >= MIN_RUN) runs.push([start + 2, f - 2]);
        start = null;
      }
    }
    totalRuns += runs.length;

    const vel = (f: number): { x: number; y: number } => {
      const r = getRiderMetered(engine, f);
      return { x: r.velocity.x, y: r.velocity.y };
    };
    const estVel = (f0: number): { x: number; y: number } => {
      let sx = 0, sy = 0;
      for (let k = 0; k < K; k++) {
        const v = vel(f0 + k);
        sx += v.x;
        sy += v.y - g * k;
      }
      return { x: sx / K, y: sy / K };
    };

    for (const [a, b] of runs) {
      const dys: number[] = [];
      for (let f = a + 1; f <= b; f++) {
        const v0 = vel(f - 1);
        const v1 = vel(f);
        devX.push(v1.x - v0.x);
        devY.push(v1.y - v0.y - g);
        dys.push(v1.y - v0.y - g);
      }
      runBiasY.push(mean(dys));

      const dt = b - K + 1 - a;
      if (dt < 6) continue;
      const truthV = estVel(b - K + 1);
      const ang = (v: { x: number; y: number }): number => Math.atan2(v.y, v.x) * 180 / Math.PI;
      const judge = (pred: { x: number; y: number }, key: string): void =>
        addErr(key, Math.hypot(pred.x - truthV.x, pred.y - truthV.y), Math.abs(ang(pred) - ang(truthV)));

      const rawV = vel(a);
      const estV = estVel(a);
      judge({ x: rawV.x, y: rawV.y + g * dt }, "single-frame read");
      judge({ x: estV.x, y: estV.y + g * dt }, `${K}-frame estimator`);
      if (gExtraGiven !== null) {
        judge({ x: estV.x, y: estV.y + (g + gExtraGiven) * dt }, `${K}-frame + g-extra(${gExtraGiven})`);
      }
    }
  }
}

console.log(`=== exit-state readout study`);
console.log(`specs=${specNames.join(",")} seeds=${seeds.join(",")} budget=${budget} K=${K} min_run=${MIN_RUN}`);
console.log(`airborne runs(>=${MIN_RUN}f)=${totalRuns} increment samples=${devX.length} g=${g}`);
console.log(`\nper-frame velocity increment vs exact ballistic:`);
console.log(`  dvx      mean ${mean(devX).toFixed(5)}  rms ${rms(devX).toFixed(5)} px/f`);
console.log(`  dvy - g  mean ${mean(devY).toFixed(5)}  rms ${rms(devY).toFixed(5)} px/f`);
const pos = runBiasY.filter((x) => x > 0).length;
console.log(
  `\nper-run mean(dvy-g): positive ${pos}/${runBiasY.length}, mean ${mean(runBiasY).toFixed(5)}, ` +
    `rms ${rms(runBiasY).toFixed(5)}`,
);
console.log(`recommended calibration constant (use as --g-extra on the validation set): ${mean(runBiasY).toFixed(5)}`);
console.log(`\nlaunch->far-end velocity prediction:`);
for (const [key, e] of launchErr) {
  console.log(`  ${key.padEnd(28)} |dv| MAE ${mean(e.dv).toFixed(4)} px/f  angle MAE ${mean(e.ang).toFixed(4)} deg  (n=${e.dv.length})`);
}
