/**
 * Landing-window prize study (read-only diagnostic for the landing-redefinition
 * project — docs/archive/impact-generation-and-landing-notes-2026-06-09.md,
 * ladder B/C sizing).
 *
 * Question: how much otherwise-viable arc material does the ±1-frame acceptance
 * gate throw away, and is the discarded material richer in achieved impact than
 * the accepted pool?
 *
 * Method: enable the landing-window probe in core/candidate.ts (records, for
 * every candidate geometry that passes the survival gate, the minimal lockstep
 * half-width W ∈ [1,5] that would admit it — landing on an owned line within ±W
 * of the beat AND zero off-beat landings at tolerance W), run real compiles over
 * golden specs, and aggregate. W=1 reproduces today's hard gates, so the W=1
 * tier is the accepted pool and W∈[2,5] tiers are the timing-only rejects.
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_landing_window.ts \
 *     [--specs=drums_signature,opening_burst] [--seeds=0,1,2] [--budget=50000]
 *
 * The probe is observation-only: compiles are byte-identical to production.
 */
import {
  drainLandingWindowProbe,
  enableLandingWindowProbe,
  LANDING_PROBE_MAX_W,
  type LandingWindowProbeRecord,
} from "./landing_probe.ts";
import { compileHandoff } from "./optimizer/handoff.ts";
import { GOLDEN_SPECS, loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";

const argv = process.argv.slice(2);

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

const specNames = (argValue("specs")?.split(",") ?? [...GOLDEN_SPECS]) as GoldenSpecName[];
const seeds = (argValue("seeds") ?? "0,1,2").split(",").map(Number);
const budget = Number(argValue("budget") ?? "50000");
if (!Number.isFinite(budget) || seeds.some((s) => !Number.isInteger(s))) {
  console.error("usage: LR_ENGINE=wasm npx tsx scripts/v0/study_landing_window.ts [--specs=a,b] [--seeds=0,1] [--budget=50000]");
  process.exit(1);
}

function fmt(x: number, digits = 3): string {
  return Number.isFinite(x) ? x.toFixed(digits) : "n/a";
}

function mean(xs: number[]): number {
  return xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

function pct(xs: number[], p: number): number {
  if (xs.length === 0) return NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

// ─────────── accumulators ───────────

type GapKey = string; // spec/seed/gapIndex

type GapAgg = {
  targetImpact: number | undefined;
  /** Best (max) achieved impact among candidates admitted at minimal W ≤ k. */
  bestImpactAtW: number[]; // index 0 unused; [1..MAX_W]
  /** Best closeness |target − achieved| among candidates admitted at minimal W ≤ k. */
  bestCloseAtW: number[];
  poolAtW: number[]; // candidate count with acceptedAtW ≤ k
};

/** Per-gap candidate detail for gaps that saw ≥1 template-lane record
 *  (selection analysis: do viable templates lose the cost ranking, and by how much?). */
type CandDetail = {
  isTemplate: boolean;
  impact: number | null;
  cost: number | null;
  w: number | null;
  handoff: number | undefined;
};
const templateGapDetail = new Map<GapKey, CandDetail[]>();
const gapsWithTemplates = new Set<GapKey>();

const tierCounts = new Array(LANDING_PROBE_MAX_W + 1).fill(0); // [1..5] = minimal-W tier sizes
let rejectedCount = 0; // survival-passing but not admitted even at MAX_W
let recordTotal = 0;
let droppedTotal = 0;
const tierImpacts: number[][] = Array.from({ length: LANDING_PROBE_MAX_W + 1 }, () => []);
const tierImpactsHighTarget: number[][] = Array.from({ length: LANDING_PROBE_MAX_W + 1 }, () => []);
const tierSpeeds: number[][] = Array.from({ length: LANDING_PROBE_MAX_W + 1 }, () => []);
const offsetCounts = new Map<number, number>(); // signed offsets of W≥2 admissions
const gapAggs = new Map<GapKey, GapAgg>();
let sampledTotal = 0;
let viableTotal = 0;

function accumulate(specName: string, seed: number, records: LandingWindowProbeRecord[]): void {
  for (const r of records) {
    const gkey: GapKey = `${specName}/${seed}/${r.gapIndex}`;
    let detail = templateGapDetail.get(gkey);
    if (detail === undefined) {
      detail = [];
      templateGapDetail.set(gkey, detail);
    }
    detail.push({
      isTemplate: r.isTemplate, impact: r.impactAchieved, cost: r.cost,
      w: r.acceptedAtW, handoff: r.handoffScore,
    });
    if (r.isTemplate) gapsWithTemplates.add(gkey);
    recordTotal++;
    if (r.acceptedAtW === null) {
      rejectedCount++;
      continue;
    }
    const w = r.acceptedAtW;
    tierCounts[w]++;
    if (r.impactAchieved !== null) {
      tierImpacts[w].push(r.impactAchieved);
      if (r.targetImpact !== undefined && r.targetImpact >= 0.55) {
        tierImpactsHighTarget[w].push(r.impactAchieved);
      }
    }
    if (r.incomingSpeed !== null) tierSpeeds[w].push(r.incomingSpeed);
    if (w >= 2 && r.offset !== null) {
      offsetCounts.set(r.offset, (offsetCounts.get(r.offset) ?? 0) + 1);
    }

    const key: GapKey = `${specName}/${seed}/${r.gapIndex}`;
    let agg = gapAggs.get(key);
    if (agg === undefined) {
      agg = {
        targetImpact: r.targetImpact,
        bestImpactAtW: new Array(LANDING_PROBE_MAX_W + 1).fill(-Infinity),
        bestCloseAtW: new Array(LANDING_PROBE_MAX_W + 1).fill(Infinity),
        poolAtW: new Array(LANDING_PROBE_MAX_W + 1).fill(0),
      };
      gapAggs.set(key, agg);
    }
    // A candidate with minimal W contributes to every pool with k ≥ W.
    for (let k = w; k <= LANDING_PROBE_MAX_W; k++) {
      agg.poolAtW[k]++;
      if (r.impactAchieved !== null) {
        agg.bestImpactAtW[k] = Math.max(agg.bestImpactAtW[k], r.impactAchieved);
        if (agg.targetImpact !== undefined) {
          agg.bestCloseAtW[k] = Math.min(agg.bestCloseAtW[k], Math.abs(agg.targetImpact - r.impactAchieved));
        }
      }
    }
  }
}

// ─────────── sweep ───────────

enableLandingWindowProbe();

for (const specName of specNames) {
  const spec = await loadGoldenSpec(specName, "base");
  for (const seed of seeds) {
    const t0 = Date.now();
    const checkpoint = compileHandoff(spec, seed, { budget });
    const { records, dropped } = drainLandingWindowProbe();
    droppedTotal += dropped;
    accumulate(specName, seed, records);
    const stats = checkpoint.stats as { candidates_sampled?: number; candidates_viable?: number };
    sampledTotal += stats.candidates_sampled ?? 0;
    viableTotal += stats.candidates_viable ?? 0;
    console.error(
      `  ${specName}/s${seed}: ${records.length} probed, ` +
      `${stats.candidates_sampled ?? "?"} sampled / ${stats.candidates_viable ?? "?"} viable, ` +
      `${((Date.now() - t0) / 1000).toFixed(1)}s`,
    );
  }
}

// ─────────── report ───────────

console.log(`\n=== landing-window prize study (budget ${budget}, specs ${specNames.length}, seeds ${seeds.join(",")}) ===`);
console.log(`  probed (survival-passing) geometries ${recordTotal}  dropped-at-cap ${droppedTotal}`);
console.log(`  official counters: sampled ${sampledTotal}  viable ${viableTotal}`);
console.log(`  note: probe counts base geometry evaluations (arc anchor bisection can`);
console.log(`  evaluate one sampled candidate more than once) — tiers compare like with like.`);

console.log(`\n  Minimal-W tiers (W=1 is today's accepted pool; W≥2 are timing-only rejects)`);
console.log(`    tier        n      share   cum-vs-W1   impact: mean    p50    p90   speed-mean`);
const w1 = Math.max(1, tierCounts[1]);
let cum = 0;
for (let w = 1; w <= LANDING_PROBE_MAX_W; w++) {
  cum += tierCounts[w];
  const imp = tierImpacts[w];
  console.log(
    `    W=${w}   ${String(tierCounts[w]).padStart(8)}   ${(100 * tierCounts[w] / Math.max(1, recordTotal)).toFixed(1).padStart(5)}%   ` +
    `${("+" + (100 * (cum - tierCounts[1]) / w1).toFixed(1) + "%").padStart(8)}   ` +
    `${fmt(mean(imp)).padStart(11)} ${fmt(pct(imp, 0.5)).padStart(6)} ${fmt(pct(imp, 0.9)).padStart(6)}   ${fmt(mean(tierSpeeds[w]), 1).padStart(8)}`,
  );
}
console.log(`    none  ${String(rejectedCount).padStart(8)}   ${(100 * rejectedCount / Math.max(1, recordTotal)).toFixed(1).padStart(5)}%   (not admitted at W≤${LANDING_PROBE_MAX_W})`);

console.log(`\n  Same tiers, high-impact-target beats only (target ≥ 0.55)`);
for (let w = 1; w <= LANDING_PROBE_MAX_W; w++) {
  const imp = tierImpactsHighTarget[w];
  console.log(
    `    W=${w}   n ${String(imp.length).padStart(7)}   impact mean ${fmt(mean(imp))}  p50 ${fmt(pct(imp, 0.5))}  p90 ${fmt(pct(imp, 0.9))}`,
  );
}

console.log(`\n  Signed landing offsets of W≥2 admissions (landing − beat, frames)`);
const totalOff = [...offsetCounts.values()].reduce((a, b) => a + b, 0);
for (const k of [...offsetCounts.keys()].sort((a, b) => a - b)) {
  const n = offsetCounts.get(k) ?? 0;
  console.log(`    ${k >= 0 ? "+" + k : k}: ${String(n).padStart(8)} (${(100 * n / Math.max(1, totalOff)).toFixed(1)}%)`);
}

// Per-gap prize: does widening W give the per-gap selection a strictly better
// impact option than the best already-accepted candidate?
console.log(`\n  Per-gap prize on impact-targeted gaps (best candidate per pool)`);
const impactGaps = [...gapAggs.values()].filter((g) => g.targetImpact !== undefined && g.poolAtW[1] > 0);
console.log(`    impact-targeted gaps with a non-empty W=1 pool: ${impactGaps.length}`);
for (const k of [2, 3, LANDING_PROBE_MAX_W]) {
  const improved = impactGaps.filter((g) => g.bestCloseAtW[k] < g.bestCloseAtW[1] - 1e-9);
  const gains = improved.map((g) => g.bestCloseAtW[1] - g.bestCloseAtW[k]);
  console.log(
    `    W≤${k}: gaps with strictly better target-closeness ${improved.length}/${impactGaps.length} ` +
    `(${(100 * improved.length / Math.max(1, impactGaps.length)).toFixed(1)}%)  ` +
    `mean closeness gain ${fmt(mean(gains))}  p90 ${fmt(pct(gains, 0.9))}`,
  );
}
const highGaps = impactGaps.filter((g) => (g.targetImpact ?? 0) >= 0.55);
console.log(`    high-target (≥0.55) gaps: ${highGaps.length}`);
for (const k of [2, 3, LANDING_PROBE_MAX_W]) {
  const improved = highGaps.filter((g) => g.bestCloseAtW[k] < g.bestCloseAtW[1] - 1e-9);
  const gains = improved.map((g) => g.bestCloseAtW[1] - g.bestCloseAtW[k]);
  console.log(
    `    W≤${k}: improved ${improved.length}/${highGaps.length} ` +
    `(${(100 * improved.length / Math.max(1, highGaps.length)).toFixed(1)}%)  ` +
    `mean gain ${fmt(mean(gains))}  p90 ${fmt(pct(gains, 0.9))}`,
  );
}

// Template-lane selection analysis.
if (gapsWithTemplates.size > 0) {
  console.log(`\n  Template-lane selection analysis (${gapsWithTemplates.size} gaps saw template candidates)`);
  let tN = 0, tViable = 0, tImp: number[] = [], nImp: number[] = [];
  let beatsBestIsTemplate = 0, beatsTemplateWinsCost = 0, beatsCompared = 0;
  const costDeltas: number[] = [];
  for (const gkey of gapsWithTemplates) {
    const det = templateGapDetail.get(gkey) ?? [];
    const viable = det.filter((c) => c.w === 1 && c.cost !== null && c.impact !== null);
    const vt = viable.filter((c) => c.isTemplate);
    const vn = viable.filter((c) => !c.isTemplate);
    for (const c of det) if (c.isTemplate) { tN++; if (c.w === 1 && c.cost !== null) tViable++; }
    tImp.push(...vt.map((c) => c.impact as number));
    nImp.push(...vn.map((c) => c.impact as number));
    if (vt.length === 0 || vn.length === 0) continue;
    beatsCompared++;
    const bestImpact = [...viable].sort((a, b) => (b.impact as number) - (a.impact as number))[0];
    const minCost = [...viable].sort((a, b) => (a.cost as number) - (b.cost as number))[0];
    if (bestImpact.isTemplate) beatsBestIsTemplate++;
    if (minCost.isTemplate) beatsTemplateWinsCost++;
    const bestTemplate = [...vt].sort((a, b) => (b.impact as number) - (a.impact as number))[0];
    costDeltas.push((bestTemplate.cost as number) - (minCost.cost as number));
  }
  console.log(`    template records ${tN}  gate-pass(W=1, costed) ${tViable} (${(100 * tViable / Math.max(1, tN)).toFixed(1)}%)`);
  console.log(`    viable impact: templates mean ${fmt(mean(tImp))} p90 ${fmt(pct(tImp, 0.9))} (n=${tImp.length})  vs normals mean ${fmt(mean(nImp))} p90 ${fmt(pct(nImp, 0.9))} (n=${nImp.length})`);
  console.log(`    gaps with both viable: ${beatsCompared}  best-impact-is-template ${beatsBestIsTemplate} (${(100 * beatsBestIsTemplate / Math.max(1, beatsCompared)).toFixed(0)}%)  template-wins-cost ${beatsTemplateWinsCost} (${(100 * beatsTemplateWinsCost / Math.max(1, beatsCompared)).toFixed(0)}%)`);
  console.log(`    cost(best-impact template) − cost(min-cost candidate): mean ${fmt(mean(costDeltas))}  p50 ${fmt(pct(costDeltas, 0.5))}  p90 ${fmt(pct(costDeltas, 0.9))}`);

  // Handoff-ranker view (forward-eval at ≥75k): does the RANKER demote templates
  // that win raw cost, and by how much?
  let hN = 0, hTemplateWins = 0;
  const handoffDeltas: number[] = [];
  for (const gkey of gapsWithTemplates) {
    const det = templateGapDetail.get(gkey) ?? [];
    const ranked = det.filter((c) => c.handoff !== undefined && c.impact !== null);
    const rt = ranked.filter((c) => c.isTemplate);
    const rn = ranked.filter((c) => !c.isTemplate);
    if (rt.length === 0 || rn.length === 0) continue;
    hN++;
    const minAll = Math.min(...ranked.map((c) => c.handoff as number));
    const minT = Math.min(...rt.map((c) => c.handoff as number));
    if (minT <= minAll + 1e-12) hTemplateWins++;
    handoffDeltas.push(minT - minAll);
  }
  console.log(`    handoff-ranked gaps with both: ${hN}  template-wins-ranker ${hTemplateWins} (${(100 * hTemplateWins / Math.max(1, hN)).toFixed(0)}%)`);
  console.log(`    handoffScore(best template) − handoffScore(best overall): mean ${fmt(mean(handoffDeltas))}  p50 ${fmt(pct(handoffDeltas, 0.5))}  p90 ${fmt(pct(handoffDeltas, 0.9))}`);
}

// Gaps where today's pool is EMPTY but a widened pool exists — the search
// currently fails these beats outright; widening would rescue them.
const rescuable = [...gapAggs.values()].filter((g) => g.poolAtW[1] === 0);
console.log(`\n  Gaps with empty W=1 pool but non-empty wider pool (rescue candidates): ${rescuable.length}`);
for (const k of [2, 3, LANDING_PROBE_MAX_W]) {
  const n = rescuable.filter((g) => g.poolAtW[k] > 0).length;
  console.log(`    rescued at W≤${k}: ${n}`);
}

// Engine finalizers can throw during shutdown after output is complete (same
// pattern as study_redir_fundamentals.ts) — exit explicitly.
process.stdout.write("", () => process.stderr.write("", () => process.exit(0)));
