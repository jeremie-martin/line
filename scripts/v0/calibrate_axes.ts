/**
 * Axis calibration probe — measure the ACHIEVABLE envelope of each axis.
 *
 * Specs author axis targets in [0,1], but the engine only realizes a sub-range
 * (low `air` is unreachable; `speed` overshoots 1.0; `contact_style` is bimodal).
 * To map author-[0,1] onto a feasible engine band we first need the true
 * achievable distribution per axis.
 *
 * Method (isolated, prefix-independent, no compiler change): for each real gap
 * (workbench specs, for realistic durations/target frames) sweep a grid of entry
 * velocities and, per entry, many arc shapes (random target vectors drive the
 * sampler's impactT/segment choices). Every viable LANDING catch reports all
 * four achieved axes (measureGapAxes runs regardless of targeting), so we pool
 * them: the envelope of axis values reachable by a valid catch.
 *
 * Caveat: isolated-origin (no prefix terrain) — a first calibration. Bucketed by
 * gap duration since air feasibility is duration-dependent.
 *
 * Usage: npx tsx scripts/v0/calibrate_axes.ts [--specs=a,b] [--seed=0]
 *        [--entries-attempts=8] [--max-gaps=24]
 */

import { resolve } from "node:path";
import { makeRng } from "../lib/rng.ts";
import {
  effectiveAxes,
  makeBaseEngine,
  sampleGapTargets,
  sliceTimeline,
} from "./core/substrate.ts";
import {
  axisLookaheadEndFrame,
  readTargetState,
  sampleArcParams,
  tryCandidate,
} from "./core/candidate.ts";
import { AXES, CALIB, FPS, secToFrame, type AxisName, type Gap, type Spec } from "./types.ts";
import { getSimFrames, resetSimFrames } from "./optimizer/sim_frames.ts";

const DEFAULT_SPECS = [
  "drums_pendulum",        // long gaps, air extremes (0.15/0.85)
  "syncopated_switchback", // short, dense gaps
  "grain_staircase",       // grain sweep
  "rhythm_ladder",         // contact_style mix
  "dense_sprint",          // dense/start
  "drums_tide",            // curve-native
];

const ENTRY_SPEEDS = [2, 4, 6, 8, 10, 12]; // px/frame
const ENTRY_ANGLES = [0, 15, 30, 45, 60];  // degrees

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

async function loadSpec(name: string): Promise<Spec> {
  return (await import(resolve("specs/golden", `${name}.ts`))).default as Spec;
}

function buildGaps(spec: Spec, seed: number): Gap[] {
  const df = secToFrame(spec.duration);
  const cf = [...spec.contacts].map((c) => secToFrame(c.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(cf, df);
  const rng = makeRng(seed);
  for (const g of gaps) g.targets = sampleGapTargets(effectiveAxes(g, spec), spec.jitter ?? CALIB.SIGMA, rng);
  return gaps;
}

function durBucket(frames: number): string {
  const s = frames / FPS;
  return s < 0.4 ? "<0.4s" : s < 0.8 ? "0.4-0.8s" : s < 1.2 ? "0.8-1.2s" : ">=1.2s";
}

function push(map: Map<string, number[]>, key: string, v: number): void {
  let arr = map.get(key);
  if (arr === undefined) { arr = []; map.set(key, arr); }
  arr.push(v);
}

function pct(arr: number[], p: number): number {
  const s = [...arr].sort((x, y) => x - y);
  return s[Math.floor(p * (s.length - 1))];
}

const seed = parseInt(arg("seed", "0"), 10);
const attemptsPerEntry = parseInt(arg("entries-attempts", "8"), 10);
const maxGaps = parseInt(arg("max-gaps", "24"), 10);
const specs = arg("specs", DEFAULT_SPECS.join(",")).split(",");

const achieved: Record<AxisName, number[]> = { air: [], speed: [], contact_style: [], grain: [] };
const airByDur = new Map<string, number[]>();
const speedByDur = new Map<string, number[]>();
let viable = 0, attempts = 0;

resetSimFrames();
for (const specName of specs) {
  const spec = await loadSpec(specName);
  const gaps = buildGaps(spec, seed);
  const contactGaps = gaps.filter((g) => g.endsWithContact);
  const stride = Math.max(1, Math.floor(contactGaps.length / maxGaps));
  const sampled = contactGaps.filter((_, i) => i % stride === 0).slice(0, maxGaps);
  for (const gap of sampled) {
    const durFrames = Math.max(1, gap.endFrame - gap.startFrame);
    const local: Gap = { index: gap.index, startFrame: 0, endFrame: durFrames, endsWithContact: true, targets: { ...gap.targets } };
    const rng = makeRng((seed | 0) * 2_654_435_761 + gap.index * 40_503 + 1);
    for (const speed of ENTRY_SPEEDS) {
      for (const angleDeg of ENTRY_ANGLES) {
        const rad = (angleDeg * Math.PI) / 180;
        const engine = makeBaseEngine({ position: { x: 0, y: 0 }, velocity: { x: speed * Math.cos(rad), y: speed * Math.sin(rad) } });
        const ts = readTargetState(engine, durFrames, 0, 0);
        const axisMeasureEnd = axisLookaheadEndFrame(local, [durFrames]);
        for (let a = 0; a < attemptsPerEntry; a++) {
          attempts++;
          // Random target vector drives the sampler's shape choices (impactT from
          // contact_style, segment count from grain) to sweep reachable geometry.
          const sweep = { air: rng(), speed: rng(), contact_style: rng(), grain: rng() };
          const sweptGap: Gap = { ...local, targets: sweep };
          const arc = sampleArcParams(rng, ts.sledX, ts.sledY, sweep, ts, a, sweptGap);
          const fit = tryCandidate(engine, sweptGap, arc, 1, [durFrames], axisMeasureEnd, sweep, true);
          if (fit === null) continue;
          viable++;
          for (const ax of AXES) {
            const v = fit.achieved[ax];
            if (v !== undefined) achieved[ax].push(v);
          }
          const b = durBucket(durFrames);
          if (fit.achieved.air !== undefined) push(airByDur, b, fit.achieved.air);
          if (fit.achieved.speed !== undefined) push(speedByDur, b, fit.achieved.speed);
        }
      }
    }
  }
}

console.log(`specs=${specs.join(",")} seed=${seed} attemptsPerEntry=${attemptsPerEntry} maxGaps=${maxGaps}`);
console.log(`attempts=${attempts} viable=${viable} (${(100 * viable / attempts).toFixed(1)}% landed) simFrames=${getSimFrames()}`);
console.log("\n=== achievable envelope per axis (from viable landing catches) ===");
for (const ax of AXES) {
  const a = achieved[ax];
  if (!a.length) { console.log(ax, "no data"); continue; }
  console.log(`${ax.padEnd(14)} n=${String(a.length).padStart(6)} ` +
    `min=${pct(a, 0).toFixed(3)} p02=${pct(a, 0.02).toFixed(3)} p10=${pct(a, 0.10).toFixed(3)} ` +
    `p50=${pct(a, 0.50).toFixed(3)} p90=${pct(a, 0.90).toFixed(3)} p98=${pct(a, 0.98).toFixed(3)} max=${pct(a, 1).toFixed(3)}`);
}

console.log("\n=== air achievable by gap duration (the context axis) ===");
for (const b of ["<0.4s", "0.4-0.8s", "0.8-1.2s", ">=1.2s"]) {
  const a = airByDur.get(b);
  if (a && a.length) console.log(`  ${b.padEnd(9)} n=${String(a.length).padStart(6)} floor(p02)=${pct(a, 0.02).toFixed(3)} p10=${pct(a, 0.10).toFixed(3)} p50=${pct(a, 0.5).toFixed(3)} ceil(p98)=${pct(a, 0.98).toFixed(3)}`);
}
console.log("\n=== speed achievable by gap duration ===");
for (const b of ["<0.4s", "0.4-0.8s", "0.8-1.2s", ">=1.2s"]) {
  const a = speedByDur.get(b);
  if (a && a.length) console.log(`  ${b.padEnd(9)} n=${String(a.length).padStart(6)} p02=${pct(a, 0.02).toFixed(3)} p50=${pct(a, 0.5).toFixed(3)} p98=${pct(a, 0.98).toFixed(3)}`);
}

const cs = achieved.contact_style;
if (cs.length) {
  const near0 = cs.filter((v) => v < 0.15).length, mid = cs.filter((v) => v >= 0.15 && v <= 0.85).length, near1 = cs.filter((v) => v > 0.85).length;
  console.log(`\n=== contact_style shape: near0=${(100 * near0 / cs.length).toFixed(0)}% mid=${(100 * mid / cs.length).toFixed(0)}% near1=${(100 * near1 / cs.length).toFixed(0)}% (bimodal if mid is small) ===`);
}
