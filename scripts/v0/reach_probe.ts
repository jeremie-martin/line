/**
 * Phase A probe for margin-based backward reachability
 * (search_rethink_state_handoff.md §5.B; plan: backward-reachability).
 *
 * NO compiler behavior change: this calls `compileHandoff` exactly as the
 * golden harness does, captures the winning full-duration node via the `onNode`
 * hook, then — entirely OUTSIDE the metered search — computes the per-gap
 * catchable regions and measures, for each committed contact on the winning
 * track, how far its post-catch exit state sits from the NEXT contact's region
 * (the reachability margin). It then asks the §5.B question:
 *
 *   Do higher-quality tracks have systematically DEEPER margins (lower penalty)?
 *   Which reduced-state dims carry that signal? Does the per-gap-duration bucket
 *   matter (the region ignores contact-frame budget)? What does the region pass
 *   cost in sim-frames?
 *
 * Usage:
 *   npx tsx scripts/v0/reach_probe.ts [--specs=a,b,c] [--seeds=0,1,2] [--budget=150000]
 */

import { resolve } from "node:path";
import { makeRng } from "../lib/rng.ts";
import {
  effectiveAxes,
  sampleGapTargets,
  sliceTimeline,
} from "./core/substrate.ts";
import { CALIB, secToFrame, type Gap, type Spec } from "./types.ts";
import { compileHandoff, type HandoffNode } from "./optimizer/handoff.ts";
import { isStrictlyBetter, type LeafKey } from "./optimizer/register.ts";
import { scoreDriftReport } from "./score.ts";
import { getSimFrames, resetSimFrames } from "./optimizer/sim_frames.ts";
import {
  getRegion,
  HANDOFF_SETTLE_FRAMES,
  readHandoffState,
  reachabilityPenalty,
  resetReachabilityCache,
  snapshotReachabilityStats,
  stateDistance,
  type HandoffState,
  type ReachabilityRegion,
} from "./optimizer/reachability.ts";

const DEFAULT_SPECS = [
  "drums_pendulum", "drums_crescendo", "grain_staircase", "rhythm_ladder",
  "syncopated_switchback", "drums_signature", "dense_sprint", "opening_burst",
  "drums_tide", "drums_dropout",
];

function argVal(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

async function loadSpec(name: string): Promise<Spec> {
  const mod = await import(resolve("specs/golden", `${name}.ts`));
  return mod.default as Spec;
}

function buildGaps(spec: Spec, seed: number): Gap[] {
  const df = secToFrame(spec.duration);
  const cf = [...spec.contacts].map((c) => secToFrame(c.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(cf, df);
  const rng = makeRng(seed);
  for (const g of gaps) g.targets = sampleGapTargets(effectiveAxes(g, spec), spec.jitter ?? CALIB.SIGMA, rng);
  return gaps;
}

function nextContactGapIndex(gaps: Gap[], from: number): number {
  for (let i = from; i < gaps.length; i++) if (gaps[i].endsWithContact) return i;
  return -1;
}

/** Per-dim nearest-sample distance components for a given exit vs region. */
function dimComponents(exit: HandoffState, region: ReachabilityRegion): { dSpeed: number; dAngle: number; dVy: number } | null {
  if (region.samples.length === 0) return null;
  let best = Infinity;
  let bestS = region.samples[0];
  for (const s of region.samples) {
    const d = stateDistance(exit, s);
    if (d < best) { best = d; bestS = s; }
  }
  return {
    dSpeed: Math.abs(exit.speed - bestS.speed) / 8,
    dAngle: Math.abs(((exit.angleDeg - bestS.angleDeg + 540) % 360) - 180) / 90,
    dVy: Math.abs(exit.vy - bestS.vy) / 10,
  };
}

type ContactPair = { margin: number; ownErr: number; nextErr: number; dur: number };

type RowResult = {
  spec: string;
  seed: number;
  axisQuality: number;
  score: number;
  passed: boolean;
  meanMargin: number;
  marginByDurBucket: Map<string, number[]>;
  dim: { dSpeed: number; dAngle: number; dVy: number };
  regionCostFrames: number;
  contactCount: number;
  perContact: ContactPair[];
};

/** RMS over a gap's targeted axes of |achieved-target|, matching axis_quality's basis. */
function gapLocalError(axes: { [a: string]: { target: number; achieved: number; error: number } }): number {
  const errs = Object.values(axes).map((a) => a.error);
  if (errs.length === 0) return 0;
  return Math.sqrt(errs.reduce((s, e) => s + e * e, 0) / errs.length);
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return NaN;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
}

function durBucket(frames: number): string {
  if (frames < 20) return "<20";
  if (frames < 40) return "20-39";
  if (frames < 60) return "40-59";
  return ">=60";
}

async function probeRow(specName: string, seed: number, budget: number): Promise<RowResult> {
  const spec = await loadSpec(specName);

  // 1) Compile exactly as the harness does; capture the best full-duration node.
  let bestNode: HandoffNode | null = null;
  let bestKey: LeafKey | null = null;
  const last = compileHandoff(spec, seed, {
    budget,
    onNode: (node, key, event) => {
      if (!event.fullDuration) return;
      if (bestKey === null || isStrictlyBetter(key, bestKey)) {
        bestNode = node;
        bestKey = key;
      }
    },
  });
  const sc = scoreDriftReport(last.report);

  // 2) OUTSIDE the metered search: build gaps + regions, measure region cost.
  const gaps = buildGaps(spec, seed);
  resetReachabilityCache();
  resetSimFrames();
  const contactIdx = gaps.map((g, i) => ({ g, i })).filter((x) => x.g.endsWithContact).map((x) => x.i);
  for (const i of contactIdx) getRegion(gaps, seed, i); // build all (chained)
  const regionCostFrames = getSimFrames();

  // 3) For each committed contact on the winning track, exit margin into next region.
  const margins: number[] = [];
  const marginByDurBucket = new Map<string, number[]>();
  const dimSum = { dSpeed: 0, dAngle: 0, dVy: 0 };
  let dimN = 0;
  const perContact: ContactPair[] = [];
  // Per-gap local error from the SAME winning track's report.
  const errByGap = new Map<number, number>();
  for (const g of last.report.gaps) errByGap.set(g.gap_index, gapLocalError(g.axes));
  const node = bestNode as HandoffNode | null;
  if (node !== null) {
    for (const i of contactIdx) {
      const next = nextContactGapIndex(gaps, i + 1);
      if (next < 0) continue;
      const region = getRegion(gaps, seed, next);
      const exit = readHandoffState(node.search.prefixEngine, gaps[i].endFrame + HANDOFF_SETTLE_FRAMES);
      const pen = reachabilityPenalty(exit, region);
      margins.push(pen);
      const b = durBucket(gaps[i].endFrame - gaps[i].startFrame);
      if (!marginByDurBucket.has(b)) marginByDurBucket.set(b, []);
      marginByDurBucket.get(b)!.push(pen);
      const dc = dimComponents(exit, region);
      if (dc) { dimSum.dSpeed += dc.dSpeed; dimSum.dAngle += dc.dAngle; dimSum.dVy += dc.dVy; dimN++; }
      perContact.push({
        margin: pen,
        ownErr: errByGap.get(i) ?? NaN,
        nextErr: errByGap.get(next) ?? NaN,
        dur: gaps[i].endFrame - gaps[i].startFrame,
      });
    }
  }
  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);

  return {
    spec: specName, seed,
    axisQuality: sc.axis_quality, score: sc.score, passed: sc.contract_passed,
    meanMargin: mean(margins),
    marginByDurBucket,
    dim: { dSpeed: dimN ? dimSum.dSpeed / dimN : NaN, dAngle: dimN ? dimSum.dAngle / dimN : NaN, dVy: dimN ? dimSum.dVy / dimN : NaN },
    regionCostFrames,
    contactCount: contactIdx.length,
    perContact,
  };
}

const specs = argVal("specs", DEFAULT_SPECS.join(",")).split(",");
const seeds = argVal("seeds", "0,1,2").split(",").map((s) => parseInt(s, 10));
const budget = parseInt(argVal("budget", "150000"), 10);

const rows: RowResult[] = [];
for (const s of specs) {
  for (const seed of seeds) {
    const r = await probeRow(s, seed, budget);
    rows.push(r);
    console.log(
      `${(s + " s" + seed).padEnd(30)} axisQ=${r.axisQuality.toFixed(3)} score=${r.score.toFixed(1)} ` +
      `pass=${r.passed ? 1 : 0} meanMargin=${r.meanMargin.toFixed(3)} ` +
      `dim(spd=${r.dim.dSpeed.toFixed(3)} ang=${r.dim.dAngle.toFixed(3)} vy=${r.dim.dVy.toFixed(3)}) ` +
      `regionCost=${r.regionCostFrames} contacts=${r.contactCount}`,
    );
  }
}

// ── §5.B premise test: correlation of margin vs quality across rows ─────────────
const valid = rows.filter((r) => Number.isFinite(r.meanMargin));
const aq = valid.map((r) => r.axisQuality);
const mm = valid.map((r) => r.meanMargin);
console.log("\n=== §5.B premise: do higher-quality tracks have deeper margins? ===");
console.log(`Pearson(axisQuality, meanMargin) = ${pearson(aq, mm).toFixed(3)} (want NEGATIVE: higher quality -> lower margin)`);
console.log(`Pearson(score, meanMargin)       = ${pearson(valid.map((r) => r.score), mm).toFixed(3)}`);

// Split at median axisQuality; compare margins + per-dim of top vs bottom half.
const sorted = [...valid].sort((a, b) => a.axisQuality - b.axisQuality);
const half = Math.floor(sorted.length / 2);
const lo = sorted.slice(0, half), hi = sorted.slice(sorted.length - half);
const avg = (a: RowResult[], f: (r: RowResult) => number) => a.reduce((x, r) => x + f(r), 0) / a.length;
console.log("\n=== bottom vs top quality half ===");
console.log(`meanMargin   low=${avg(lo, (r) => r.meanMargin).toFixed(3)}  high=${avg(hi, (r) => r.meanMargin).toFixed(3)}`);
console.log(`dim.speed    low=${avg(lo, (r) => r.dim.dSpeed).toFixed(3)}  high=${avg(hi, (r) => r.dim.dSpeed).toFixed(3)}`);
console.log(`dim.angle    low=${avg(lo, (r) => r.dim.dAngle).toFixed(3)}  high=${avg(hi, (r) => r.dim.dAngle).toFixed(3)}`);
console.log(`dim.vy       low=${avg(lo, (r) => r.dim.dVy).toFixed(3)}  high=${avg(hi, (r) => r.dim.dVy).toFixed(3)}`);

// Margin by gap-duration bucket (tests the hidden contact-frame axis).
const bucketAgg = new Map<string, number[]>();
for (const r of valid) for (const [b, arr] of r.marginByDurBucket) {
  if (!bucketAgg.has(b)) bucketAgg.set(b, []);
  bucketAgg.get(b)!.push(...arr);
}
console.log("\n=== margin by gap-duration bucket (frames) ===");
for (const b of ["<20", "20-39", "40-59", ">=60"]) {
  const arr = bucketAgg.get(b);
  if (arr && arr.length) console.log(`  ${b.padEnd(6)} n=${String(arr.length).padStart(4)} meanMargin=${(arr.reduce((x, y) => x + y, 0) / arr.length).toFixed(3)}`);
}

// ── Decisive per-contact test (pooled across all tracks; controls for spec) ─────
const pairs = rows.flatMap((r) => r.perContact).filter((p) => Number.isFinite(p.margin) && Number.isFinite(p.nextErr) && Number.isFinite(p.ownErr));
console.log("\n=== per-contact (pooled, n=" + pairs.length + "): does exit-margin predict trouble? ===");
console.log(`Pearson(margin_i, nextContactError) = ${pearson(pairs.map((p) => p.margin), pairs.map((p) => p.nextErr)).toFixed(3)} (want POSITIVE: far exit -> harder next contact)`);
console.log(`Pearson(margin_i, ownContactError)  = ${pearson(pairs.map((p) => p.margin), pairs.map((p) => p.ownErr)).toFixed(3)}`);
// Margin quartiles vs mean next-contact error.
const byMargin = [...pairs].sort((a, b) => a.margin - b.margin);
const q = (lo: number, hi: number) => {
  const slice = byMargin.slice(Math.floor(lo * byMargin.length), Math.floor(hi * byMargin.length));
  const m = slice.reduce((s, p) => s + p.margin, 0) / slice.length;
  const e = slice.reduce((s, p) => s + p.nextErr, 0) / slice.length;
  return `margin=${m.toFixed(3)} nextErr=${e.toFixed(3)} (n=${slice.length})`;
};
console.log(`  lowest-margin quartile : ${q(0, 0.25)}`);
console.log(`  2nd quartile           : ${q(0.25, 0.5)}`);
console.log(`  3rd quartile           : ${q(0.5, 0.75)}`);
console.log(`  highest-margin quartile: ${q(0.75, 1.0)}`);

const costs = rows.map((r) => r.regionCostFrames);
console.log("\n=== region build cost (sim-frames) ===");
console.log(`  per-row mean=${Math.round(costs.reduce((a, b) => a + b, 0) / costs.length)} min=${Math.min(...costs)} max=${Math.max(...costs)} (vs 150k budget)`);
console.log(`  reachability stats (last row): ${JSON.stringify(snapshotReachabilityStats())}`);
