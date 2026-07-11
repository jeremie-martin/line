/**
 * Pairing benefit study (Benchmark V2).
 *
 * Question this answers: when we compare a candidate compiler against a baseline
 * on the SAME seeds (paired), how much variance does the pairing actually remove?
 * That gates a design decision: is a deep FROZEN baseline good enough, or must
 * every candidate be re-run FRESH against a paired baseline?
 *
 * The pairing benefit is governed by the within-(case,budget) correlation between
 * base and candidate scores across shared seeds:
 *   - correlation -> 1  : paired comparison (and a frozen baseline) removes almost
 *                         all seed variance; deltas are precise.
 *   - correlation -> 0  : "same seed, different compiler" behaves like independent
 *                         draws (the hand-off DFS is chaotic and re-routes), so
 *                         pairing buys nothing over an unpaired mean comparison.
 *
 * This script is PURE and DETERMINISTIC. Its only inputs are pre-computed compile
 * archives, referenced by path + sha256. It performs NO compilation. Re-running it
 * on the same archives produces byte-identical output (no timestamps, sorted keys).
 *
 * The compile archives themselves are produced OUT OF BAND by
 * scripts/v0/benchmark_v2/scale_study.ts (the two clean-knob candidate arms and the
 * reused 12-seed coverage-reference baseline) and by the retained calibration probe
 * runner (the invasive LR_QUALITY_NCAND=1 pair). See benchmark/v2/studies/pairing.json
 * `inputs` for exact paths and hashes.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { gunzipSync } from "node:zlib";

const REPO = resolve(dirname(new URL(import.meta.url).pathname), "..", "..");

// ── Input archives ───────────────────────────────────────────────────────────
// Every archive (budget-scale-study.v1 and run-archive.v5) shares the run shape
// runs[].task.{sourceId,budget,seedSlot,actualSeed} + runs[].score.{score,valid},
// so one loader handles both. Baselines and candidates are paired on the tuple
// (sourceId, budget, seedSlot) with actualSeed verified equal per cell.
const ARCHIVES = {
  coverageReference: "benchmark/v2/runs/calibration-v2.4-coverage-reference.json.gz",
  smallArm: "generated/benchmark-v2/studies/pairing-small-arm.json",
  broadArm: "generated/benchmark-v2/studies/pairing-broad-arm.json",
  probeBaseline: "benchmark/v2/runs/calibration-v2.4-probe-baseline.json.gz",
  probeNcand1: "benchmark/v2/runs/calibration-v2.4-quality-ncand-1-probe.json.gz",
} as const;

// Each comparison: a candidate arm vs its paired baseline arm, plus the LR_ knob
// and the values that distinguish them. `sharedSeeds` documents the paired design.
const COMPARISONS: Array<{
  name: string;
  label: string;
  baseline: keyof typeof ARCHIVES;
  candidate: keyof typeof ARCHIVES;
  knob: string;
  baselineValue: string;
  candidateValue: string;
  sharedSeeds: number;
  changeClass: "tiny" | "broad" | "invasive";
  note: string;
}> = [
  {
    name: "small_impact_local_w",
    label: "SMALL: impact candidate-cost weight +10%",
    baseline: "coverageReference",
    candidate: "smallArm",
    knob: "LR_IMPACT_LOCAL_W",
    baselineValue: "0.5 (default)",
    candidateValue: "0.55",
    sharedSeeds: 12,
    changeClass: "tiny",
    note:
      "Clean continuous cost-weight of the impact axis in the hand-off candidate " +
      "ranker (candidate.ts LOCAL_IMPACT_COST_WEIGHT, arc_model.ts). No code-path " +
      "guard: nudging it only changes the scalar. Decision-relevant SMALL-change cell.",
  },
  {
    name: "broad_readiness_power",
    label: "BROAD: objective readiness power forced flat 1.1",
    baseline: "coverageReference",
    candidate: "broadArm",
    knob: "LR_M75_OBJECTIVE_READINESS_POWER",
    baselineValue: "spec-adaptive (unset)",
    candidateValue: "1.1",
    sharedSeeds: 12,
    changeClass: "broad",
    note:
      "Second clean knob at a larger nudge. Setting it replaces the spec-adaptive " +
      "readiness-power gates with a flat 1.1 in the forward-eval objective (mature " +
      "budgets >=200k). A BROAD but smooth reshaping: perturbs ~86% of compiles yet " +
      "shifts the headline only ~+27. There is NO clean 'medium' knob on this " +
      "compiler (see study note): clean numeric knobs are bimodal - either tiny " +
      "(impact cost, ~2% perturbed) or broad (objective power, ~86% perturbed).",
  },
  {
    name: "invasive_quality_ncand1",
    label: "INVASIVE: quality NCAND=1 (retained preliminary probe)",
    baseline: "probeBaseline",
    candidate: "probeNcand1",
    knob: "LR_QUALITY_NCAND",
    baselineValue: "default",
    candidateValue: "1",
    sharedSeeds: 3,
    changeClass: "invasive",
    note:
      "The retained preliminary probe pair (3 shared seeds/cell, budgets 250k/500k). " +
      "An invasive search-structure change: collapses the quality pool to a single " +
      "candidate, moving the headline ~-140. Reproduced here as the large-change end.",
  },
];

type Run = {
  sourceId: string;
  budget: number;
  seedSlot: number;
  actualSeed: number;
  score: number;
  valid: boolean;
};

type LoadedArchive = {
  path: string;
  sha256: string;
  schema: string;
  runs: Run[];
  budgets: number[];
  headlineByBudget: Map<number, number>;
};

function loadArchive(rel: string): LoadedArchive {
  const abs = resolve(REPO, rel);
  const bytes = readFileSync(abs);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const text = rel.endsWith(".gz") ? gunzipSync(bytes).toString("utf8") : bytes.toString("utf8");
  const json = JSON.parse(text);
  const runs: Run[] = json.runs.map((r: any) => ({
    sourceId: r.task.sourceId,
    budget: r.task.budget,
    seedSlot: r.task.seedSlot,
    actualSeed: r.task.actualSeed,
    score: r.score.score,
    valid: r.score.valid === true,
  }));
  const budgets = [...new Set(runs.map((r) => r.budget))].sort((a, b) => a - b);
  // Catalog headline per budget: scale-study exposes `summaries`, the run-archive
  // exposes `developmentSummaries`; both entries carry {budget, score}.
  const summaries = json.summaries ?? json.developmentSummaries ?? [];
  const headlineByBudget = new Map<number, number>(
    summaries.map((s: any) => [s.budget as number, s.score as number]),
  );
  return { path: rel, sha256, schema: json.schema, runs, budgets, headlineByBudget };
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function variance(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1);
}

function pearson(xs: number[], ys: number[]): number {
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  return sxy / Math.sqrt(sxx * syy);
}

function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function round(x: number, places = 6): number {
  if (!Number.isFinite(x)) return x;
  const f = 10 ** places;
  return Math.round(x * f) / f;
}

// cellIndex: budget -> sourceId -> seedSlot -> Run
function indexByCell(runs: Run[]): Map<number, Map<string, Map<number, Run>>> {
  const idx = new Map<number, Map<string, Map<number, Run>>>();
  for (const r of runs) {
    let byBudget = idx.get(r.budget);
    if (byBudget === undefined) idx.set(r.budget, (byBudget = new Map()));
    let bySource = byBudget.get(r.sourceId);
    if (bySource === undefined) byBudget.set(r.sourceId, (bySource = new Map()));
    bySource.set(r.seedSlot, r);
  }
  return idx;
}

function analyzeComparison(base: LoadedArchive, cand: LoadedArchive) {
  const baseIdx = indexByCell(base.runs);
  const candIdx = indexByCell(cand.runs);
  const budgets = base.budgets.filter((b) => cand.budgets.includes(b)).sort((a, b) => a - b);

  const perBudget = budgets.map((budget) => {
    const baseBySource = baseIdx.get(budget)!;
    const candBySource = candIdx.get(budget)!;
    const sources = [...baseBySource.keys()].filter((s) => candBySource.has(s)).sort();

    const correlations: number[] = [];
    let cellsWithVariation = 0;
    let zeroVarianceCells = 0;
    let insufficientPairCells = 0;
    let actualSeedMismatchSlots = 0;

    // Pooled within-cell (seed) variance decomposition: center each cell by its
    // own mean so between-case level differences do not swamp the seed variance.
    let ssBase = 0;
    let ssCand = 0;
    let ssDelta = 0;

    let totalValidPairs = 0;
    let identicalValidPairs = 0;
    const pairedDeltas: number[] = [];

    // Changed-pairs-only diagnostic: cell-centered (base, cand) points restricted
    // to pairs whose scores actually differ. Centering uses the cell means over ALL
    // valid shared pairs (stable even when a cell has a single changed pair). This
    // isolates the chaos question: GIVEN the compile diverged, is any correlation left?
    const changedCentered: Array<[number, number]> = [];

    for (const source of sources) {
      const baseSeeds = baseBySource.get(source)!;
      const candSeeds = candBySource.get(source)!;
      const slots = [...baseSeeds.keys()].filter((s) => candSeeds.has(s)).sort((a, b) => a - b);
      const b: number[] = [];
      const c: number[] = [];
      for (const slot of slots) {
        const br = baseSeeds.get(slot)!;
        const cr = candSeeds.get(slot)!;
        if (br.actualSeed !== cr.actualSeed) {
          actualSeedMismatchSlots++;
          continue; // not a valid paired observation
        }
        if (!br.valid || !cr.valid) continue; // pair only where both compiled validly
        b.push(br.score);
        c.push(cr.score);
      }
      totalValidPairs += b.length;
      for (let i = 0; i < b.length; i++) {
        if (b[i] === c[i]) identicalValidPairs++;
        pairedDeltas.push(c[i] - b[i]);
      }
      if (b.length < 2) {
        insufficientPairCells++;
        continue;
      }
      const mb = mean(b);
      const mc = mean(c);
      for (let i = 0; i < b.length; i++) {
        ssBase += (b[i] - mb) * (b[i] - mb);
        ssCand += (c[i] - mc) * (c[i] - mc);
        const d = (c[i] - mc) - (b[i] - mb);
        ssDelta += d * d;
        if (b[i] !== c[i]) changedCentered.push([b[i] - mb, c[i] - mc]);
      }
      const vb = variance(b);
      const vc = variance(c);
      if (vb === 0 || vc === 0) {
        zeroVarianceCells++;
        continue; // Pearson undefined; base or cand identical across all shared seeds
      }
      correlations.push(pearson(b, c));
      cellsWithVariation++;
    }

    const pooledVarRatio = ssBase + ssCand > 0 ? ssDelta / (ssBase + ssCand) : null;
    let changedPairsPearson: number | null = null;
    let changedPairsVarRatio: number | null = null;
    if (changedCentered.length >= 3) {
      const xs = changedCentered.map((p) => p[0]);
      const ys = changedCentered.map((p) => p[1]);
      let sb = 0;
      let sc = 0;
      let sd = 0;
      for (const [x, y] of changedCentered) {
        sb += x * x;
        sc += y * y;
        sd += (y - x) * (y - x);
      }
      if (sb > 0 && sc > 0) {
        changedPairsPearson = round(pearson(xs, ys));
        changedPairsVarRatio = round(sd / (sb + sc));
      }
    }
    const baseHeadline = base.headlineByBudget.get(budget) ?? null;
    const candHeadline = cand.headlineByBudget.get(budget) ?? null;

    return {
      budget,
      cellCounts: {
        totalSharedCells: sources.length,
        cellsWithVariation, // usable Pearson r
        zeroVarianceCells, // base or cand identical across shared seeds
        insufficientPairCells, // < 2 valid paired seeds
        actualSeedMismatchSlots,
      },
      pairing: {
        meanWithinCellPearson: correlations.length ? round(mean(correlations)) : null,
        medianWithinCellPearson: correlations.length ? round(median(correlations)) : null,
        pooledVarDeltaOverVarBasePlusVarCand: pooledVarRatio === null ? null : round(pooledVarRatio),
      },
      pairs: {
        totalValidPairs,
        identicalValidPairs,
        fractionIdenticalValidPairs: totalValidPairs ? round(identicalValidPairs / totalValidPairs) : null,
      },
      changedPairsOnly: {
        count: changedCentered.length,
        pooledPearsonCellCentered: changedPairsPearson,
        pooledVarRatio: changedPairsVarRatio,
      },
      effectSize: {
        meanPairedRunDelta: pairedDeltas.length ? round(mean(pairedDeltas)) : null,
        catalogHeadlineDelta:
          baseHeadline !== null && candHeadline !== null ? round(candHeadline - baseHeadline) : null,
        baselineCatalogHeadline: baseHeadline === null ? null : round(baseHeadline, 4),
        candidateCatalogHeadline: candHeadline === null ? null : round(candHeadline, 4),
      },
    };
  });

  return perBudget;
}

function main(): void {
  const loaded = Object.fromEntries(
    Object.entries(ARCHIVES).map(([k, rel]) => [k, loadArchive(rel)]),
  ) as Record<keyof typeof ARCHIVES, LoadedArchive>;

  const inputs = Object.fromEntries(
    (Object.keys(ARCHIVES) as Array<keyof typeof ARCHIVES>).map((k) => [
      k,
      { path: loaded[k].path, sha256: loaded[k].sha256, schema: loaded[k].schema, runs: loaded[k].runs.length },
    ]),
  );

  const comparisons = COMPARISONS.map((cfg) => ({
    name: cfg.name,
    label: cfg.label,
    changeClass: cfg.changeClass,
    knob: cfg.knob,
    baselineValue: cfg.baselineValue,
    candidateValue: cfg.candidateValue,
    sharedSeedsPerCell: cfg.sharedSeeds,
    baselineArchive: loaded[cfg.baseline].path,
    candidateArchive: loaded[cfg.candidate].path,
    note: cfg.note,
    budgets: analyzeComparison(loaded[cfg.baseline], loaded[cfg.candidate]),
  }));

  const report = {
    schema: "line.benchmark-v2.pairing-study.v1",
    title: "Paired (shared-seed) base-vs-candidate correlation vs candidate change size",
    hypothesis:
      "Same seed + different compiler behaves like independent draws (chaotic hand-off " +
      "DFS), so the within-(case,budget) base<->candidate correlation collapses toward 0 " +
      "and paired comparison buys no variance reduction over an unpaired mean.",
    methodology: {
      pairingUnit:
        "One paired observation = (sourceId, budget, seedSlot) where both arms produced a " +
        "VALID score and share the same actualSeed. actualSeed equality is verified per slot; " +
        "mismatched slots are excluded and counted.",
      withinCellCorrelation:
        "For each (sourceId, budget) cell, Pearson r between base and candidate scores across " +
        "the cell's shared valid seeds. Cells with < 2 valid pairs are skipped (insufficientPairCells). " +
        "Cells where base OR candidate has zero variance across seeds are skipped (zeroVarianceCells; " +
        "Pearson undefined) - these are dominated by base==candidate identical compiles for tiny changes. " +
        "meanWithinCellPearson / medianWithinCellPearson aggregate over the remaining cellsWithVariation.",
      pooledVarianceRatio:
        "pooledVarDeltaOverVarBasePlusVarCand = SS(delta) / (SS(base) + SS(cand)), where each cell's " +
        "base, candidate and delta=(cand-base) are centered by the cell mean before pooling across all " +
        "cells at that budget (so between-case level differences do not enter). Independent equal-variance " +
        "draws -> ratio ~1; perfectly paired -> ratio ~0. For equal within-cell variances the ratio ~= 1 - rho.",
      effectSize:
        "meanPairedRunDelta = mean over valid paired runs of (candidate - baseline) score; " +
        "catalogHeadlineDelta = candidate minus baseline catalog headline (summary score) for the budget. " +
        "Pairing benefit must be read ALONGSIDE effect size and fractionIdenticalValidPairs.",
      changedPairsOnly:
        "Secondary diagnostic isolating the chaos hypothesis: cell-centered (base, cand) points restricted " +
        "to valid pairs whose scores DIFFER (centering by the cell's full valid-pair means). " +
        "pooledPearsonCellCentered near 0 = once the compile actually diverges, base and candidate are " +
        "effectively independent draws; the aggregate pairing benefit then comes entirely from the " +
        "identical-compile mass. Computed only when >= 3 changed pairs exist at the budget.",
      purity:
        "This script performs no compilation and contains no nondeterministic fields; output is a pure " +
        "function of the input archives (referenced above by sha256).",
    },
    knobStudyNote:
      "Knob selection: grepped process.env.LR_* across scripts/v0, scripts/lib. Clean CONTINUOUS " +
      "knobs that do not touch scoring or the suite transform and have no code-path guard are scarce. " +
      "LR_IMPACT_LOCAL_W (impact candidate-cost weight, default 0.5) is the one clean scalar; on this " +
      "suite it is low-traction (a +/-10..300% nudge perturbs only ~2-4% of compiles - forward-eval " +
      "dominates the ranking). The objective-power knobs (LR_M64/M75_OBJECTIVE_*_POWER) perturb ~86% of " +
      "compiles but do so by replacing a spec-adaptive path with a flat power (a broad reshaping), not a " +
      "pure scalar nudge. No clean 'medium' knob exists, so the change-size ladder is tiny -> broad -> invasive.",
    baselineProvenance:
      "The 12-seed baseline arm REUSES benchmark/v2/runs/calibration-v2.4-coverage-reference.json.gz: the " +
      "current working-tree compiler reproduced a 84-run subset (250k, seeds 0,1) of it BIT-IDENTICALLY, so " +
      "a fresh baseline arm was unnecessary. The two candidate arms were compiled fresh from the same tree " +
      "with only the one LR_ knob changed.",
    inputs,
    comparisons,
  };

  const outRel = "benchmark/v2/studies/pairing.json";
  const outAbs = resolve(REPO, outRel);
  mkdirSync(dirname(outAbs), { recursive: true });
  writeFileSync(outAbs, `${JSON.stringify(report, null, 2)}\n`);
  // Console summary (not part of the deterministic artifact).
  for (const cmp of report.comparisons) {
    console.log(`\n${cmp.label}  [${cmp.knob}: ${cmp.baselineValue} -> ${cmp.candidateValue}]`);
    for (const b of cmp.budgets) {
      console.log(
        `  ${b.budget / 1000}k: meanR=${b.pairing.meanWithinCellPearson}` +
          ` medianR=${b.pairing.medianWithinCellPearson}` +
          ` varRatio=${b.pairing.pooledVarDeltaOverVarBasePlusVarCand}` +
          ` | cellsVar=${b.cellCounts.cellsWithVariation} zeroVar=${b.cellCounts.zeroVarianceCells}` +
          ` insuf=${b.cellCounts.insufficientPairCells}/${b.cellCounts.totalSharedCells}` +
          ` | identical=${b.pairs.identicalValidPairs}/${b.pairs.totalValidPairs}` +
          ` | changedOnly n=${b.changedPairsOnly.count} r=${b.changedPairsOnly.pooledPearsonCellCentered}` +
          ` | headlineDelta=${b.effectSize.catalogHeadlineDelta} meanRunDelta=${b.effectSize.meanPairedRunDelta}`,
      );
    }
  }
  console.log(`\nwrote ${relative(REPO, outAbs)}`);
}

main();
