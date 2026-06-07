/**
 * Headline optimizer metric + paired decision statistics.
 *
 * Single source of truth for the scalar the improvement loop maximizes and for
 * the accept/reject decision rule. Kept SEPARATE from `score.ts` (the per-run
 * scorer) on purpose: this module aggregates already-computed suite scores and
 * must NOT enter `evaluatorFingerprint()` (which hashes the per-run ruler).
 *
 * Design:
 *  - Each budget is an INDEPENDENT full run (no anytime sharing). The headline is the
 *    WEIGHTED AVERAGE of the per-budget suite scores, weights proportional to budget
 *    value (higher-quality expensive runs matter more; lower budgets still count).
 *    Each budget is its own optimization target, so averaging per-budget optima is
 *    the right scalar. `decide` also reports the per-budget paired deltas/CIs so a
 *    budget-trading change is visible, not averaged away.
 *    Interim trade: while the search is still budget-oblivious this rewards
 *    early-budget gains the prior ceiling-heavy metric penalized; that is expected.
 *  - Decision: PAIRED cluster bootstrap on the headline delta (same specs+seeds for
 *    both configs), because pairing cancels common-mode seed luck (~10x noise
 *    collapse). The verdict is a one-sided probability gate at α=0.20:
 *    accept iff P(Δ≤0) < 0.20, reject iff P(Δ≥0) < 0.20, else inconclusive.
 *    (The 95% CI is reported for context but does not define the verdict.)
 *  - Validity is NOT a gate: an invalid run already scores ~0, and the per-budget
 *    multi-seed aggregation folds that into the score. Per-budget validity is reported
 *    as a diagnostic only.
 *  - Weights are keyed by budget (not position), so the decision recomputes safely on
 *    a budget intersection (e.g. a probe tier subset), renormalizing automatically.
 *  - The per-budget deltas share ONE resample per iteration across budgets (the
 *    aggregate's basis), so they reconcile with the weighted Δ. A future per-budget
 *    significance methodology (analogous to docs/engine_speed_methodology.md for the
 *    engine) may instead bootstrap each budget's column independently; that is the
 *    intended evolution, not a change this module makes yet.
 */
import { shiftedGeometricMean } from "./score.ts";

export type CurvePoint = { budget: number; score: number };
export type BudgetWeight = { budget: number; weight: number };

/** One-sided probability gate for the accept/reject verdict.
 *  Accept iff the paired bootstrap puts < α mass at or below 0 (reliably an improvement);
 *  reject iff < α mass at or above 0 (reliably a regression); else inconclusive. */
export const DECISION_ALPHA = 0.10;

/** Per-config score cube: spec -> seed -> (budget -> score). */
export type ScoreCube = Map<string, Map<number, Map<number, number>>>;
/** Per-config validity cube: spec -> seed -> (budget -> contract_passed). */
export type ValidCube = Map<string, Map<number, Map<number, boolean>>>;


/**
 * THE HEADLINE SCALAR: weighted average of per-budget suite scores,
 * `Σ w_b·score_b / Σ w_b`, over the budgets present in BOTH `points` and
 * `weightByBudget`. Weights are looked up by budget (not position), and the divisor
 * is the sum of the weights actually used — so scoring a budget SUBSET (an
 * intersection / probe tier) renormalizes automatically with no positional drift.
 */
export function weightedBudgetScore(points: CurvePoint[], weightByBudget: BudgetWeight[]): number {
  return weightedBudgetScoreFromMap(points, weightMapOf(weightByBudget));
}

/** Build the budget→weight lookup once; hoist out of hot loops. */
function weightMapOf(weightByBudget: BudgetWeight[]): Map<number, number> {
  return new Map(weightByBudget.map((x) => [x.budget, x.weight]));
}

/** weightedBudgetScore with a precomputed weight map — used in the bootstrap hot
 *  loop so the (constant) map isn't rebuilt per resample. Thin shape adapter over
 *  the single weighted-mean kernel `weightedFromVec` (keeps one place that defines
 *  the renormalize / zero-weight / empty-divisor semantics). */
function weightedBudgetScoreFromMap(points: CurvePoint[], w: Map<number, number>): number {
  return weightedFromVec(points.map((p) => p.score), points.map((p) => p.budget), w);
}

/** Parse/validate a comma-separated budget list (positive integer frames). Uses
 *  Number, NOT parseInt, so "50k" -> NaN -> a loud error instead of a silent 50. */
export function parseBudgetList(raw: string): number[] {
  return raw.split(",").map((part) => {
    const n = Number(part.trim());
    if (!Number.isInteger(n) || n <= 0) {
      throw new Error(`budget list must be comma-separated positive integer frames, got "${part.trim()}"`);
    }
    return n;
  });
}

/** Suite score from per-spec seed-score groups: shifted-geomean over seeds within
 *  each spec, then over specs. This is the SAME two-level aggregation golden.ts
 *  applies via groupScores()+suiteScore(); keep the two in sync (parity is pinned
 *  by tests/v0_metric.test.ts). */
export function suiteFromGroups(perSpecSeedScores: number[][]): number {
  return shiftedGeometricMean(perSpecSeedScores.map((g) => shiftedGeometricMean(g)));
}

// ── paired decision statistics ──────────────────────────────────────────────

/** Deterministic PRNG (mulberry32) so a verdict is reproducible across runs. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mean = (xs: number[]): number => (xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length);

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[idx];
}

/** Per-budget suite scores for a (possibly resampled) set of specs and per-spec
 *  seeds — one suite score per budget (shifted-geomean over seeds then specs). The
 *  bootstrap reuses this vector for BOTH the per-budget deltas and the weighted
 *  aggregate, so each resample computes it once. */
function perBudgetSuite(
  cube: ScoreCube,
  specsSample: string[],
  seedsBySpec: Map<string, number[]>,
  budgets: number[],
): number[] {
  return budgets.map((b) => {
    const groups: number[][] = [];
    for (const spec of specsSample) {
      const seedCurves = cube.get(spec);
      const seeds = seedsBySpec.get(spec);
      if (!seedCurves || !seeds || seeds.length === 0) continue;
      // Missing cells default to 0, but the decide-tool scope guard ensures common
      // specs/seeds/budgets and each (spec,seed,budget) is its own run, so this
      // fallback should not fire on well-formed archives.
      groups.push(seeds.map((se) => seedCurves.get(se)?.get(b) ?? 0));
    }
    // Same two-level aggregation as golden.ts's per-budget suiteScore (see suiteFromGroups).
    return suiteFromGroups(groups);
  });
}

/** Weighted aggregate of a per-budget suite vector (divides by the weights used,
 *  so a budget subset renormalizes — matching `weightedBudgetScore`). */
function weightedFromVec(vec: number[], budgets: number[], weightMap: Map<number, number>): number {
  let num = 0;
  let den = 0;
  for (let i = 0; i < budgets.length; i++) {
    const wb = weightMap.get(budgets[i]);
    if (wb === undefined || wb <= 0) continue;
    num += wb * vec[i];
    den += wb;
  }
  return den > 0 ? num / den : 0;
}

/** Suite validity rate per budget (mean over specs of mean-over-seeds pass rate). */
export function validityByBudget(valid: ValidCube, budgets: number[]): { budget: number; rate: number }[] {
  const specs = [...valid.keys()];
  return budgets.map((b) => {
    const perSpec = specs.map((spec) => {
      const seeds = valid.get(spec)!;
      const vals = [...seeds.values()].map((m) => (m.get(b) ? 1 : 0));
      return mean(vals);
    });
    return { budget: b, rate: mean(perSpec) };
  });
}

/** A paired delta + CI for ONE budget — so a budget-trading change (helps cheap,
 *  hurts expensive, or vice-versa) is visible rather than averaged into the headline.
 *  Reported, not gating; the seed for the future per-budget significance methodology. */
export type PerBudgetDelta = {
  budget: number;
  baseScore: number;
  candScore: number;
  delta: number;
  ciLo: number;
  ciHi: number;
  pLeZero: number;
};

export type Decision = {
  baseHeadline: number;
  candidateHeadline: number;
  delta: number;
  ciLo: number;
  ciHi: number;
  pLeZero: number;
  effect: number; // mean / sd  (paired Cohen's d analog)
  budgets: number[];
  weightByBudget: BudgetWeight[];
  /** Per-budget paired deltas + CIs (same resample basis as the aggregate). */
  perBudget: PerBudgetDelta[];
  /** Per-budget validity rates, REPORTED as a diagnostic only — they never gate. */
  validity: { budget: number; baseRate: number; candRate: number }[];
  verdict: "accept" | "reject" | "inconclusive";
};

/**
 * Paired CLUSTER bootstrap on the headline-metric delta (candidate - baseline).
 * Resample specs with replacement, then resample each chosen spec's seeds with
 * replacement; apply the SAME resample to both configs (paired). Propagates both
 * between-spec and within-spec (seed) variance.
 *
 * The verdict is the score delta CI ALONE: accept iff ciLo>0, reject iff ciHi<0,
 * else inconclusive. Validity does not gate (an invalid run already scores ~0); the
 * per-budget validity rates are computed and returned for reporting only.
 */
export function pairedBootstrapCI(
  base: ScoreCube,
  cand: ScoreCube,
  budgets: number[],
  opts: {
    weightByBudget: BudgetWeight[];
    B?: number;
    level?: number;
    rngSeed?: number;
    validBase?: ValidCube;
    validCand?: ValidCube;
  },
): Decision {
  const weightByBudget = opts.weightByBudget;
  const weightMap = weightMapOf(weightByBudget); // built once; reused across all resamples
  const B = opts.B ?? 10000;
  const level = opts.level ?? 0.95;
  const rand = mulberry32(opts.rngSeed ?? 12345);

  const specs = [...base.keys()].filter((s) => cand.has(s)).sort();
  const seedsOf = (spec: string): number[] => {
    const b = base.get(spec);
    const c = cand.get(spec);
    if (!b || !c) return [];
    return [...b.keys()].filter((se) => c.has(se)).sort((x, y) => x - y);
  };

  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  // Precompute each spec's paired seed list ONCE (it never changes across the B
  // iterations); the loop only resamples from it.
  const seedsBySpecAll = new Map(specs.map((s) => [s, seedsOf(s)] as const));
  const deltas: number[] = [];
  // Per-budget delta samples, same resample basis as the aggregate (one resample per
  // iteration applied to all budgets) — so the per-budget deltas reconcile with the
  // weighted aggregate. (A future significance redesign may bootstrap each budget's
  // column independently; documented in the metric header.)
  const perBudgetDeltaSamples: number[][] = budgets.map(() => []);

  for (let i = 0; i < B; i++) {
    const specsSample = specs.map(() => pick(specs));
    const seedsBySpec = new Map<string, number[]>();
    for (const spec of new Set(specsSample)) {
      const seeds = seedsBySpecAll.get(spec)!;
      seedsBySpec.set(spec, seeds.map(() => pick(seeds)));
    }
    const candVec = perBudgetSuite(cand, specsSample, seedsBySpec, budgets);
    const baseVec = perBudgetSuite(base, specsSample, seedsBySpec, budgets);
    for (let bi = 0; bi < budgets.length; bi++) {
      perBudgetDeltaSamples[bi].push(candVec[bi] - baseVec[bi]);
    }
    deltas.push(
      weightedFromVec(candVec, budgets, weightMap) - weightedFromVec(baseVec, budgets, weightMap),
    );
  }

  deltas.sort((a, b) => a - b);
  const lo = (1 - level) / 2;
  const dMean = mean(deltas);
  const sd = Math.sqrt(mean(deltas.map((d) => (d - dMean) ** 2)));
  const baseVecAll = perBudgetSuite(base, specs, seedsBySpecAll, budgets);
  const candVecAll = perBudgetSuite(cand, specs, seedsBySpecAll, budgets);
  const baseHeadline = weightedFromVec(baseVecAll, budgets, weightMap);
  const candidateHeadline = weightedFromVec(candVecAll, budgets, weightMap);
  const pointDelta = candidateHeadline - baseHeadline;
  const ciLo = quantile(deltas, lo);
  const ciHi = quantile(deltas, 1 - lo);

  const perBudget: PerBudgetDelta[] = budgets.map((b, bi) => {
    const samp = [...perBudgetDeltaSamples[bi]].sort((x, y) => x - y);
    return {
      budget: b,
      baseScore: baseVecAll[bi],
      candScore: candVecAll[bi],
      delta: candVecAll[bi] - baseVecAll[bi],
      ciLo: quantile(samp, lo),
      ciHi: quantile(samp, 1 - lo),
      pLeZero: mean(samp.map((d) => (d <= 0 ? 1 : 0))),
    };
  });

  // Reported diagnostic only — per-budget validity rates, NOT a gate.
  const validity = opts.validBase && opts.validCand
    ? budgets.map((b) => ({
      budget: b,
      baseRate: validityByBudget(opts.validBase!, [b])[0].rate,
      candRate: validityByBudget(opts.validCand!, [b])[0].rate,
    }))
    : [];

  // Verdict = a one-sided probability gate at DECISION_ALPHA read straight off the
  // paired bootstrap distribution: accept if the change is reliably an improvement
  // (P(Δ≤0) < α), reject if reliably a regression (P(Δ≥0) < α), else inconclusive.
  // The 95% CI is still reported for context but does not define the verdict.
  const pLeZero = mean(deltas.map((d) => (d <= 0 ? 1 : 0)));
  const pGeZero = mean(deltas.map((d) => (d >= 0 ? 1 : 0)));
  const verdict: Decision["verdict"] =
    pLeZero < DECISION_ALPHA ? "accept" : pGeZero < DECISION_ALPHA ? "reject" : "inconclusive";

  return {
    baseHeadline,
    candidateHeadline,
    delta: pointDelta,
    ciLo,
    ciHi,
    pLeZero,
    effect: sd > 0 ? dMean / sd : 0,
    budgets,
    weightByBudget,
    perBudget,
    validity,
    verdict,
  };
}
